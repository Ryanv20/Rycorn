import { describe, it, expect } from 'vitest';
import { CapacityPolicy } from '../../src/operations/policies/CapacityPolicy';
import { VesselCapability } from '../../src/domain/network/VesselCapability';

describe('CapacityPolicy', () => {
  const config = {
    [VesselCapability.A]: 100,
    [VesselCapability.B]: 500,
    [VesselCapability.C]: 2000,
    [VesselCapability.D]: 10000,
    [VesselCapability.E]: 50000
  };
  const policy = new CapacityPolicy(config);

  it('canAccept: vessel under capacity -> true', () => {
    expect(policy.canAccept(VesselCapability.A, 50, 40)).toBe(true);
  });

  it('canAccept: vessel at capacity -> false', () => {
    expect(policy.canAccept(VesselCapability.A, 80, 30)).toBe(false);
  });

  it('remainingCapacity correctly calculated', () => {
    expect(policy.remainingCapacity(VesselCapability.B, 100)).toBe(400);
  });
});
