export interface StageConfig {
  /** Lower-case stage name, used in SSM parameter paths. */
  readonly name: string;
  /** Prefix for CloudFormation stack names, e.g. `Prod-SharedStateful`. */
  readonly stackPrefix: string;
  readonly region: string;
}

/** Deployment stages. Only `prod` for now; `dev` can be added later. */
export const stages: readonly StageConfig[] = [
  { name: 'prod', stackPrefix: 'Prod', region: 'eu-central-1' },
];
