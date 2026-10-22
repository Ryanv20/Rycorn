import { describe, expect, it } from 'vitest';
import { DemandSupplySystem } from '../src/application/DemandSupplySystem.js';
import { StaticDemandProvider } from '../src/infrastructure/StaticDemandProvider.js';
import { StaticFleetProvider } from '../src/infrastructure/StaticFleetProvider.js';
import { InMemoryDemandSupplyStore } from '../src/application/InMemoryDemandSupplyStore.js';
import { FixedScenarioGenerator } from '../src/application/FixedScenarioGenerator.js';

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
      status: 'PENDING',
      }]),
      new StaticFleetProvider([{
        id: 'VESSEL-001',
        capability: 'C',
        startNodeId: 'PORT-A',
        vesselType: 'CONTAINER',
        deadweightTonnes: 18000,
        fuelCapacityTonnes: 1500,
        fuelRemainingTonnes: 1200,
        fuelBurnTonnesPerHour: 0.19,
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

  it('allows pending demand edits and cancellation, then rejects further edits', () => {
    const store = new InMemoryDemandSupplyStore();
    store.addDemand({
      requestId: 'ORDER-003',
      origin: 'PORT-A',
      destination: 'PORT-B',
      quantity: 25,
      earliestDeparture: 0,
      deadline: 24,
    });

    expect(store.updateDemand('ORDER-003', { quantity: 50 }).quantity).toBe(50);
    expect(store.cancelDemand('ORDER-003').status).toBe('CANCELLED');
    expect(() => store.updateDemand('ORDER-003', { quantity: 75 })).toThrow(/only be edited while pending/);
  });

  it('enforces execution status transitions and resets unfinished demand', () => {
    const store = new InMemoryDemandSupplyStore();
    store.addDemand({
      requestId: 'ORDER-004',
      origin: 'PORT-A',
      destination: 'PORT-B',
      quantity: 25,
      earliestDeparture: 0,
      deadline: 24,
    });

    store.setDemandStatus('ORDER-004', 'ASSIGNED');
    store.setDemandStatus('ORDER-004', 'IN_TRANSIT');
    store.resetUnfinishedDemands();
    expect(store.getCargoDemands()[0].status).toBe('PENDING');
  });

  it('generates a fixed, explained global scenario without claiming live intelligence', () => {
    const scenario = new FixedScenarioGenerator().generate({ fleetCount: 50, scenarioId: 'NEXT-STOP-10', generatedAt: new Date('2026-10-03T12:00:00.000Z') });
    expect(scenario.generationMode).toBe('FIXED_RULES');
    expect(scenario.cargoDemands).toHaveLength(28);
    expect(scenario.fleetCount).toBe(50);
    expect(scenario.rationale).toHaveLength(28);
    expect(scenario.routePreviewOnly).toBe(true);
    expect(scenario.limitations.some(note => note.includes('live AIS'))).toBe(true);
    expect(scenario.cargoDemands.every(demand => demand.origin.startsWith('node-19WPI-'))).toBe(true);
  });

  it('defaults to the direct Lekki-to-Los Angeles test route', () => {
    const scenario = new FixedScenarioGenerator().generate({ fleetCount: 1, generatedAt: new Date('2026-10-03T12:00:00.000Z') });
    expect(scenario.id).toBe('TEST-LEKKI-LA');
    expect(scenario.cargoDemands).toHaveLength(1);
    expect(scenario.cargoDemands[0]).toMatchObject({
      origin: 'node-19WPI-46135-LEKKI-6-42320-4-00824',
      destination: 'node-19WPI-16080',
      status: 'PENDING',
    });
    expect(scenario.fleetCount).toBe(1);
  });
});
