import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { CLOUDFRONT_CERTIFICATE_REGION } from '../lib/config/stages';
import { CertificateStack } from '../lib/frontend/CertificateStack';
import { FrontendStack } from '../lib/frontend/FrontendStack';
import { createApp, env, stage, synthAndCollectNagViolations } from './helpers';

// Managed CloudFront policy ids.
const CACHING_OPTIMIZED = '658327ea-f89d-4fab-a63d-7e88639e58f6';
const CACHING_DISABLED = '4135ea2d-6df8-44a3-9df3-4b5a84be39ad';
const ALL_VIEWER_EXCEPT_HOST_HEADER = 'b689b0a8-53d0-40ab-baf2-68738e2966ac';

/** Minimal stand-in for the Vite build. */
function fakeWebDist() {
  const dir = mkdtempSync(join(tmpdir(), 'web-dist-'));
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><div id="root"></div>');
  writeFileSync(join(dir, 'assets', 'index-AbC123.js'), 'console.log(1)');
  return dir;
}

interface CacheBehavior {
  PathPattern: string;
  CachePolicyId?: unknown;
  OriginRequestPolicyId?: unknown;
  AllowedMethods?: string[];
}

describe('FrontendStack', () => {
  let template: Template;
  let nagViolations: string[];

  beforeAll(() => {
    const { app, outdir } = createApp();
    const certificateStack = new CertificateStack(app, 'Prod-Certificate', {
      env: { ...env, region: CLOUDFRONT_CERTIFICATE_REGION },
      stage,
    });
    const stack = new FrontendStack(app, 'Prod-Frontend', {
      env,
      stage,
      webDistPath: fakeWebDist(),
      certificate: certificateStack.certificate,
    });
    stack.addApiBehavior('/api/catalog/*', new HttpOrigin('catalog.example.com'));
    nagViolations = synthAndCollectNagViolations(app, outdir);
    template = Template.fromStack(stack);
  });

  function behaviors(): CacheBehavior[] {
    const [distribution] = Object.values(
      template.findResources('AWS::CloudFront::Distribution'),
    ) as { Properties: { DistributionConfig: { CacheBehaviors: CacheBehavior[] } } }[];
    return distribution?.Properties.DistributionConfig.CacheBehaviors ?? [];
  }

  const behavior = (path: string) => behaviors().find((b) => b.PathPattern === path);

  it('keeps the bucket private and reachable only through CloudFront (OAC)', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
    template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Allow',
            Principal: { Service: 'cloudfront.amazonaws.com' },
            Action: 's3:GetObject',
          }),
        ]),
      },
    });
  });

  it('rewrites client-side routes to index.html with a viewer-request function', () => {
    template.hasResourceProperties('AWS::CloudFront::Function', {
      FunctionConfig: Match.objectLike({ Runtime: 'cloudfront-js-2.0' }),
      FunctionCode: Match.stringLikeRegexp("request.uri = '/index.html'"),
    });
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: 'index.html',
        PriceClass: 'PriceClass_100',
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: 'redirect-to-https',
          FunctionAssociations: [Match.objectLike({ EventType: 'viewer-request' })],
        }),
      }),
    });
  });

  it('does not use error responses, so API errors are never replaced by index.html', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({ CustomErrorResponses: Match.absent() }),
    });
  });

  it('caches hashed assets long, config.json not at all and index.html only on revalidation', () => {
    expect(behavior('/assets/*')?.CachePolicyId).toBe(CACHING_OPTIMIZED);
    expect(behavior('/config.json')?.CachePolicyId).toBe(CACHING_DISABLED);
    template.hasResourceProperties('AWS::CloudFront::CachePolicy', {
      CachePolicyConfig: Match.objectLike({ MinTTL: 0, DefaultTTL: 0 }),
    });
  });

  it('deploys assets as immutable and index.html plus config.json as no-cache', () => {
    template.hasResourceProperties('Custom::CDKBucketDeployment', {
      Include: ['assets/*'],
      Exclude: ['*'],
      Prune: false,
      SystemMetadata: { 'cache-control': 'public, max-age=31536000, immutable' },
    });
    template.hasResourceProperties('Custom::CDKBucketDeployment', {
      Exclude: ['assets/*'],
      Prune: false,
      SystemMetadata: { 'cache-control': 'no-cache' },
      DistributionPaths: ['/index.html', '/config.json'],
    });
  });

  it('builds config.json from the SSM parameters of the shared stack', () => {
    template.hasParameter('*', {
      Type: 'AWS::SSM::Parameter::Value<String>',
      Default: '/hochbeet/prod/shared/user-pool-id',
    });
    template.hasParameter('*', {
      Type: 'AWS::SSM::Parameter::Value<String>',
      Default: '/hochbeet/prod/shared/user-pool-client-id',
    });
    const deployments = JSON.stringify(template.findResources('Custom::CDKBucketDeployment'));
    expect(deployments).toContain('SsmParameterValuehochbeetprodshareduserpoolid');
    expect(deployments).toContain('SsmParameterValuehochbeetprodshareduserpoolclientid');
  });

  it('routes API paths with Authorization header and without caching', () => {
    const api = behavior('/api/catalog/*');
    expect(api?.CachePolicyId).toBe(CACHING_DISABLED);
    expect(api?.OriginRequestPolicyId).toBe(ALL_VIEWER_EXCEPT_HOST_HEADER);
    expect(api?.AllowedMethods).toContain('POST');
  });

  it('serves the app under its own domain with TLS 1.2 or newer', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Aliases: ['hochbeet.andi-john-dev.de'],
        ViewerCertificate: Match.objectLike({
          MinimumProtocolVersion: 'TLSv1.2_2021',
          SslSupportMethod: 'sni-only',
        }),
      }),
    });
  });

  it('points A and AAAA alias records of the hosted zone at CloudFront', () => {
    for (const type of ['A', 'AAAA']) {
      template.hasResourceProperties('AWS::Route53::RecordSet', {
        Name: 'hochbeet.andi-john-dev.de.',
        Type: type,
        HostedZoneId: 'Z024045030QTTBYY772I9',
        AliasTarget: Match.objectLike({ HostedZoneId: Match.anyValue() }),
      });
    }
  });

  it('outputs the app URL for the smoke tests', () => {
    template.hasOutput('Url', { Value: 'https://hochbeet.andi-john-dev.de' });
  });

  it('has no unacknowledged cdk-nag AwsSolutions findings', () => {
    expect(nagViolations).toEqual([]);
  });
});
