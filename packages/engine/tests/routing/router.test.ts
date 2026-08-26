import { describe, it, expect } from 'vitest';
import { Router } from '../../src/routing/Router';
import { MaritimeNetwork } from '../../src/domain/network/MaritimeNetwork';
import { NetworkNode } from '../../src/domain/network/NetworkNode';
import { NetworkEdge, EdgeId } from '../../src/domain/network/NetworkEdge';
import { NodeId } from '../../src/domain/nodes/GeographicNode';
import { VesselCapability } from '../../src/domain/network/VesselCapability';

describe('Router', () => {
  it('finds compatible route and rejects incompatible routes', () => {
    const net = new MaritimeNetwork();
    
    const n1 = { id: 'n1' as NodeId, type: 'PORT' as const, position: { latitude:0, longitude:0 }};
    const n2 = { id: 'n2' as NodeId, type: 'PORT' as const, position: { latitude:1, longitude:1 }};
    const n3 = { id: 'n3' as NodeId, type: 'PORT' as const, position: { latitude:2, longitude:2 }};
    
    net.nodes.set(n1.id, n1);
    net.nodes.set(n2.id, n2);
    net.nodes.set(n3.id, n3);
    
    // n1 -> n2 requires C
    const e1: NetworkEdge = { id: 'e1' as EdgeId, fromNodeId: n1.id, toNodeId: n2.id, distanceKm: 10, minimumVesselCapability: VesselCapability.C };
    // n2 -> n3 requires A
    const e2: NetworkEdge = { id: 'e2' as EdgeId, fromNodeId: n2.id, toNodeId: n3.id, distanceKm: 10, minimumVesselCapability: VesselCapability.A };
    // alternative n1 -> n3 requires A but longer
    const e3: NetworkEdge = { id: 'e3' as EdgeId, fromNodeId: n1.id, toNodeId: n3.id, distanceKm: 50, minimumVesselCapability: VesselCapability.A };
    
    net.edges.set(e1.id, e1);
    net.edges.set(e2.id, e2);
    net.edges.set(e3.id, e3);
    
    net.adjacency.set(n1.id, [e1.id, e3.id]);
    net.adjacency.set(n2.id, [e2.id]);
    net.adjacency.set(n3.id, []);

    const router = new Router(net);
    
    // Class A vessel should take the longer route e3
    const resA = router.findRoute({ origin: n1.id, destination: n3.id, vesselCapability: VesselCapability.A });
    expect(resA.found).toBe(true);
    if (resA.found) {
      expect(resA.totalDistanceKm).toBe(50);
      expect(resA.edges).toEqual(['e3']);
    }

    // Class C vessel should take the shorter route e1 + e2
    const resC = router.findRoute({ origin: n1.id, destination: n3.id, vesselCapability: VesselCapability.C });
    expect(resC.found).toBe(true);
    if (resC.found) {
      expect(resC.totalDistanceKm).toBe(20);
      expect(resC.edges).toEqual(['e1', 'e2']);
    }
    
    // Test no path
    const resNo = router.findRoute({ origin: n3.id, destination: n1.id, vesselCapability: VesselCapability.E });
    expect(resNo.found).toBe(false);
  });
});
