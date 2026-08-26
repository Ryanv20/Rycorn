import { NetworkEdge } from '../domain/network/NetworkEdge';
import { VesselCapability } from '../domain/network/VesselCapability';

export class CompatibilityChecker {
  static isEdgeCompatible(edge: NetworkEdge, capability: VesselCapability): boolean {
    return capability >= edge.minimumVesselCapability;
  }
}
