import { cargoDemandSchema, type CargoDemand, type DemandStatus } from '../domain/CargoDemand.js';
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
    const demand = { ...cargoDemandSchema.parse(input), status: 'PENDING' as const };
    if (this.demands.has(demand.requestId)) throw new Error(`Demand ${demand.requestId} already exists`);
    this.demands.set(demand.requestId, demand);
    return demand;
  }

  updateDemand(requestId: string, updates: Partial<Omit<CargoDemand, 'requestId' | 'status'>>): CargoDemand {
    const demand = this.requireDemand(requestId);
    if (demand.status !== 'PENDING') throw new Error(`Demand ${requestId} can only be edited while pending`);
    const updatedDemand = cargoDemandSchema.parse({ ...demand, ...updates, status: 'PENDING' });
    this.demands.set(requestId, updatedDemand);
    return updatedDemand;
  }

  setDemandStatus(requestId: string, status: DemandStatus): CargoDemand {
    const demand = this.requireDemand(requestId);
    const transitions: Record<DemandStatus, DemandStatus[]> = {
      PENDING: ['ASSIGNED', 'CANCELLED', 'FAILED'],
      ASSIGNED: ['IN_TRANSIT', 'PENDING', 'FAILED'],
      IN_TRANSIT: ['DELIVERED', 'FAILED'],
      DELIVERED: [],
      CANCELLED: [],
      FAILED: [],
    };
    if (!transitions[demand.status].includes(status)) {
      throw new Error(`Invalid demand transition: ${demand.status} -> ${status}`);
    }
    const updatedDemand = { ...demand, status };
    this.demands.set(requestId, updatedDemand);
    return updatedDemand;
  }

  cancelDemand(requestId: string): CargoDemand {
    return this.setDemandStatus(requestId, 'CANCELLED');
  }

  resetUnfinishedDemands(): void {
    for (const [requestId, demand] of this.demands) {
      if (demand.status === 'ASSIGNED' || demand.status === 'IN_TRANSIT') {
        this.demands.set(requestId, { ...demand, status: 'PENDING' });
      }
    }
  }

  resetDemands(requestIds: readonly string[]): void {
    for (const requestId of requestIds) {
      const demand = this.requireDemand(requestId);
      this.demands.set(requestId, { ...demand, status: 'PENDING' });
    }
  }

  replaceScenarioDemands(inputs: readonly unknown[]): CargoDemand[] {
    for (const [requestId, demand] of this.demands) {
      if (requestId.startsWith('NEXT-STOP-') || requestId.startsWith('FLOW-')) {
        if (demand.status !== 'PENDING') throw new Error(`Cannot replace scenario while demand ${requestId} is ${demand.status}`);
        this.demands.delete(requestId);
      }
    }
    return inputs.map(input => this.addDemand(input));
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

  private requireDemand(requestId: string): CargoDemand {
    const demand = this.demands.get(requestId);
    if (!demand) throw new Error(`Demand ${requestId} not found`);
    return demand;
  }
}