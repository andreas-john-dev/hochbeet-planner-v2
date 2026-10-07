export interface DomainConfig {
  /** Fully qualified domain of the app, e.g. `hochbeet.andi-john-dev.de`. */
  readonly name: string;
  /** Existing public Route 53 hosted zone that the domain belongs to. */
  readonly hostedZoneId: string;
  readonly hostedZoneName: string;
}

export interface StageConfig {
  /** Lower-case stage name, used in SSM parameter paths. */
  readonly name: string;
  /** Prefix for CloudFormation stack names, e.g. `Prod-SharedStateful`. */
  readonly stackPrefix: string;
  readonly region: string;
  readonly domain: DomainConfig;
}

/** Deployment stages. Only `prod` for now; `dev` can be added later. */
export const stages: readonly StageConfig[] = [
  {
    name: 'prod',
    stackPrefix: 'Prod',
    region: 'eu-central-1',
    domain: {
      name: 'hochbeet.andi-john-dev.de',
      hostedZoneId: 'Z024045030QTTBYY772I9',
      hostedZoneName: 'andi-john-dev.de',
    },
  },
];

/** CloudFront only accepts ACM certificates from us-east-1. */
export const CLOUDFRONT_CERTIFICATE_REGION = 'us-east-1';
