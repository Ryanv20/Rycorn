import { describe, it, expect } from 'vitest';
import { MovementCalculator } from '../../src/movement/MovementCalculator';
import { VesselCapability } from '../../src/domain/network/VesselCapability';
import { RouteResultFound } from '../../src/routing/Router';
import { NodeId } from '../../src/domain/nodes/GeographicNode';

describe('MovementCalculator', () => {
  it('calculates deterministic travel duration', () => {
    const calc = new MovementCalculator();
    
    const route: RouteResultFound = {
      found: true,
      path: ['n1' as NodeId, 'n2' as NodeId],
      edges: [],
      totalDistanceKm: 18.52 // exactly 10 nautical miles
    };

    // Class B nominal speed is 10 knots. So 10 NM takes 1 hour.
    const res = calc.calculate(route, VesselCapability.B);
    
    expect(res.distanceKm).toBe(18.52);
    expect(res.durationHours).toBeCloseTo(1.0, 3);
  });
});
