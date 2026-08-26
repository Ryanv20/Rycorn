import { describe, it, expect } from 'vitest';
import { SeededRng } from '../../src/conditions/SeededRng';

describe('SeededRng', () => {
  it('returns same value for same seed and key', () => {
    const rng1 = new SeededRng('seed1');
    const rng2 = new SeededRng('seed1');
    
    expect(rng1.next('key1')).toBe(rng2.next('key1'));
  });

  it('returns different values for different keys', () => {
    const rng = new SeededRng('seed1');
    const val1 = rng.next('key1');
    const val2 = rng.next('key2');
    
    expect(val1).not.toBe(val2);
  });

  it('returns value between 0 and 1', () => {
    const rng = new SeededRng('seed');
    for (let i = 0; i < 100; i++) {
      const val = rng.next('key' + i);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});
