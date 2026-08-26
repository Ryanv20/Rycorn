export type CargoStatus = 'CREATED' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED';

export interface CargoState {
  cargoId: string;
  originNodeId: string;
  destinationNodeId: string;
  assignedVesselId?: string;
  status: CargoStatus;
  quantity: number;
}
