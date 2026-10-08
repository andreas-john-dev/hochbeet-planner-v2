import { defineProject } from 'vitest/config';

// Synth with esbuild bundling of the Lambdas takes a few seconds, more when other suites run.
export default defineProject({ test: { name: 'infra', hookTimeout: 60_000 } });
