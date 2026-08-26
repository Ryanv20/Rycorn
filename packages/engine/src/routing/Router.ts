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
      return { found: false, reason: `Origin node ${origin} not found` };
    }
    if (!this.network.nodes.has(destination)) {
      return { found: false, reason: `Destination node ${destination} not found` };
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
      return { found: false, reason: `No compatible path found from ${origin} to ${destination}` };
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
