export type CargoStatus = 'CREATED' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export interface CargoState {
  cargoId: string;
  originNodeId: string;
  destinationNodeId: string;
  assignedVesselId?: string;
  status: CargoStatus;
  quantity: number;
  earliestDeparture?: number;
  deadline?: number;
  deadlineMet?: boolean;
  latenessHours?: number;
  cargoType?: string;
}
