export interface StageConfig {
  readonly name: string;
  readonly region: string;
}

/** Deployment stages. Only `prod` for now; `dev` can be added later. */
export const stages: readonly StageConfig[] = [{ name: 'prod', region: 'eu-central-1' }];
