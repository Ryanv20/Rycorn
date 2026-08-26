const fs = require('fs');
const path = require('path');

const write = (filepath, content) => {
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, content.trim() + '\n');
};

const base = 'c:/Users/Owner/Desktop/Projects/project_e';

// Phase 3 files

write(`${base}/src/domain/network/VesselCapability.ts`, `
export enum VesselCapability {
  A = 0,
  B = 1,
  C = 2,
  D = 3,
  E = 4,
}
`);

write(`${base}/src/domain/network/NetworkNode.ts`, `
import { GeoPosition } from '../shared/GeoPosition';
import { NodeId } from '../nodes/GeographicNode';
import { PortId } from '../shared/PortId';

export interface NetworkNode {
  id: NodeId;
  type: 'PORT' | 'INTERMEDIATE';
  position: GeoPosition;
  portId?: PortId;
}
`);

write(`${base}/src/domain/network/NetworkEdge.ts`, `
import { NodeId } from '../nodes/GeographicNode';
import { VesselCapability } from './VesselCapability';

export type EdgeId = string & { readonly __brand: unique symbol };

export interface NetworkEdge {
  id: EdgeId;
  fromNodeId: NodeId;
  toNodeId: NodeId;
  distanceKm: number;
  minimumVesselCapability: VesselCapability;
}
`);

write(`${base}/src/domain/network/MaritimeNetwork.ts`, `
import { NetworkNode } from './NetworkNode';
import { NetworkEdge, EdgeId } from './NetworkEdge';
import { NodeId } from '../nodes/GeographicNode';

export class MaritimeNetwork {
  nodes: Map<NodeId, NetworkNode>;
  edges: Map<EdgeId, NetworkEdge>;
  adjacency: Map<NodeId, EdgeId[]>;

  constructor(
    nodes: Map<NodeId, NetworkNode> = new Map(),
    edges: Map<EdgeId, NetworkEdge> = new Map(),
    adjacency: Map<NodeId, EdgeId[]> = new Map()
  ) {
    this.nodes = nodes;
    this.edges = edges;
    this.adjacency = adjacency;
  }

  getNode(id: NodeId): NetworkNode | undefined {
    return this.nodes.get(id);
  }

  getEdgesFrom(nodeId: NodeId): NetworkEdge[] {
    const edgeIds = this.adjacency.get(nodeId) || [];
    return edgeIds.map(id => this.edges.get(id)!).filter(Boolean);
  }

  hasPath(fromId: NodeId, toId: NodeId): boolean {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return false;
    if (fromId === toId) return true;

    const visited = new Set<NodeId>([fromId]);
    const queue: NodeId[] = [fromId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === toId) return true;

      const edges = this.getEdgesFrom(current);
      for (const edge of edges) {
        const nextId = edge.toNodeId;
        if (!visited.has(nextId)) {
          visited.add(nextId);
          queue.push(nextId);
        }
      }
    }
    return false;
  }
}
`);

write(`${base}/src/network/IntermediateNodeGenerator.ts`, `
import { GeoPosition } from '../domain/shared/GeoPosition';
import { distance } from '@turf/turf';
import { point } from '@turf/helpers';

export class IntermediateNodeGenerator {
  static calculateDistanceKm(p1: GeoPosition, p2: GeoPosition): number {
    return distance(
      point([p1.longitude, p1.latitude]),
      point([p2.longitude, p2.latitude]),
      { units: 'kilometers' }
    );
  }

  static generate(p1: GeoPosition, p2: GeoPosition, intervalKm: number = 5): GeoPosition[] {
    const dist = this.calculateDistanceKm(p1, p2);
    if (dist <= intervalKm) return [];
    
    const count = Math.floor(dist / intervalKm);
    const intermediates: GeoPosition[] = [];
    
    for (let i = 1; i <= count; i++) {
      const fraction = (i * intervalKm) / dist;
      const lat = p1.latitude + (p2.latitude - p1.latitude) * fraction;
      const lon = p1.longitude + (p2.longitude - p1.longitude) * fraction;
      intermediates.push({ latitude: lat, longitude: lon });
    }
    return intermediates;
  }
}
`);

write(`${base}/src/network/NetworkValidator.ts`, `
import { MaritimeNetwork } from '../domain/network/MaritimeNetwork';

export class NetworkValidator {
  static validate(network: MaritimeNetwork): string[] {
    const errors: string[] = [];
    const nodeIds = new Set(network.nodes.keys());
    const edgeIds = new Set<string>();

    for (const [id, edge] of network.edges.entries()) {
      if (edgeIds.has(id)) {
        errors.push(\`Duplicate edge ID: \${id}\`);
      }
      edgeIds.add(id);

      if (!nodeIds.has(edge.fromNodeId)) {
        errors.push(\`Orphan edge \${id}: missing fromNode \${edge.fromNodeId}\`);
      }
      if (!nodeIds.has(edge.toNodeId)) {
        errors.push(\`Orphan edge \${id}: missing toNode \${edge.toNodeId}\`);
      }
      if (edge.distanceKm <= 0) {
        errors.push(\`Edge \${id} distance must be positive, got \${edge.distanceKm}\`);
      }
    }
    return errors;
  }
}
`);

write(`${base}/src/network/NetworkBuilder.ts`, `
import { Port } from '../domain/ports/Port';
import { NetworkNode } from '../domain/network/NetworkNode';
import { NetworkEdge, EdgeId } from '../domain/network/NetworkEdge';
import { MaritimeNetwork } from '../domain/network/MaritimeNetwork';
import { VesselCapability } from '../domain/network/VesselCapability';
import { IntermediateNodeGenerator } from './IntermediateNodeGenerator';
import { NodeId } from '../domain/nodes/GeographicNode';

export interface EdgeDefinition {
  fromPortId: string;
  toPortId: string;
  minimumCapability: VesselCapability;
}

export class NetworkBuilder {
  private nodes = new Map<NodeId, NetworkNode>();
  private edges = new Map<EdgeId, NetworkEdge>();
  private adjacency = new Map<NodeId, EdgeId[]>();
  private intermediateCount = 0;

  addPorts(ports: Port[]) {
    for (const port of ports) {
      const nodeId = \`node-\${port.id}\` as NodeId;
      this.nodes.set(nodeId, {
        id: nodeId,
        type: 'PORT',
        position: port.position,
        portId: port.id
      });
    }
  }

  addEdges(definitions: EdgeDefinition[]) {
    for (const def of definitions) {
      const fromNodeId = \`node-\${def.fromPortId}\` as NodeId;
      const toNodeId = \`node-\${def.toPortId}\` as NodeId;
      
      const fromNode = this.nodes.get(fromNodeId);
      const toNode = this.nodes.get(toNodeId);
      
      if (!fromNode || !toNode) {
        throw new Error("Edge endpoints must reference existing nodes");
      }

      const intermediates = IntermediateNodeGenerator.generate(fromNode.position, toNode.position);
      
      let currentId = fromNodeId;
      for (let i = 0; i < intermediates.length; i++) {
        const nextId = \`int-\${++this.intermediateCount}\` as NodeId;
        this.nodes.set(nextId, {
          id: nextId,
          type: 'INTERMEDIATE',
          position: intermediates[i]
        });
        
        this.createEdge(currentId, nextId, def.minimumCapability);
        currentId = nextId;
      }
      this.createEdge(currentId, toNodeId, def.minimumCapability);
    }
  }

  private createEdge(from: NodeId, to: NodeId, cap: VesselCapability) {
    const fromNode = this.nodes.get(from)!;
    const toNode = this.nodes.get(to)!;
    const dist = IntermediateNodeGenerator.calculateDistanceKm(fromNode.position, toNode.position);
    
    const edgeId = \`edge-\${from}-\${to}\` as EdgeId;
    
    if (this.edges.has(edgeId)) {
        return; // skip duplicate
    }
    
    const edge: NetworkEdge = {
      id: edgeId,
      fromNodeId: from,
      toNodeId: to,
      distanceKm: dist,
      minimumVesselCapability: cap
    };
    
    this.edges.set(edgeId, edge);
    
    const adjs = this.adjacency.get(from) || [];
    adjs.push(edgeId);
    this.adjacency.set(from, adjs);
  }

  build(): MaritimeNetwork {
    return new MaritimeNetwork(this.nodes, this.edges, this.adjacency);
  }
}
`);

write(`${base}/tests/network/networkBuilder.test.ts`, `
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
`);

write(`${base}/tests/network/networkValidator.test.ts`, `
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
`);
console.log("Phase 3 files generated");
