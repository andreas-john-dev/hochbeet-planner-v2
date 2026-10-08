import { describe, expect, it } from 'vitest';
import { evaluateBed } from './engine';
import { bed, plantings, plants } from './engine.perf.fixture';

describe('rule engine performance', () => {
  it('evaluates 200 plantings in under 50 ms', () => {
    // Warm up the JIT, then take the median of several runs to smooth out CI noise.
    for (let i = 0; i < 3; i++) evaluateBed(bed, plantings, plants);
    const durations = Array.from({ length: 9 }, () => {
      const start = performance.now();
      evaluateBed(bed, plantings, plants);
      return performance.now() - start;
    }).sort((a, b) => a - b);
    const median = durations[4] ?? Infinity;

    expect(evaluateBed(bed, plantings, plants).length).toBeGreaterThan(0); // the scenario is not trivial
    console.info(`evaluateBed: 200 plantings, median ${median.toFixed(1)} ms`);
    expect(median, `median ${median.toFixed(1)} ms`).toBeLessThan(50);
  });
});
