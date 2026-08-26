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
