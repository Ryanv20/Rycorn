import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { dsStore } from '../src/dsStore.js';
import { simulationStream } from '../src/websocket/SimulationStream.js';
import dsRoutes from '../src/routes/ds.js';
import simulationRoutes from '../src/routes/simulation.js';

test('simulation initialization loads DS demands when no cargo override is supplied', async () => {
  const app = Fastify();
  await app.register(simulationRoutes);
  await app.register(dsRoutes);

  const initializeResponse = await app.inject({
    method: 'POST',
    url: '/simulation/initialize',
  });
  assert.equal(initializeResponse.statusCode, 200, initializeResponse.body);

  const liveDemandResponse = await app.inject({
    method: 'POST',
    url: '/ds/demands',
    payload: {
      requestId: 'ORDER-LIVE-001',
      origin: 'node-19WPI-17730',
      destination: 'node-19WPI-18150',
      quantity: 50,
      earliestDeparture: 0,
      deadline: 240,
      cargoType: 'CONTAINERIZED_GOODS',
    },
  });
  assert.equal(liveDemandResponse.statusCode, 201);
  assert.equal(liveDemandResponse.json().handedToSimulation, true);
  for (let step = 0; step < 5000; step += 1) {
    const event = simulationStream.step();
    const cargoes = Array.from(simulationStream.getStatus()?.cargoes.values() ?? []);
    if (!event || cargoes.length === 11 && cargoes.every(cargo => cargo.status === 'DELIVERED')) break;
  }
  const finalStatusResponse = await app.inject({ method: 'GET', url: '/simulation/status' });
  const finalStatus = finalStatusResponse.json() as { cargoes: Array<{ status: string }> };
  assert.equal(finalStatus.cargoes.length, 11);
  assert.ok(finalStatus.cargoes.every(cargo => cargo.status === 'DELIVERED'), JSON.stringify(finalStatus.cargoes));
  const scenarioStatuses = dsStore.getCargoDemands().filter(demand => demand.requestId.startsWith('NEXT-STOP-'));
  assert.ok(scenarioStatuses.every(demand => demand.status === 'DELIVERED'), JSON.stringify(scenarioStatuses.map(demand => ({ id: demand.requestId, status: demand.status }))));
  assert.equal(dsStore.getCargoDemands().find(demand => demand.requestId === 'ORDER-LIVE-001')?.status, 'DELIVERED');

  const reportResponse = await app.inject({ method: 'GET', url: '/simulation/report' });
  const report = reportResponse.json() as {
    shipments: Array<{ requestId: string; status: string; distanceKm?: number; routeNodeIds?: string[] }>;
    timeSources: { simulationTime: string; observedAtUtc: string; distanceKm: string };
  };
  const liveShipment = report.shipments.find(shipment => shipment.requestId === 'ORDER-LIVE-001');
  assert.equal(liveShipment?.status, 'DELIVERED');
  assert.ok((liveShipment?.distanceKm ?? 0) > 0);
  assert.ok((liveShipment?.routeNodeIds?.length ?? 0) > 1);
  assert.match(report.timeSources.observedAtUtc, /Date\.now/);

  const observationsResponse = await app.inject({ method: 'GET', url: '/simulation/time-observations' });
  const observations = observationsResponse.json() as Array<{
    simulationTimeHours: number;
    simulationTimeSource: string;
    observedAtUtc: string;
    observedAtSource: string;
  }>;
  assert.ok(observations.length > 0);
  assert.equal(observations[0].simulationTimeSource, 'engine-event-queue');
  assert.equal(observations[0].observedAtSource, 'server-host-system-clock');
  assert.match(observations[0].observedAtUtc, /Z$/);

  await app.close();
});

test('marks a DS demand failed when its route cannot be executed', async () => {
  const app = Fastify();
  await app.register(simulationRoutes);
  dsStore.addDemand({
    requestId: 'ORDER-FAIL-001',
    origin: 'node-PORT-ALPHA',
    destination: 'node-NOT-IN-NETWORK',
    quantity: 10,
    earliestDeparture: 0,
    deadline: 48,
  });

  await app.inject({
    method: 'POST',
    url: '/simulation/initialize',
    payload: {
      vessels: [{ id: 'FAIL-TEST-VESSEL', capability: 2, startNodeId: 'node-PORT-ALPHA' }],
      cargoes: [{ id: 'ORDER-FAIL-001', origin: 'node-PORT-ALPHA', destination: 'node-NOT-IN-NETWORK', quantity: 10 }],
    },
  });
  let response;
  for (let step = 0; step < 10; step += 1) {
    response = await app.inject({ method: 'POST', url: '/simulation/step' });
    if (response.statusCode >= 500) break;
  }

  assert.equal(response?.statusCode, 500);
  assert.equal(dsStore.getCargoDemands().find(demand => demand.requestId === 'ORDER-FAIL-001')?.status, 'FAILED');
  await app.close();
});