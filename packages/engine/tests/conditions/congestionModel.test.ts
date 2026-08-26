import { describe, it, expect } from 'vitest';
import { CongestionModel } from '../../src/conditions/models/CongestionModel';

describe('CongestionModel', () => {
  it('returns 0.9 during peak hours', () => {
    const model = new CongestionModel();
    expect(model.getSpeedMultiplier('a', 'b', 10)).toBe(0.9);
    expect(model.getSpeedMultiplier('a', 'b', 34)).toBe(0.9); // 34 % 24 = 10
  });

  it('returns 1.0 during off-peak hours', () => {
    const model = new CongestionModel();
    expect(model.getSpeedMultiplier('a', 'b', 2)).toBe(1.0);
    expect(model.getSpeedMultiplier('a', 'b', 20)).toBe(1.0);
  });
});
