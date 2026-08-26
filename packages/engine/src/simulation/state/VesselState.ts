import { VesselCapability } from '../../domain/network/VesselCapability';
import { RouteResult } from '../../routing/Router';

export type VesselStatus =
  | 'IDLE'
  | 'ASSIGNED'
  | 'LOADING'
  | 'SAILING'
  | 'ARRIVED'
  | 'UNLOADING';

export interface VesselState {
  vesselId: string;
  vesselCapability: VesselCapability;
  status: VesselStatus;
  currentNodeId: string;
  assignedCargoIds: string[];
  currentRoute?: RouteResult;
}
