import { describe, it, expect } from 'vitest';
import { NetworkValidator } from '../../src/network/NetworkValidator';
import { MaritimeNetwork } from '../../src/domain/network/MaritimeNetwork';
import { NodeId } from '../../src/domain/nodes/GeographicNode';
import { EdgeId, NetworkEdge } from '../../src/domain/network/NetworkEdge';
import { VesselCapability } from '../../src/domain/network/VesselCapability';
import { NetworkNode } from '../../src/domain/network/NetworkNode';

describe('NetworkValidator', () => {
  it('catches orphan edges', () => {
    const net = new MaritimeNetwork(new Map(), new Map(), new Map());
    const edge: NetworkEdge = {
      id: 'e1' as EdgeId,
      fromNodeId: 'n1' as NodeId,
      toNodeId: 'n2' as NodeId,
      distanceKm: 10,
      minimumVesselCapability: VesselCapability.A
    };
    net.edges.set(edge.id, edge);
    const errors = NetworkValidator.validate(net);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Orphan edge');
  });

  it('passes valid network', () => {
    const net = new MaritimeNetwork();
    const n1: NetworkNode = { id: 'n1' as NodeId, type: 'PORT', position: { latitude:0, longitude:0 }};
    const n2: NetworkNode = { id: 'n2' as NodeId, type: 'PORT', position: { latitude:1, longitude:1 }};
    net.nodes.set(n1.id, n1);
    net.nodes.set(n2.id, n2);
    
    const edge: NetworkEdge = {
      id: 'e1' as EdgeId,
      fromNodeId: 'n1' as NodeId,
      toNodeId: 'n2' as NodeId,
      distanceKm: 10,
      minimumVesselCapability: VesselCapability.A
    };
    net.edges.set(edge.id, edge);
    
    const errors = NetworkValidator.validate(net);
    expect(errors.length).toBe(0);
  });
});
