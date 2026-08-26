import { GeoPosition } from '../shared/GeoPosition';
import { NodeId } from '../nodes/GeographicNode';
import { PortId } from '../shared/PortId';

export interface NetworkNode {
  id: NodeId;
  type: 'PORT' | 'INTERMEDIATE';
  position: GeoPosition;
  portId?: PortId;
}
