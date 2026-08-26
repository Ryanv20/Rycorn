import { describe, it, expect } from 'vitest';
import { CompatibilityChecker } from '../../src/routing/CompatibilityChecker';
import { NetworkEdge, EdgeId } from '../../src/domain/network/NetworkEdge';
import { VesselCapability } from '../../src/domain/network/VesselCapability';
import { NodeId } from '../../src/domain/nodes/GeographicNode';

describe('CompatibilityChecker', () => {
  const edge: NetworkEdge = {
    id: 'e1' as EdgeId,
    fromNodeId: 'n1' as NodeId,
    toNodeId: 'n2' as NodeId,
    distanceKm: 10,
    minimumVesselCapability: VesselCapability.C
  };

  it('rejects vessels below minimum capability', () => {
    expect(CompatibilityChecker.isEdgeCompatible(edge, VesselCapability.A)).toBe(false);
    expect(CompatibilityChecker.isEdgeCompatible(edge, VesselCapability.B)).toBe(false);
  });

  it('accepts vessels at or above minimum capability', () => {
    expect(CompatibilityChecker.isEdgeCompatible(edge, VesselCapability.C)).toBe(true);
    expect(CompatibilityChecker.isEdgeCompatible(edge, VesselCapability.D)).toBe(true);
    expect(CompatibilityChecker.isEdgeCompatible(edge, VesselCapability.E)).toBe(true);
  });
});
