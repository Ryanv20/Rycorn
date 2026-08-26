import { GeoPosition } from '../shared/GeoPosition';
import { PortId } from '../shared/PortId';

export type NodeId = string & { readonly __brand: unique symbol };
export type NodeType = 'PORT' | 'INTERMEDIATE';

export interface GeographicNode {
  id: NodeId;
  type: NodeType;
  position: GeoPosition;
  portId?: PortId;
}
