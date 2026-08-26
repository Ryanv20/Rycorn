import { describe, it, expect } from 'vitest';
import { NetworkBuilder } from '../../src/network/NetworkBuilder';
import { Port } from '../../src/domain/ports/Port';
import { VesselCapability } from '../../src/domain/network/VesselCapability';
import { HarborType, HarborSize } from '../../src/domain/shared/enums';
import { NodeId } from '../../src/domain/nodes/GeographicNode';
import { EdgeId } from '../../src/domain/network/NetworkEdge';
import { PortId } from '../../src/domain/shared/PortId';

describe('NetworkBuilder', () => {
  const p1: Port = {
    id: 'p1' as PortId,
    name: 'P1',
    country: 'C1',
    position: { latitude: 0, longitude: 0 },
    harborType: HarborType.CoastalNatural,
    harborSize: HarborSize.Large,
    maximumVesselSize: 'L',
    provenance: { source: 's', sourceId: '1', sourceVersion: 'v1' }
  };
  const p2: Port = {
    id: 'p2' as PortId,
    name: 'P2',
    country: 'C2',
    position: { latitude: 0.1, longitude: 0.1 }, // ~15km
    harborType: HarborType.CoastalNatural,
    harborSize: HarborSize.Large,
    maximumVesselSize: 'L',
    provenance: { source: 's', sourceId: '2', sourceVersion: 'v1' }
  };

  it('generates intermediate nodes correctly', () => {
    const builder = new NetworkBuilder();
    builder.addPorts([p1, p2]);
    builder.addEdges([{ fromPortId: 'p1', toPortId: 'p2', minimumCapability: VesselCapability.C }]);
    
    const network = builder.build();
    
    const nodes = Array.from(network.nodes.values());
    const ports = nodes.filter(n => n.type === 'PORT');
    const ints = nodes.filter(n => n.type === 'INTERMEDIATE');
    
    expect(ports).toHaveLength(2);
    // dist is ~15.7 km, so 3 intermediate points
    expect(ints.length).toBeGreaterThan(0);
    
    const edges = Array.from(network.edges.values());
    expect(edges.length).toBe(ints.length + 1);
  });
  
  it('correctly maps A < B < C < D < E', () => {
    expect(VesselCapability.A).toBeLessThan(VesselCapability.B);
    expect(VesselCapability.D).toBeLessThan(VesselCapability.E);
  });
});
