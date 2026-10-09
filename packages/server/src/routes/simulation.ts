import { FastifyInstance } from 'fastify';
import { VesselCapability } from '@rycon/engine';
import { simulationStream } from '../websocket/SimulationStream.js';
import { dsStore } from '../dsStore.js';
import { createOperationalReport } from '../reporting/OperationalReport.js';
import { buildScenarioNetwork } from '../maritime/ScenarioNetwork.js';
import { getSelectedScenarioPlan, setActiveScenario } from '../maritime/activeScenario.js';
import { CLOCK_PROFILES, type ClockProfileId } from '../websocket/SimulationStream.js';

export default async function simulationRoutes(fastify: FastifyInstance) {
  // Initialize — network is always built server-side from demoNetwork.ts
  fastify.post('/simulation/initialize', async (request) => {
    const body = (request.body as any) ?? {};
    dsStore.resetUnfinishedDemands();
    const selectedPlan = getSelectedScenarioPlan();
    if (selectedPlan) dsStore.replaceScenarioDemands(selectedPlan.cargoDemands);
    const demands = body.cargoes
      ? []
      : dsStore.getCargoDemands().filter(demand => demand.status === 'PENDING');
    const vessels = body.vessels ?? dsStore.getVesselSupply().map(vessel => ({
      id: vessel.id,
      capability: VesselCapability[vessel.capability],
      startNodeId: vessel.startNodeId,
      vesselType: vessel.vesselType,
      deadweightTonnes: vessel.deadweightTonnes,
      fuelCapacityTonnes: vessel.fuelCapacityTonnes,
      fuelRemainingTonnes: vessel.fuelRemainingTonnes,
      fuelBurnTonnesPerHour: vessel.fuelBurnTonnesPerHour,
    }));
    const routeDemands = body.cargoes?.map((cargo: any) => ({
      requestId: cargo.id,
      origin: cargo.origin,
      destination: cargo.destination,
      quantity: cargo.quantity ?? 1,
      earliestDeparture: cargo.earliestDeparture ?? 0,
      deadline: cargo.deadline ?? 1,
      cargoType: cargo.cargoType ?? 'GENERAL',
      status: 'PENDING' as const,
    })) ?? demands;
    const scenario = await buildScenarioNetwork(routeDemands, vessels.map((vessel: any) => vessel.startNodeId));
    setActiveScenario(scenario);
    simulationStream.initialize({
      vessels,
      cargoes: body.cargoes ?? demands
        .map(demand => ({
        id: demand.requestId,
        origin: demand.origin,
        destination: demand.destination,
        quantity: demand.quantity,
        earliestDeparture: demand.earliestDeparture,
        deadline: demand.deadline,
        cargoType: demand.cargoType,
      })),
      network: scenario.network,
      config: {
        loadDurationHours: 2,
        unloadDurationHours: 2,
        bunkerPortNodeIds: ['19WPI-50000', '19WPI-16080', '19WPI-18150', '19WPI-53650', '19WPI-46850'].map(id => `node-${id}`),
        bunkeringDurationHours: 2,
        ...body.config,
        environment: {
          enabled: true,
          seed: 'RYCORN-GLOBAL-TRADE-1',
          maxWeatherImpact: 0.12,
          congestionEnabled: true,
          maxPortDelayHours: 1.5,
          ...(body.config?.environment ?? {}),
        },
      },
    });
    simulationStream.setContinuousDemands(selectedPlan?.continuous && !body.cargoes ? selectedPlan.cargoDemands : null);
    return { success: true, status: simulationStream.getSystemStatus() };
  });

  fastify.post('/simulation/run', async () => {
    simulationStream.run();
    return { success: true };
  });

  fastify.post('/simulation/pause', async () => {
    simulationStream.pause();
    return { success: true };
  });

  fastify.post('/simulation/step', async () => {
    const event = simulationStream.step();
    return { success: true, event: event ?? null };
  });

  fastify.post('/simulation/reset', async () => {
    dsStore.resetUnfinishedDemands();
    simulationStream.reset();
    return { success: true };
  });

  fastify.get('/simulation/clock-profile', async () => ({
    active: simulationStream.getClockProfile(),
    profiles: CLOCK_PROFILES,
  }));

  fastify.post('/simulation/clock-profile', async (request, reply) => {
    const { profileId } = (request.body as { profileId?: ClockProfileId }) ?? {};
    if (!profileId || !CLOCK_PROFILES.some(profile => profile.id === profileId)) {
      return reply.code(400).send({ error: 'Choose one of the supported clock profiles' });
    }
    simulationStream.setClockProfile(profileId);
    return { active: simulationStream.getClockProfile() };
  });

  fastify.get('/simulation/status', async (request, reply) => {
    const status = simulationStream.getStatus();
    if (!status) return reply.code(400).send({ error: 'Not initialized' });
    return {
      vessels: Array.from(status.vessels.values()),
      cargoes: Array.from(status.cargoes.values()),
    };
  });

  fastify.get('/simulation/events', async () => simulationStream.getEvents());
  fastify.get('/simulation/time-observations', async () => simulationStream.getTimeObservations());
  fastify.get('/simulation/trade-cycles', async () => simulationStream.getTradeCycleSummaries());
  fastify.get('/simulation/report', async () => createOperationalReport());
}
