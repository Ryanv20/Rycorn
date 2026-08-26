import { describe, it, expect } from 'vitest';
import { WeatherModel } from '../../src/conditions/models/WeatherModel';
import { SeededRng } from '../../src/conditions/SeededRng';

describe('WeatherModel', () => {
  it('returns multiplier between (1 - maxImpact) and 1.0', () => {
    const model = new WeatherModel(new SeededRng('seed'), 0.3);
    const multiplier = model.getSpeedMultiplier('node1', 'node2', 10);
    
    expect(multiplier).toBeGreaterThanOrEqual(0.7);
    expect(multiplier).toBeLessThanOrEqual(1.0);
  });

  it('is deterministic', () => {
    const model1 = new WeatherModel(new SeededRng('seed'), 0.3);
    const model2 = new WeatherModel(new SeededRng('seed'), 0.3);
    
    expect(model1.getSpeedMultiplier('a', 'b', 5)).toBe(model2.getSpeedMultiplier('a', 'b', 5));
  });
});
