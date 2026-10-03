import { FastifyInstance } from 'fastify';
import { simulationStream } from '../websocket/SimulationStream.js';
import { dsStore as store } from '../dsStore.js';
import { FixedScenarioGenerator } from '@rycon/ds-system';
import { setSelectedScenarioPlan } from '../maritime/activeScenario.js';

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : 'DS System request failed';
}

export default async function dsRoutes(fastify: FastifyInstance) {
  fastify.get('/ds/status', async () => {
    const demands = store.getCargoDemands();
    const vessels = store.getVesselSupply();
    return {
      demandProvider: 'InMemoryDemandSupplyStore',
      fleetProvider: 'InMemoryDemandSupplyStore',
      demandCount: demands.length,
      vesselCount: vessels.length,
      latestSnapshot: store.getLatestSnapshot(),
    };
  });

  fastify.get('/ds/scenarios', async () => new FixedScenarioGenerator().list());

  fastify.get('/ds/scenario', async request => {
    const { scenarioId } = request.query as { scenarioId?: string };
    return new FixedScenarioGenerator().generate({ fleetCount: store.getVesselSupply().length, scenarioId });
  });

  fastify.post('/ds/scenario/apply', async (request, reply) => {
    const { scenarioId } = (request.body as { scenarioId?: string }) ?? {};
    const scenario = new FixedScenarioGenerator().generate({ fleetCount: store.getVesselSupply().length, scenarioId });
    try {
      store.replaceScenarioDemands(scenario.cargoDemands);
    } catch (error) {
      return reply.code(409).send({ error: messageFor(error) });
    }
    setSelectedScenarioPlan(scenario);
    return { scenarioId: scenario.id, demandCount: scenario.cargoDemands.length };
  });

  fastify.get('/ds/demands', async () => {
    return { demands: store.getCargoDemands() };
  });

  fastify.post('/ds/demands', async (request, reply) => {
    try {
      const demand = store.addDemand(request.body);
      const handedToSimulation = simulationStream.addDemand(demand);
      return reply.code(201).send({ demand, handedToSimulation });
    } catch (error) {
      return reply.code(400).send({ error: messageFor(error) });
    }
  });

  fastify.patch('/ds/demands/:requestId', async (request, reply) => {
    const { requestId } = request.params as { requestId: string };
    try {
      const demand = store.updateDemand(requestId, request.body as Record<string, unknown>);
      const updatedInSimulation = simulationStream.updateDemand(demand);
      return { demand, updatedInSimulation };
    } catch (error) {
      return reply.code(400).send({ error: messageFor(error) });
    }
  });

  fastify.delete('/ds/demands/:requestId', async (request, reply) => {
    const { requestId } = request.params as { requestId: string };
    try {
      const demand = store.cancelDemand(requestId);
      const cancelledInSimulation = simulationStream.cancelDemand(requestId);
      return { demand, cancelledInSimulation };
    } catch (error) {
      return reply.code(400).send({ error: messageFor(error) });
    }
  });

  fastify.get('/ds/supply', async () => {
    return { vessels: store.getVesselSupply() };
  });

  fastify.post('/ds/supply', async (request, reply) => {
    try {
      const vessel = store.addVessel(request.body);
      return reply.code(201).send({ vessel });
    } catch (error) {
      return reply.code(400).send({ error: messageFor(error) });
    }
  });

  fastify.post('/ds/snapshots', async (request, reply) => {
    const snapshot = await store.createSnapshot();
    return reply.code(201).send({ snapshot });
  });

  fastify.get('/ds/snapshots/latest', async () => {
    return { snapshot: store.getLatestSnapshot() };
  });
}