import { FastifyInstance } from 'fastify';
import { VesselCapability, type VesselState } from '@rycon/engine';
import { simulationStream } from '../websocket/SimulationStream.js';
import { dsStore } from '../dsStore.js';
import { createOperationalReport } from '../reporting/OperationalReport.js';
import { buildScenarioNetwork } from '../maritime/ScenarioNetwork.js';
import { getActiveScenario, getSelectedScenarioPlan, setActiveScenario } from '../maritime/activeScenario.js';
import { CLOCK_PROFILES, type ClockProfileId } from '../websocket/SimulationStream.js';
import { s3ArtifactStore } from '../storage/S3ArtifactStore.js';
import { getDemoNetwork } from '../demo/demoNetwork.js';
import { getPortByNodeId } from '../data/portCatalog.js';

function bearingBetween(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): number {
  const radians = Math.PI / 180;
  const lat1 = from.latitude * radians;
  const lat2 = to.latitude * radians;
  const longitudeDelta = (to.longitude - from.longitude) * radians;
  const y = Math.sin(longitudeDelta) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(longitudeDelta);
  return (Math.atan2(y, x) / radians + 360) % 360;
}

function distanceBetween(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (to.latitude - from.latitude) * radians;
  const longitudeDelta = (to.longitude - from.longitude) * radians;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(from.latitude * radians) * Math.cos(to.latitude * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function navigationPosition(path: string[], fraction: number, network: ReturnType<typeof getDemoNetwork>) {
  const points = path.map(id => network.getNode(id as never)?.position).filter((point): point is NonNullable<typeof point> => !!point);
  if (points.length === 0) return null;
  if (points.length === 1) return { latitude: points[0].latitude, longitude: points[0].longitude, bearing: 0 };
  const distances = points.slice(1).map((point, index) => distanceBetween(points[index], point));
  const totalDistance = distances.reduce((sum, distance) => sum + distance, 0);
  let remaining = Math.max(0, Math.min(1, fraction)) * totalDistance;
  let segment = distances.findIndex(distance => remaining <= distance);
  if (segment < 0) segment = distances.length - 1;
  for (let index = 0; index < segment; index++) remaining -= distances[index];
  const ratio = distances[segment] > 0 ? Math.max(0, Math.min(1, remaining / distances[segment])) : 0;
  const from = points[segment];
  const to = points[segment + 1];
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * ratio,
    longitude: from.longitude + (to.longitude - from.longitude) * ratio,
    bearing: bearingBetween(from, to),
  };
}

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

  fastify.get('/simulation/navigation', async () => {
    const status = simulationStream.getStatus();
    const network = getActiveScenario()?.network ?? getDemoNetwork();
    const simulationTime = simulationStream.getSystemStatus().simulationTimeHours;
    const controls = simulationStream.getCaptainControls();
    const vessels: VesselState[] = status
      ? [...status.vessels.values()]
      : dsStore.getVesselSupply().map(supply => ({
        vesselId: supply.id,
        vesselType: supply.vesselType,
        vesselCapability: VesselCapability[supply.capability],
        status: 'IDLE' as const,
        currentNodeId: supply.startNodeId,
        assignedCargoIds: [] as string[],
      }));
    const cargoes = status ? [...status.cargoes.values()] : [];
    return {
      simulationTime,
      engineInitialized: !!status,
      engineRunning: simulationStream.getSystemStatus().engineRunning,
      vessels: vessels.map(vessel => {
        const active = vessel.status === 'SAILING' || vessel.status === 'REPOSITIONING';
        const route = vessel.currentRoute?.found ? vessel.currentRoute.path as string[] : [];
        const start = route[0] ?? vessel.currentNodeId;
        const destinationNodeId = route.at(-1) ?? vessel.currentNodeId;
        const destinationPort = getPortByNodeId(destinationNodeId);
        const duration = (vessel.baseExpectedArrivalAt ?? vessel.expectedArrivalAt ?? 0) - (vessel.currentVoyageStartedAt ?? 0);
        const fraction = active && duration > 0 ? (simulationTime - (vessel.currentVoyageStartedAt ?? 0)) / duration : 0;
        const routePosition = active && route.length > 1
          ? navigationPosition(route, fraction, network)
          : null;
        const fallbackNode = network.getNode(vessel.currentNodeId as never)?.position;
        const fallbackPort = getPortByNodeId(vessel.currentNodeId);
        const point = routePosition ?? fallbackNode ?? (fallbackPort
          ? { latitude: fallbackPort.latitude, longitude: fallbackPort.longitude }
          : { latitude: 0, longitude: 0 });
        const originPort = getPortByNodeId(start);
        const currentPort = getPortByNodeId(vessel.currentNodeId);
        const helm = controls.find(control => control.vesselId === vessel.vesselId);
        const routeBearing = routePosition?.bearing ?? 0;
        return {
          vesselId: vessel.vesselId,
          vesselType: vessel.vesselType ?? 'GENERAL_CARGO',
          capability: vessel.vesselCapability,
          status: vessel.status,
          locationName: active
            ? `En route · ${originPort?.name ?? start} → ${destinationPort?.name ?? destinationNodeId}`
            : currentPort?.name ?? vessel.currentNodeId,
          currentNodeId: vessel.currentNodeId,
          destinationNodeId,
          destinationName: destinationPort?.name ?? destinationNodeId,
          latitude: point.latitude,
          longitude: point.longitude,
          routeCoordinates: route.map(id => network.getNode(id as never)?.position)
            .filter((position): position is NonNullable<typeof position> => !!position)
            .map(position => ({ latitude: position.latitude, longitude: position.longitude })),
          bearing: (routeBearing + (helm?.rudder ?? 0) * 0.5 + 360) % 360,
          expectedArrivalAt: vessel.expectedArrivalAt ?? null,
          assignedCargoIds: vessel.assignedCargoIds,
          assignedCargoes: vessel.assignedCargoIds.map(id => cargoes.find(cargo => cargo.cargoId === id))
            .filter((cargo): cargo is NonNullable<typeof cargo> => !!cargo)
            .map(cargo => ({ cargoId: cargo.cargoId, deadline: cargo.deadline, destinationNodeId: cargo.destinationNodeId })),
        };
      }),
      controls,
      incidents: simulationStream.getCaptainEvents(),
    };
  });

  fastify.get('/simulation/captain-events', async () => simulationStream.getCaptainEvents());

  fastify.post('/simulation/captain-control', async (request, reply) => {
    const { vesselId, rudder, throttle } = (request.body as { vesselId?: string; rudder?: number; throttle?: number }) ?? {};
    if (!vesselId || !Number.isFinite(rudder) || !Number.isFinite(throttle)) {
      return reply.code(400).send({ error: 'Provide a vesselId, rudder angle, and engine throttle' });
    }
    try {
      return { control: simulationStream.applyCaptainControl(vesselId, rudder!, throttle!) };
    } catch (error) {
      return reply.code(409).send({ error: error instanceof Error ? error.message : 'Captain command failed' });
    }
  });

  fastify.post('/simulation/incident', async (request, reply) => {
    const { vesselId, incident, delayHours } = (request.body as { vesselId?: string; incident?: string; delayHours?: number }) ?? {};
    if (!vesselId || !incident || !Number.isFinite(delayHours)) {
      return reply.code(400).send({ error: 'Provide a vesselId, incident description, and delayHours' });
    }
    try {
      const event = simulationStream.reportMaritimeIncident(vesselId, incident, delayHours!);
      return { event };
    } catch (error) {
      return reply.code(409).send({ error: error instanceof Error ? error.message : 'Incident could not be applied' });
    }
  });

  fastify.get('/simulation/events', async () => simulationStream.getEvents());
  fastify.get('/simulation/time-observations', async () => simulationStream.getTimeObservations());
  fastify.get('/simulation/trade-cycles', async () => simulationStream.getTradeCycleSummaries());
  fastify.get('/simulation/report', async () => createOperationalReport());

  fastify.post('/simulation/report/archive', async (_request, reply) => {
    if (!process.env.RYCORN_S3_BUCKET?.trim()) {
      return reply.code(503).send({ error: 'S3 report storage is not configured' });
    }
    const artifact = await s3ArtifactStore.putJson('simulation-reports', createOperationalReport());
    return { success: true, ...artifact };
  });
}
