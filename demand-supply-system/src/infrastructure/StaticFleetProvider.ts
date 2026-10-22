import type { FleetProvider } from '../contracts/FleetProvider.js';
import type { VesselSupply } from '../domain/FleetSupply.js';

export class StaticFleetProvider implements FleetProvider {
  constructor(private readonly vessels: readonly VesselSupply[]) {}

  getVesselSupply(): readonly VesselSupply[] {
    return this.vessels;
  }
}