import { Stack, type StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';
import type { StageConfig } from '../config/stages';

export interface CertificateStackProps extends StackProps {
  readonly stage: StageConfig;
}

/** TLS certificate for the app domain. Deployed to us-east-1, where CloudFront expects it. */
export class CertificateStack extends Stack {
  readonly certificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, { crossRegionReferences: true, ...props });
    const { domain } = props.stage;

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: domain.hostedZoneId,
      zoneName: domain.hostedZoneName,
    });

    // DNS validation writes the CNAME into the hosted zone and renews automatically.
    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: domain.name,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });
  }
}
