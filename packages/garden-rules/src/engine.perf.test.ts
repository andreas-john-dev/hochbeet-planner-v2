import { describe, expect, it } from 'vitest';
import { evaluateBed } from './engine';
import { bed, plantings, plants, sowings } from './engine.perf.fixture';

/** Median CPU time of several runs after a warm-up, in ms. */
function medianMs(run: () => unknown): number {
  // Warm up the JIT, then take the median of several runs. CPU time of this process instead
  // of wall-clock time: Turborepo runs other test suites in parallel on the same cores.
  for (let i = 0; i < 3; i++) run();
  const durations = Array.from({ length: 9 }, () => {
    const start = process.cpuUsage();
    run();
    const { user, system } = process.cpuUsage(start);
    return (user + system) / 1000;
  }).sort((a, b) => a - b);
  return durations[4] ?? Infinity;
}

describe('rule engine performance', () => {
  it('evaluates 200 plantings in under 50 ms', () => {
    const median = medianMs(() => evaluateBed(bed, plantings, plants));
    expect(evaluateBed(bed, plantings, plants).length).toBeGreaterThan(0); // the scenario is not trivial
    console.info(`evaluateBed: 200 plantings, median ${median.toFixed(1)} ms`);
    expect(median, `median ${median.toFixed(1)} ms`).toBeLessThan(50);
  });

  it('stays under 50 ms with sowing batches linked to the plantings', () => {
    const options = { sowings };
    const median = medianMs(() => evaluateBed(bed, plantings, plants, options));
    const findings = evaluateBed(bed, plantings, plants, options);
    expect(findings.some((f) => f.rule === 'TRANSPLANT_EARLY')).toBe(true);
    console.info(`evaluateBed with sowings: 200 plantings, median ${median.toFixed(1)} ms`);
    expect(median, `median ${median.toFixed(1)} ms`).toBeLessThan(50);
  });
});
