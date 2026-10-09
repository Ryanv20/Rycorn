import { FastifyInstance } from 'fastify';
import { simulationStream } from '../websocket/SimulationStream.js';
import { dsStore as store } from '../dsStore.js';
import { cargoDemandSchema, FixedScenarioGenerator, vesselSupplySchema } from '@rycon/ds-system';
import type { CargoDemand, VesselSupply } from '@rycon/ds-system';
import { getActiveScenario, mergeActiveScenario, setSelectedScenarioPlan } from '../maritime/activeScenario.js';
import { buildScenarioNetwork } from '../maritime/ScenarioNetwork.js';
import { getPortByNodeId } from '../data/portCatalog.js';
import { getTradeRegionId } from '../maritime/TradeRegions.js';

function currentFleetPortNodes(): string[] {
  const engineVessels = simulationStream.getStatus()?.vessels;
  const nodeIds = engineVessels
    ? [...engineVessels.values()].map(vessel => vessel.currentNodeId)
    : store.getVesselSupply().map(vessel => vessel.startNodeId);
  return [...new Set(nodeIds.filter(nodeId => nodeId.startsWith('node-19WPI-')))];
}

function withPortRegions(demand: CargoDemand): CargoDemand {
  const origin = getPortByNodeId(demand.origin);
  const destination = getPortByNodeId(demand.destination);
  if (!origin || !destination) throw new Error(`Demand ${demand.requestId} must use ports in the World Port Index`);
  return {
    ...demand,
    originRegionId: getTradeRegionId(origin),
    destinationRegionId: getTradeRegionId(destination),
  };
}

async function addDemandRoutes(demand: CargoDemand, routeIdentitySuffix: string, replaceExisting = false): Promise<void> {
  const routeNetwork = await buildScenarioNetwork([demand], currentFleetPortNodes(), routeIdentitySuffix);
  mergeActiveScenario(routeNetwork, replaceExisting ? [demand.requestId] : []);
}

async function addVesselRoutes(vessel: VesselSupply): Promise<void> {
  if (!simulationStream.getSystemStatus().engineInitialized) return;
  const fleetPorts = currentFleetPortNodes();
  const existingPortIds = new Set(getActiveScenario()?.network.nodes.keys() ?? []);
  if (existingPortIds.has(vessel.startNodeId)) return;
  const anchorNodeId = fleetPorts[0] ?? [...existingPortIds].find(nodeId => nodeId.startsWith('node-19WPI-'));
  if (!anchorNodeId) throw new Error('Initialize a trade plan before adding a vessel at a new port');
  const connector: CargoDemand = {
    requestId: `NETWORK-CONNECTOR-FLEET-${vessel.id}`,
    origin: anchorNodeId,
    destination: vessel.startNodeId,
    quantity: 1,
    earliestDeparture: 0,
    deadline: 1,
    cargoType: 'GENERAL',
    status: 'PENDING',
  };
  const routeNetwork = await buildScenarioNetwork([connector], [...fleetPorts, vessel.startNodeId], `FLEET-${Date.now()}`);
  mergeActiveScenario(routeNetwork);
}

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
      continuousMode: simulationStream.getSystemStatus().continuousMode,
      continuousCycle: simulationStream.getSystemStatus().continuousCycle,
      environment: simulationStream.getSystemStatus().environment,
      tradeCycles: simulationStream.getTradeCycleSummaries(),
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
      if (simulationStream.getSystemStatus().engineRunning) simulationStream.pause();
      store.resetUnfinishedDemands();
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
      const candidate = withPortRegions(cargoDemandSchema.parse(request.body));
      if (store.getCargoDemands().some(demand => demand.requestId === candidate.requestId)) {
        throw new Error(`Demand ${candidate.requestId} already exists`);
      }
      await addDemandRoutes(candidate, `ADD-${Date.now()}`);
      const demand = store.addDemand(candidate);
      const handedToSimulation = simulationStream.addDemand(demand);
      return reply.code(201).send({ demand, handedToSimulation });
    } catch (error) {
      return reply.code(400).send({ error: messageFor(error) });
    }
  });

  fastify.patch('/ds/demands/:requestId', async (request, reply) => {
    const { requestId } = request.params as { requestId: string };
    try {
      const current = store.getCargoDemands().find(demand => demand.requestId === requestId);
      if (!current) throw new Error(`Demand ${requestId} not found`);
      const candidate = withPortRegions(cargoDemandSchema.parse({ ...current, ...(request.body as Record<string, unknown>), requestId, status: 'PENDING' }));
      await addDemandRoutes(candidate, `EDIT-${Date.now()}`, true);
      const demand = store.updateDemand(requestId, candidate);
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
      const candidate = vesselSupplySchema.parse(request.body);
      await addVesselRoutes(candidate);
      const vessel = store.addVessel(candidate);
      const handedToSimulation = simulationStream.addVessel(vessel);
      return reply.code(201).send({ vessel, handedToSimulation });
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
