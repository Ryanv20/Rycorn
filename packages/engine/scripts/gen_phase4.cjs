const fs = require('fs');
const path = require('path');

const write = (filepath, content) => {
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, content.trim() + '\n');
};

const base = 'c:/Users/Owner/Desktop/Projects/project_e';

// Phase 4 files

write(`${base}/src/routing/CompatibilityChecker.ts`, `
import { NetworkEdge } from '../domain/network/NetworkEdge';
import { VesselCapability } from '../domain/network/VesselCapability';

export class CompatibilityChecker {
  static isEdgeCompatible(edge: NetworkEdge, capability: VesselCapability): boolean {
    return capability >= edge.minimumVesselCapability;
  }
}
`);

write(`${base}/src/routing/Router.ts`, `
import { MaritimeNetwork } from '../domain/network/MaritimeNetwork';
import { NodeId } from '../domain/nodes/GeographicNode';
import { VesselCapability } from '../domain/network/VesselCapability';
import { EdgeId, NetworkEdge } from '../domain/network/NetworkEdge';
import { CompatibilityChecker } from './CompatibilityChecker';

export interface RouteResultFound {
  found: true;
  path: NodeId[];
  totalDistanceKm: number;
  edges: EdgeId[];
}

export interface RouteResultNotFound {
  found: false;
  reason: string;
}

export type RouteResult = RouteResultFound | RouteResultNotFound;

export interface RouterOptions {
  origin: NodeId;
  destination: NodeId;
  vesselCapability: VesselCapability;
}

export class Router {
  constructor(private network: MaritimeNetwork) {}
  
  findRoute(options: RouterOptions): RouteResult {
    const { origin, destination, vesselCapability } = options;
    
    if (!this.network.nodes.has(origin)) {
      return { found: false, reason: \`Origin node \${origin} not found\` };
    }
    if (!this.network.nodes.has(destination)) {
      return { found: false, reason: \`Destination node \${destination} not found\` };
    }

    if (origin === destination) {
      return { found: true, path: [origin], totalDistanceKm: 0, edges: [] };
    }

    const dist = new Map<NodeId, number>();
    const prev = new Map<NodeId, NodeId>();
    const prevEdge = new Map<NodeId, EdgeId>();
    const unvisited = new Set<NodeId>();

    for (const nodeId of this.network.nodes.keys()) {
      dist.set(nodeId, Infinity);
      unvisited.add(nodeId);
    }
    dist.set(origin, 0);

    while (unvisited.size > 0) {
      let current: NodeId | null = null;
      let minDist = Infinity;
      for (const nodeId of unvisited) {
        const d = dist.get(nodeId)!;
        if (d < minDist) {
          minDist = d;
          current = nodeId;
        }
      }

      if (current === null || minDist === Infinity) {
        break; // no more reachable nodes
      }

      if (current === destination) {
        break; // reached target
      }

      unvisited.delete(current);

      const edges = this.network.getEdgesFrom(current);
      for (const edge of edges) {
        if (!CompatibilityChecker.isEdgeCompatible(edge, vesselCapability)) {
          continue;
        }

        const neighbor = edge.toNodeId;
        if (!unvisited.has(neighbor)) continue;

        const alt = dist.get(current)! + edge.distanceKm;
        if (alt < dist.get(neighbor)!) {
          dist.set(neighbor, alt);
          prev.set(neighbor, current);
          prevEdge.set(neighbor, edge.id);
        }
      }
    }

    if (dist.get(destination) === Infinity) {
      return { found: false, reason: \`No compatible path found from \${origin} to \${destination}\` };
    }

    const path: NodeId[] = [];
    const pathEdges: EdgeId[] = [];
    let curr: NodeId = destination;

    while (curr !== origin) {
      path.unshift(curr);
      const edgeId = prevEdge.get(curr)!;
      pathEdges.unshift(edgeId);
      curr = prev.get(curr)!;
    }
    path.unshift(origin);

    return {
      found: true,
      path,
      totalDistanceKm: dist.get(destination)!,
      edges: pathEdges
    };
  }
}
`);

write(`${base}/src/movement/MovementCalculator.ts`, `
import { VesselCapability } from '../domain/network/VesselCapability';
import { RouteResult } from '../routing/Router';

export interface SpeedProfile {
  capability: VesselCapability;
  nominalSpeedKnots: number;
}

export interface TravelEstimate {
  distanceKm: number;
  durationHours: number;
}

export class MovementCalculator {
  private speedMap = new Map<VesselCapability, number>();

  constructor(speeds?: SpeedProfile[]) {
    const defaultSpeeds: SpeedProfile[] = [
      { capability: VesselCapability.A, nominalSpeedKnots: 8 },
      { capability: VesselCapability.B, nominalSpeedKnots: 10 },
      { capability: VesselCapability.C, nominalSpeedKnots: 12 },
      { capability: VesselCapability.D, nominalSpeedKnots: 14 },
      { capability: VesselCapability.E, nominalSpeedKnots: 16 },
    ];
    const profiles = speeds || defaultSpeeds;
    for (const sp of profiles) {
      this.speedMap.set(sp.capability, sp.nominalSpeedKnots);
    }
  }

  calculate(route: RouteResult & { found: true }, capability: VesselCapability): TravelEstimate {
    const speedKnots = this.speedMap.get(capability);
    if (speedKnots === undefined) {
      throw new Error(\`No speed profile for capability \${capability}\`);
    }

    const speedKmh = speedKnots * 1.852;
    const durationHours = route.totalDistanceKm / speedKmh;

    return {
      distanceKm: route.totalDistanceKm,
      durationHours
    };
  }
}
`);

write(`${base}/tests/routing/compatibility.test.ts`, `
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
`);

write(`${base}/tests/routing/router.test.ts`, `
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
`);

write(`${base}/tests/movement/movement.test.ts`, `
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
`);

console.log("Phase 4 files generated");
