import { VesselCapability } from '../../domain/network/VesselCapability';
import { RouteResult } from '../../routing/Router';

export type VesselStatus =
  | 'IDLE'
  | 'ASSIGNED'
  | 'LOADING'
  | 'SAILING'
  | 'REPOSITIONING'
  | 'ARRIVED'
  | 'UNLOADING';

export interface VesselState {
  vesselId: string;
  vesselCapability: VesselCapability;
  vesselType?: string;
  deadweightTonnes?: number;
  fuelCapacityTonnes?: number;
  fuelRemainingTonnes?: number;
  fuelBurnTonnesPerHour?: number;
  status: VesselStatus;
  currentNodeId: string;
  assignedCargoIds: string[];
  currentRoute?: RouteResult;
  currentVoyageStartedAt?: number;
  expectedArrivalAt?: number;
}
