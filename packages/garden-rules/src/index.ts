export * from './geometry';
export * from './time';
export * from './findings';
export * from './context';
export { spacingRule } from './rules/spacing';
export { bedEdgeRule } from './rules/bed-edge';

/** Radius in cm within which neighbour and heavy-feeder rules apply. */
export const INFLUENCE_RADIUS_CM = 30;
