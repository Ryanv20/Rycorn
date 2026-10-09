export type EventType =
  | 'SHIP_ASSIGNED'
  | 'LOAD_STARTED'
  | 'LOAD_COMPLETED'
  | 'DEPARTED'
  | 'ARRIVED'
  | 'WAITING_FOR_BERTH'
  | 'UNLOAD_STARTED'
  | 'UNLOAD_COMPLETED'
  | 'SHIP_AVAILABLE'
  | 'REPOSITION_STARTED'
  | 'REPOSITION_ARRIVED'
  | 'BUNKERING_COMPLETED';

export interface SimulationEvent {
  readonly eventId: string;
  readonly simulationTime: number;
  readonly eventType: EventType;
  readonly entityId: string;
  readonly locationNodeId: string;
  readonly metadata: Record<string, unknown>;
}
