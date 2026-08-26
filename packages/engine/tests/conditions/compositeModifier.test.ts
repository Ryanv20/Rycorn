import { describe, it, expect } from 'vitest';
import { CompositeMovementModifier } from '../../src/conditions/CompositeMovementModifier';
import { MovementModifier } from '../../src/conditions/ConditionModel';

class MockModifier implements MovementModifier {
  constructor(private multiplier: number) {}
  getSpeedMultiplier(from: string, to: string, time: number): number {
    return this.multiplier;
  }
}

describe('CompositeMovementModifier', () => {
  it('multiplies multiple modifiers correctly', () => {
    const comp = new CompositeMovementModifier([
      new MockModifier(0.8),
      new MockModifier(0.9)
    ]);
    
    expect(comp.getSpeedMultiplier('a', 'b', 10)).toBeCloseTo(0.72);
  });

  it('returns 1.0 if no modifiers', () => {
    const comp = new CompositeMovementModifier([]);
    expect(comp.getSpeedMultiplier('a', 'b', 10)).toBe(1.0);
  });
});
