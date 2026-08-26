import { describe, it, expect } from 'vitest';
import { PortCapacityPolicy } from '../../src/operations/policies/PortCapacityPolicy';

describe('PortCapacityPolicy', () => {
  it('tracks berth occupancy and restricts entry', () => {
    const policy = new PortCapacityPolicy();
    const config = { defaultBerths: 1 };
    
    expect(policy.canEnterPort('port-1', config)).toBe(true);
    policy.vesselEntered('port-1');
    
    // port with 1 berth — second vessel must wait
    expect(policy.canEnterPort('port-1', config)).toBe(false);
    
    // vessel departs, next can enter
    policy.vesselDeparted('port-1');
    expect(policy.canEnterPort('port-1', config)).toBe(true);
  });
});
