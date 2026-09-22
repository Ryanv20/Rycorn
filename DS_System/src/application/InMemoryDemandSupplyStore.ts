import { cargoDemandSchema, type CargoDemand } from '../domain/CargoDemand.js';
import { vesselSupplySchema, type VesselSupply } from '../domain/FleetSupply.js';
import type { DemandProvider } from '../contracts/DemandProvider.js';
import type { FleetProvider } from '../contracts/FleetProvider.js';
import { DemandSupplySystem, type DemandSupplySnapshot } from './DemandSupplySystem.js';

export class InMemoryDemandSupplyStore implements DemandProvider, FleetProvider {
  private readonly demands = new Map<string, CargoDemand>();
  private readonly vessels = new Map<string, VesselSupply>();
  private latestSnapshot: DemandSupplySnapshot | null = null;
  private snapshotVersion = 0;

  constructor(
    initialDemands: readonly CargoDemand[] = [],
    initialVessels: readonly VesselSupply[] = [],
  ) {
    initialDemands.forEach(demand => this.addDemand(demand));
    initialVessels.forEach(vessel => this.addVessel(vessel));
  }

  getCargoDemands(): readonly CargoDemand[] {
    return [...this.demands.values()];
  }

  getVesselSupply(): readonly VesselSupply[] {
    return [...this.vessels.values()];
  }

  addDemand(input: unknown): CargoDemand {
    const demand = cargoDemandSchema.parse(input);
    if (this.demands.has(demand.requestId)) throw new Error(`Demand ${demand.requestId} already exists`);
    this.demands.set(demand.requestId, demand);
    return demand;
  }

  addVessel(input: unknown): VesselSupply {
    const vessel = vesselSupplySchema.parse(input);
    if (this.vessels.has(vessel.id)) throw new Error(`Vessel ${vessel.id} already exists`);
    this.vessels.set(vessel.id, vessel);
    return vessel;
  }

  async createSnapshot(): Promise<DemandSupplySnapshot> {
    const snapshot = await new DemandSupplySystem(this, this).getSnapshot();
    this.snapshotVersion += 1;
    this.latestSnapshot = {
      ...snapshot,
      snapshotId: `snapshot-${this.snapshotVersion}`,
      version: this.snapshotVersion,
    };
    return this.latestSnapshot;
  }

  getLatestSnapshot(): DemandSupplySnapshot | null {
    return this.latestSnapshot;
  }
}