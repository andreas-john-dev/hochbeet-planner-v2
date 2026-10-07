import { Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { CLOUDFRONT_CERTIFICATE_REGION } from '../lib/config/stages';
import { CertificateStack } from '../lib/frontend/CertificateStack';
import { createApp, env, stage, synthAndCollectNagViolations } from './helpers';

describe('CertificateStack', () => {
  let stack: CertificateStack;
  let template: Template;
  let nagViolations: string[];

  beforeAll(() => {
    const { app, outdir } = createApp();
    stack = new CertificateStack(app, 'Prod-Certificate', {
      env: { ...env, region: CLOUDFRONT_CERTIFICATE_REGION },
      stage,
    });
    nagViolations = synthAndCollectNagViolations(app, outdir);
    template = Template.fromStack(stack);
  });

  it('lives in us-east-1, where CloudFront expects certificates', () => {
    expect(stack.region).toBe('us-east-1');
  });

  it('requests a DNS-validated certificate for the app domain in the hosted zone', () => {
    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'hochbeet.andi-john-dev.de',
      ValidationMethod: 'DNS',
      DomainValidationOptions: [
        { DomainName: 'hochbeet.andi-john-dev.de', HostedZoneId: 'Z024045030QTTBYY772I9' },
      ],
    });
  });

  it('has no unacknowledged cdk-nag AwsSolutions findings', () => {
    expect(nagViolations).toEqual([]);
  });
});
