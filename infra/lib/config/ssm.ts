import type { StageConfig } from './stages';

/** SSM parameter names used to pass values between stacks instead of CloudFormation exports. */
export const ssmParameters = (stage: StageConfig) => ({
  userPoolId: `/hochbeet/${stage.name}/shared/user-pool-id`,
  userPoolClientId: `/hochbeet/${stage.name}/shared/user-pool-client-id`,
});
