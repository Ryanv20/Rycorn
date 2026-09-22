import type { VesselSupply } from '../domain/FleetSupply.js';

export interface FleetProvider {
  getVesselSupply(): Promise<readonly VesselSupply[]> | readonly VesselSupply[];
}