import { describe, it, expect } from 'vitest';
import { SimulationClock } from '../../src/simulation/SimulationClock';

describe('SimulationClock', () => {
  it('advances correctly', () => {
    const clock = new SimulationClock();
    expect(clock.getTime()).toBe(0);
    clock.advance(5);
    expect(clock.getTime()).toBe(5);
    clock.advance(2.5);
    expect(clock.getTime()).toBe(7.5);
  });

  it('resets correctly', () => {
    const clock = new SimulationClock();
    clock.advance(10);
    clock.reset();
    expect(clock.getTime()).toBe(0);
  });
});
