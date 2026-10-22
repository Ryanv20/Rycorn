import type { DemandProvider } from '../contracts/DemandProvider.js';
import type { FleetProvider } from '../contracts/FleetProvider.js';
import type { CargoDemand } from '../domain/CargoDemand.js';
import type { VesselSupply } from '../domain/FleetSupply.js';

export interface DemandSupplySnapshot {
  snapshotId: string;
  createdAt: string;
  version: number;
  cargoDemands: readonly CargoDemand[];
  vesselSupply: readonly VesselSupply[];
}

export class DemandSupplySystem {
  constructor(
    private readonly demandProvider: DemandProvider,
    private readonly fleetProvider: FleetProvider,
  ) {}

  async getSnapshot(): Promise<DemandSupplySnapshot> {
    const [cargoDemands, vesselSupply] = await Promise.all([
      this.demandProvider.getCargoDemands(),
      this.fleetProvider.getVesselSupply(),
    ]);

    return {
      snapshotId: `snapshot-${Date.now()}`,
      createdAt: new Date().toISOString(),
      version: 1,
      cargoDemands: [...cargoDemands],
      vesselSupply: [...vesselSupply],
    };
  }
}