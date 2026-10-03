import type { SimulationEvent } from '@rycon/engine';
import { dsStore } from '../dsStore.js';
import { simulationStream } from '../websocket/SimulationStream.js';

function eventCargoIds(event: SimulationEvent): string[] {
  const cargoIds = event.metadata.cargoIds;
  return Array.isArray(cargoIds) ? cargoIds.filter((id): id is string => typeof id === 'string') : [];
}

export function createOperationalReport() {
  const state = simulationStream.getStatus();
  const events = simulationStream.getEvents();
  const timeObservations = simulationStream.getTimeObservations();
  const demandById = new Map(dsStore.getCargoDemands().map(demand => [demand.requestId, demand]));
  const observationByEventId = new Map(timeObservations.map(observation => [observation.eventId, observation]));
  const cargoes = Array.from(state?.cargoes.values() ?? []);

  const shipments = cargoes.map(cargo => {
    const demand = demandById.get(cargo.cargoId);
    const milestones = events
      .filter(event => eventCargoIds(event).includes(cargo.cargoId))
      .map(event => ({
        eventId: event.eventId,
        eventType: event.eventType,
        simulationTimeHours: event.simulationTime,
        observedAtUtc: observationByEventId.get(event.eventId)?.observedAtUtc,
        vesselId: event.entityId,
        locationNodeId: event.locationNodeId,
        metadata: event.metadata,
      }));
    const assigned = milestones.find(event => event.eventType === 'SHIP_ASSIGNED');
    const departed = milestones.find(event => event.eventType === 'DEPARTED');
    const arrived = milestones.find(event => event.eventType === 'ARRIVED');
    const delivered = milestones.find(event => event.eventType === 'UNLOAD_COMPLETED');
    const distanceKm = departed?.metadata.distanceKm;

    return {
      requestId: cargo.cargoId,
      origin: demand?.origin ?? cargo.originNodeId,
      destination: demand?.destination ?? cargo.destinationNodeId,
      quantity: cargo.quantity,
      cargoType: demand?.cargoType ?? cargo.cargoType ?? 'GENERAL',
      status: cargo.status,
      deadlineSimulationHours: demand?.deadline ?? cargo.deadline,
      vesselId: assigned?.vesselId ?? cargo.assignedVesselId,
      routeNodeIds: Array.isArray(departed?.metadata.routeNodeIds) ? departed.metadata.routeNodeIds : undefined,
      distanceKm: typeof distanceKm === 'number' ? distanceKm : undefined,
      departedSimulationHours: departed?.simulationTimeHours,
      arrivedSimulationHours: arrived?.simulationTimeHours,
      deliveredSimulationHours: delivered?.simulationTimeHours,
      transitHours: departed && arrived ? arrived.simulationTimeHours - departed.simulationTimeHours : undefined,
      milestones,
    };
  });

  return {
    generatedAtUtc: new Date().toISOString(),
    timeSources: {
      simulationTime: 'Engine event queue, elapsed modeled hours from T+0.',
      observedAtUtc: 'Server host system clock sampled with Date.now(), serialized as UTC.',
      distanceKm: 'Sum of network edge distances on the route selected by the router.',
    },
    simulationTimeHours: events[events.length - 1]?.simulationTime ?? 0,
    systemStatus: simulationStream.getSystemStatus(),
    shipments,
    demandSupply: {
      demands: dsStore.getCargoDemands(),
      vesselSupply: dsStore.getVesselSupply(),
    },
    vessels: Array.from(state?.vessels.values() ?? []),
    cargoes,
    events,
    timeObservations,
    errors: simulationStream.getErrors(),
  };
}