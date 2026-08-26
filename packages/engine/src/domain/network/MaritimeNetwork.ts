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
