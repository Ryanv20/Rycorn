import { describe, expect, it } from 'vitest';
import { DemandSupplySystem } from '../src/application/DemandSupplySystem.js';
import { StaticDemandProvider } from '../src/infrastructure/StaticDemandProvider.js';
import { StaticFleetProvider } from '../src/infrastructure/StaticFleetProvider.js';
import { InMemoryDemandSupplyStore } from '../src/application/InMemoryDemandSupplyStore.js';

describe('DemandSupplySystem', () => {
  it('combines cargo demand and vessel supply without depending on the engine', async () => {
    const system = new DemandSupplySystem(
      new StaticDemandProvider([{
        requestId: 'ORDER-001',
        origin: 'PORT-A',
        destination: 'PORT-B',
        quantity: 100,
        earliestDeparture: 0,
        deadline: 48,
        cargoType: 'GENERAL',
      }]),
      new StaticFleetProvider([{
        id: 'VESSEL-001',
        capability: 'C',
        startNodeId: 'PORT-A',
      }]),
    );

    await expect(system.getSnapshot()).resolves.toEqual(expect.objectContaining({
      cargoDemands: expect.arrayContaining([expect.objectContaining({ requestId: 'ORDER-001' })]),
      vesselSupply: expect.arrayContaining([expect.objectContaining({ id: 'VESSEL-001' })]),
    }));
  });

  it('validates new records and creates a versioned snapshot', async () => {
    const store = new InMemoryDemandSupplyStore();
    store.addDemand({
      requestId: 'ORDER-002',
      origin: 'PORT-A',
      destination: 'PORT-C',
      quantity: 25,
      earliestDeparture: 0,
      deadline: 24,
    });
    store.addVessel({ id: 'VESSEL-002', capability: 'B', startNodeId: 'PORT-A' });

    const snapshot = await store.createSnapshot();
    expect(snapshot.version).toBe(1);
    expect(snapshot.cargoDemands).toHaveLength(1);
    expect(snapshot.vesselSupply).toHaveLength(1);
    expect(store.getLatestSnapshot()?.snapshotId).toBe(snapshot.snapshotId);
  });
});