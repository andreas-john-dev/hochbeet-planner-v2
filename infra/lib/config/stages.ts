export interface DomainConfig {
  /** Fully qualified domain of the app, e.g. `hochbeet.andi-john-dev.de`. */
  readonly name: string;
  /** Existing public Route 53 hosted zone that the domain belongs to. */
  readonly hostedZoneId: string;
  readonly hostedZoneName: string;
}

export interface AssistantConfig {
  /** Inference profile the agent calls (EU cross-region), e.g. `eu.anthropic.claude-…`. */
  readonly modelId: string;
  /** Foundation model behind the profile; the profile routes to it in several EU regions. */
  readonly foundationModelId: string;
  /** Questions per user and day (Europe/Berlin); the hard cost limit. */
  readonly dailyMessageLimit: number;
  /** Output tokens per answer. */
  readonly maxTokens: number;
  /** Cognito groups that may use the assistant; the runtime's authorizer checks them. */
  readonly allowedGroups: readonly string[];
}

export interface StageConfig {
  /** Lower-case stage name, used in SSM parameter paths. */
  readonly name: string;
  /** Prefix for CloudFormation stack names, e.g. `Prod-SharedStateful`. */
  readonly stackPrefix: string;
  readonly region: string;
  readonly domain: DomainConfig;
  /**
   * Email of the user the smoke tests sign in with after each deploy (T-34). It is created
   * only when the deploy passes a password (GitHub secret SMOKE_USER_PASSWORD).
   */
  readonly smokeUserEmail: string;
  /** Beet-Assistent on Bedrock AgentCore (Epic #89). */
  readonly assistant: AssistantConfig;
  /** Monthly AWS budget of the whole account in USD; alerts at 80 % and 100 %. */
  readonly monthlyBudgetUsd: number;
}

/** Group of users who may try the assistant; admins may too. */
export const AI_TESTERS_GROUP = 'ai-testers';

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
    smokeUserEmail: 'smoke-test@hochbeet.andi-john-dev.de',
    assistant: {
      modelId: 'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
      foundationModelId: 'anthropic.claude-haiku-4-5-20251001-v1:0',
      dailyMessageLimit: 20,
      maxTokens: 1024,
      allowedGroups: [AI_TESTERS_GROUP, 'admins'],
    },
    monthlyBudgetUsd: 10,
  },
];

/** CloudFront only accepts ACM certificates from us-east-1. */
export const CLOUDFRONT_CERTIFICATE_REGION = 'us-east-1';
