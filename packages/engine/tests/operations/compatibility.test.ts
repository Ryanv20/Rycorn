import { describe, it, expect } from 'vitest';
import { CargoCompatibilityPolicy } from '../../src/operations/policies/CargoCompatibilityPolicy';
import { VesselCapability } from '../../src/domain/network/VesselCapability';

describe('CargoCompatibilityPolicy', () => {
  it('all combinations return true (Phase 8 stub)', () => {
    const policy = new CargoCompatibilityPolicy();
    expect(policy.isCompatible('GENERAL', VesselCapability.A)).toBe(true);
    expect(policy.isCompatible('BULK', VesselCapability.E)).toBe(true);
  });
});
