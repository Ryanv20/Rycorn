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

/** Minimal binary min-heap for Dijkstra's frontier. */
class MinPriorityQueue<T> {
  private items: Array<{ value: T; priority: number }> = [];

  get size(): number { return this.items.length; }

  push(value: T, priority: number): void {
    const item = { value, priority };
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].priority <= priority) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }

  pop(): { value: T; priority: number } | undefined {
    if (this.items.length === 0) return undefined;
    const first = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.items.length) break;
        const child = right < this.items.length && this.items[right].priority < this.items[left].priority ? right : left;
        if (this.items[child].priority >= last.priority) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = last;
    }
    return first;
  }
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
    for (const nodeId of this.network.nodes.keys()) {
      dist.set(nodeId, Infinity);
    }
    dist.set(origin, 0);
    const frontier = new MinPriorityQueue<NodeId>();
    frontier.push(origin, 0);

    while (frontier.size > 0) {
      const entry = frontier.pop()!;
      const current = entry.value;
      const minDist = entry.priority;
      if (minDist !== dist.get(current)) continue; // Ignore stale entries after a shorter path is found.

      if (current === destination) {
        break; // reached target
      }

      const edges = this.network.getEdgesFrom(current);
      for (const edge of edges) {
        if (!CompatibilityChecker.isEdgeCompatible(edge, vesselCapability)) {
          continue;
        }

        const neighbor = edge.toNodeId;
        const alt = minDist + edge.distanceKm;
        if (alt < dist.get(neighbor)!) {
          dist.set(neighbor, alt);
          prev.set(neighbor, current);
          prevEdge.set(neighbor, edge.id);
          frontier.push(neighbor, alt);
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
