import { readFileSync } from 'node:fs';
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
  Token,
  Validations,
} from 'aws-cdk-lib';
import type * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import { ssmParameters } from '../config/ssm';
import type { StageConfig } from '../config/stages';

export interface FrontendStackProps extends StackProps {
  readonly stage: StageConfig;
  /** Directory with the Vite build of apps/web. */
  readonly webDistPath: string;
  /** Certificate for `stage.domain.name`, issued in us-east-1 (see CertificateStack). */
  readonly certificate: acm.ICertificate;
}

/** Runtime configuration read by the SPA at start-up. */
export interface WebConfig {
  readonly region: string;
  readonly userPoolId: string;
  readonly userPoolClientId: string;
}

const SPA_REWRITE_CODE = readFileSync(new URL('./spa-rewrite.js', import.meta.url), 'utf8');

/** Private S3 bucket behind CloudFront that serves the SPA, its config and later the APIs. */
export class FrontendStack extends Stack {
  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    // The certificate comes from the us-east-1 CertificateStack.
    super(scope, id, { crossRegionReferences: true, ...props });
    const { domain } = props.stage;

    // Stateless: the content is rebuilt on every deployment.
    this.bucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(this.bucket);

    const spaRewrite = new cloudfront.Function(this, 'SpaRewrite', {
      code: cloudfront.FunctionCode.fromInline(SPA_REWRITE_CODE),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      comment: 'Serve index.html for client-side routes',
    });

    // index.html carries `no-cache`, so CloudFront revalidates it on every request.
    const htmlCachePolicy = new cloudfront.CachePolicy(this, 'HtmlCachePolicy', {
      comment: 'Honour origin Cache-Control; nothing cached by default',
      minTtl: Duration.seconds(0),
      defaultTtl: Duration.seconds(0),
      maxTtl: Duration.days(365),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `Hochbeet-Planer ${props.stage.name}`,
      defaultRootObject: 'index.html',
      domainNames: [domain.name],
      certificate: props.certificate,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: htmlCachePolicy,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        functionAssociations: [
          { function: spaRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },
      additionalBehaviors: {
        // Vite assets have a content hash in their name.
        '/assets/*': {
          origin: s3Origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        },
        '/config.json': {
          origin: s3Origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        },
      },
    });

    const names = ssmParameters(props.stage);
    const config: WebConfig = {
      region: props.stage.region,
      userPoolId: ssm.StringParameter.valueForStringParameter(this, names.userPoolId),
      userPoolClientId: ssm.StringParameter.valueForStringParameter(this, names.userPoolClientId),
    };

    // Two deployments with different Cache-Control. No pruning, so assets of the previous
    // build stay available for browsers that still have the old index.html.
    new s3deploy.BucketDeployment(this, 'DeployAssets', {
      destinationBucket: this.bucket,
      sources: [s3deploy.Source.asset(props.webDistPath)],
      include: ['assets/*'],
      exclude: ['*'],
      prune: false,
      cacheControl: [s3deploy.CacheControl.fromString('public, max-age=31536000, immutable')],
    });
    new s3deploy.BucketDeployment(this, 'DeployHtmlAndConfig', {
      destinationBucket: this.bucket,
      sources: [
        s3deploy.Source.asset(props.webDistPath, { exclude: ['assets/*'] }),
        s3deploy.Source.jsonData('config.json', config),
      ],
      exclude: ['assets/*'],
      prune: false,
      cacheControl: [s3deploy.CacheControl.fromString('no-cache')],
      distribution: this.distribution,
      distributionPaths: ['/index.html', '/config.json'],
    });

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: domain.hostedZoneId,
      zoneName: domain.hostedZoneName,
    });
    const target = route53.RecordTarget.fromAlias(
      new route53Targets.CloudFrontTarget(this.distribution),
    );
    new route53.ARecord(this, 'AliasRecord', { zone: hostedZone, recordName: domain.name, target });
    new route53.AaaaRecord(this, 'AliasRecordIpv6', {
      zone: hostedZone,
      recordName: domain.name,
      target,
    });

    // Read by the deploy workflow to run the smoke tests.
    new CfnOutput(this, 'Url', {
      key: 'Url',
      value: `https://${domain.name}`,
      description: 'Public URL of the app',
    });

    this.acknowledgeNagFindings();
  }

  /**
   * Prepared hook for T-18/T-21: routes `/api/<service>/*` to a service's HTTP API.
   * Forwards all viewer headers except Host (incl. Authorization) and never caches.
   */
  addApiBehavior(pathPattern: '/api/catalog/*' | '/api/garden/*', origin: cloudfront.IOrigin) {
    this.distribution.addBehavior(pathPattern, origin, {
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
    });
  }

  /**
   * Routes a public, read-only API path (e.g. `/api/catalog/public/*`) and caches it for at
   * most `maxAge`, honouring a shorter `Cache-Control` of the origin. No viewer headers,
   * cookies or query strings reach the origin or the cache key, so every guest shares one
   * cached copy. Call it before `addApiBehavior` of the same service: CloudFront takes the
   * first matching behavior.
   */
  addPublicApiBehavior(
    pathPattern: '/api/catalog/public/*',
    origin: cloudfront.IOrigin,
    maxAge: Duration,
  ) {
    this.distribution.addBehavior(pathPattern, origin, {
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      cachePolicy: new cloudfront.CachePolicy(this, 'PublicApiCachePolicy', {
        comment: 'Public API reads: shared cache for a few minutes',
        minTtl: Duration.seconds(0),
        defaultTtl: maxAge,
        maxTtl: maxAge,
        enableAcceptEncodingGzip: true,
        enableAcceptEncodingBrotli: true,
      }),
    });
  }

  /** Accepted cdk-nag findings, documented in docs/architecture.md (section "cdk-nag"). */
  private acknowledgeNagFindings() {
    const ack = (scope: Construct, id: string, reason: string) => {
      Validations.of(scope).acknowledge({ id, reason });
    };

    ack(
      this.bucket,
      'AwsSolutions-S1',
      'Only CloudFront reads the bucket; access logs would add cost without benefit for a hobby app.',
    );
    ack(
      this.distribution,
      'AwsSolutions-CFR1',
      'The app is meant to be usable from anywhere; no geo restriction needed.',
    );
    ack(
      this.distribution,
      'AwsSolutions-CFR2',
      'AWS WAF costs a monthly fee per web ACL; the app should cost close to nothing when idle.',
    );
    ack(
      this.distribution,
      'AwsSolutions-CFR3',
      'Access logs are not needed for a hobby app and would add storage cost.',
    );

    // Singleton Lambda that CDK's BucketDeployment creates and manages.
    const deploymentHandler = this.node.children.find((c) =>
      c.node.id.startsWith('Custom::CDKBucketDeployment'),
    );
    if (!deploymentHandler) throw new Error('BucketDeployment handler not found');
    const cdkManaged =
      'CDK-managed BucketDeployment handler; its role and runtime are set by aws-cdk-lib.';
    const bucketArn = this.resolve(this.bucket.bucketArn) as { 'Fn::GetAtt': [string, string] };
    // cdk-nag renders the CDK bootstrap asset bucket with or without a resolved account and
    // partition, depending on how the app is synthesised (tests, CI, deploy).
    const accounts = Token.isUnresolved(this.account) ? ['<AWS::AccountId>'] : [this.account];
    const assetBucketFindings = ['aws', '<AWS::Partition>'].flatMap((partition) =>
      accounts.map(
        (account) =>
          `AwsSolutions-IAM5[Resource::arn:${partition}:s3:::cdk-hnb659fds-assets-${account}-${this.region}/*]`,
      ),
    );
    for (const id of [
      'AwsSolutions-L1',
      'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
      'AwsSolutions-IAM5[Action::s3:GetBucket*]',
      'AwsSolutions-IAM5[Action::s3:GetObject*]',
      'AwsSolutions-IAM5[Action::s3:List*]',
      'AwsSolutions-IAM5[Action::s3:Abort*]',
      'AwsSolutions-IAM5[Action::s3:DeleteObject*]',
      'AwsSolutions-IAM5[Resource::*]',
      ...assetBucketFindings,
      `AwsSolutions-IAM5[Resource::<${bucketArn['Fn::GetAtt'][0]}.Arn>/*]`,
    ]) {
      ack(deploymentHandler, id, cdkManaged);
    }
  }
}
