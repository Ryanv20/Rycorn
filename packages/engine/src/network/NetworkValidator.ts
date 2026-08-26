import { MaritimeNetwork } from '../domain/network/MaritimeNetwork';

export class NetworkValidator {
  static validate(network: MaritimeNetwork): string[] {
    const errors: string[] = [];
    const nodeIds = new Set(network.nodes.keys());
    const edgeIds = new Set<string>();

    for (const [id, edge] of network.edges.entries()) {
      if (edgeIds.has(id)) {
        errors.push(`Duplicate edge ID: ${id}`);
      }
      edgeIds.add(id);

      if (!nodeIds.has(edge.fromNodeId)) {
        errors.push(`Orphan edge ${id}: missing fromNode ${edge.fromNodeId}`);
      }
      if (!nodeIds.has(edge.toNodeId)) {
        errors.push(`Orphan edge ${id}: missing toNode ${edge.toNodeId}`);
      }
      if (edge.distanceKm <= 0) {
        errors.push(`Edge ${id} distance must be positive, got ${edge.distanceKm}`);
      }
    }
    return errors;
  }
}
