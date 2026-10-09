import { SimulationContext } from '../state/SimulationContext';
import { EventQueue } from '../events/EventQueue';
import { SimulationEvent } from '../events/SimulationEvent';
import { Router } from '../../routing/Router';
import { MovementCalculator } from '../../movement/MovementCalculator';
import { SimulationConfig } from '../SimulationConfig';
import { StateMachine } from '../state/StateMachine';
import { NodeId } from '../../domain/nodes/GeographicNode';

import { CapacityPolicy } from '../../operations/policies/CapacityPolicy';
import { PortCapacityPolicy } from '../../operations/policies/PortCapacityPolicy';
import { CargoCompatibilityPolicy } from '../../operations/policies/CargoCompatibilityPolicy';
import { VesselCapability } from '../../domain/network/VesselCapability';

export class EventProcessor {
  private eventCounter = 0;
  private reservedCargoIds = new Set<string>();
  private capacityPolicy: CapacityPolicy;
  private portCapacityPolicy: PortCapacityPolicy;
  private cargoCompatibilityPolicy: CargoCompatibilityPolicy;

  constructor(
    private context: SimulationContext,
    private queue: EventQueue,
    private router: Router,
    private movement: MovementCalculator,
    private config: SimulationConfig
  ) {
    this.capacityPolicy = new CapacityPolicy(config.vesselCapacity || { 
      0: 100, 1: 500, 2: 2000, 3: 10000, 4: 50000,
      'A': 100, 'B': 500, 'C': 2000, 'D': 10000, 'E': 50000 
    });
    this.portCapacityPolicy = new PortCapacityPolicy();
    this.cargoCompatibilityPolicy = new CargoCompatibilityPolicy();
  }

  private createEventId(): string {
    return `evt-${++this.eventCounter}`;
  }

  process(event: SimulationEvent): void {
    switch (event.eventType) {
      case 'SHIP_ASSIGNED':
        this.handleShipAssigned(event);
        break;
      case 'LOAD_STARTED':
        this.handleLoadStarted(event);
        break;
      case 'LOAD_COMPLETED':
        this.handleLoadCompleted(event);
        break;
      case 'DEPARTED':
        this.handleDeparted(event);
        break;
      case 'ARRIVED':
        this.handleArrived(event);
        break;
      case 'WAITING_FOR_BERTH':
        this.handleWaitingForBerth(event);
        break;
      case 'UNLOAD_STARTED':
        this.handleUnloadStarted(event);
        break;
      case 'UNLOAD_COMPLETED':
        this.handleUnloadCompleted(event);
        break;
      case 'SHIP_AVAILABLE':
        this.handleShipAvailable(event);
        break;
      case 'REPOSITION_STARTED':
        this.handleRepositionStarted(event);
        break;
      case 'REPOSITION_ARRIVED':
        this.handleRepositionArrived(event);
        break;
      case 'BUNKERING_COMPLETED':
        this.handleBunkeringCompleted(event);
        break;
    }
  }

  private handleShipAssigned(event: SimulationEvent) {
    const vessel = this.context.getVessel(event.entityId);
    const cargoIds = (event.metadata.cargoIds as string[]).filter(cargoId => {
      const cargo = this.context.cargoes.get(cargoId);
      this.reservedCargoIds.delete(cargoId);
      return cargo?.status === 'CREATED';
    });
    if (cargoIds.length === 0) return;
    StateMachine.transitionVessel(vessel.status, 'ASSIGNED');

    for (const cargoId of cargoIds) {
      const cargo = this.context.getCargo(cargoId);
      StateMachine.transitionCargo(cargo.status, 'ASSIGNED');
      this.context.updateCargo(cargoId, { assignedVesselId: vessel.vesselId, status: 'ASSIGNED' });
    }
    
    this.context.updateVessel(vessel.vesselId, { status: 'ASSIGNED', assignedCargoIds: cargoIds });
    
    this.queue.enqueue({
      eventId: this.createEventId(),
      simulationTime: event.simulationTime,
      eventType: 'LOAD_STARTED',
      entityId: vessel.vesselId,
      locationNodeId: event.locationNodeId,
      metadata: { cargoIds }
    });
  }

  private handleLoadStarted(event: SimulationEvent) {
    const vessel = this.context.getVessel(event.entityId);
    StateMachine.transitionVessel(vessel.status, 'LOADING');
    this.context.updateVessel(vessel.vesselId, { status: 'LOADING' });
    
    const portConfig = this.config.portCapacity || { defaultBerths: 2 };
    this.portCapacityPolicy.vesselEntered(event.locationNodeId);

    const extraDelay = this.config.portDelayModifier?.getAdditionalDelay(event.locationNodeId, 'LOAD', event.simulationTime) || 0;

    this.queue.enqueue({
      eventId: this.createEventId(),
      simulationTime: event.simulationTime + this.config.loadDurationHours + extraDelay,
      eventType: 'LOAD_COMPLETED',
      entityId: vessel.vesselId,
      locationNodeId: event.locationNodeId,
      metadata: event.metadata
    });
  }

  private handleLoadCompleted(event: SimulationEvent) {
    const vessel = this.context.getVessel(event.entityId);
    StateMachine.transitionVessel(vessel.status, 'SAILING');
    
    const cargoId = vessel.assignedCargoIds[0];
    const cargo = this.context.getCargo(cargoId);
    
    const route = this.router.findRoute({
      origin: event.locationNodeId as NodeId,
      destination: cargo.destinationNodeId as NodeId,
      vesselCapability: vessel.vesselCapability
    });
    
    if (!route.found) {
      throw new Error(`Cannot route from ${event.locationNodeId} to ${cargo.destinationNodeId}`);
    }

    this.context.updateVessel(vessel.vesselId, { status: 'SAILING', currentRoute: route });
    
    for (const cid of vessel.assignedCargoIds) {
      const c = this.context.getCargo(cid);
      StateMachine.transitionCargo(c.status, 'IN_TRANSIT');
      this.context.updateCargo(cid, { status: 'IN_TRANSIT' });
    }
    
    this.queue.enqueue({
      eventId: this.createEventId(),
      simulationTime: event.simulationTime,
      eventType: 'DEPARTED',
      entityId: vessel.vesselId,
      locationNodeId: event.locationNodeId,
      metadata: {
        ...event.metadata,
        routeNodeIds: route.path,
        distanceKm: route.totalDistanceKm,
      }
    });
  }

  private handleDeparted(event: SimulationEvent) {
    const vessel = this.context.getVessel(event.entityId);
    const route = vessel.currentRoute;
    if (!route || !route.found) throw new Error("No route");
    
    this.portCapacityPolicy.vesselDeparted(event.locationNodeId);

    const estimate = this.movement.calculate(route, vessel.vesselCapability, event.simulationTime);
    const fuelBurnTonnes = estimate.durationHours * (vessel.fuelBurnTonnesPerHour ?? 0);
    const fuelRemainingTonnes = vessel.fuelRemainingTonnes ?? Infinity;
    if (fuelRemainingTonnes < fuelBurnTonnes) {
      throw new Error(`Vessel ${vessel.vesselId} requires ${fuelBurnTonnes.toFixed(1)} t fuel but has ${fuelRemainingTonnes.toFixed(1)} t`);
    }
    this.context.updateVessel(vessel.vesselId, {
      fuelRemainingTonnes: fuelRemainingTonnes - fuelBurnTonnes,
      currentVoyageStartedAt: event.simulationTime,
      expectedArrivalAt: event.simulationTime + estimate.durationHours,
    });
    
    this.queue.enqueue({
      eventId: this.createEventId(),
      simulationTime: event.simulationTime + estimate.durationHours,
      eventType: 'ARRIVED',
      entityId: vessel.vesselId,
      locationNodeId: route.path[route.path.length - 1],
      metadata: { ...event.metadata, fuelBurnTonnes, fuelRemainingAfterDepartureTonnes: fuelRemainingTonnes - fuelBurnTonnes }
    });
  }

  private handleArrived(event: SimulationEvent) {
    const vessel = this.context.getVessel(event.entityId);
    StateMachine.transitionVessel(vessel.status, 'ARRIVED');
    this.context.updateVessel(vessel.vesselId, { status: 'ARRIVED', currentNodeId: event.locationNodeId });
    
    const portConfig = this.config.portCapacity || { defaultBerths: 2 };
    
    if (this.portCapacityPolicy.canEnterPort(event.locationNodeId, portConfig)) {
      this.portCapacityPolicy.vesselEntered(event.locationNodeId);
      this.queue.enqueue({
        eventId: this.createEventId(),
        simulationTime: event.simulationTime,
        eventType: 'UNLOAD_STARTED',
        entityId: vessel.vesselId,
        locationNodeId: event.locationNodeId,
        metadata: event.metadata
      });
    } else {
      this.queue.enqueue({
        eventId: this.createEventId(),
        simulationTime: event.simulationTime + (this.config.berthWaitHours || 1),
        eventType: 'WAITING_FOR_BERTH',
        entityId: vessel.vesselId,
        locationNodeId: event.locationNodeId,
        metadata: event.metadata
      });
    }
  }

  private handleWaitingForBerth(event: SimulationEvent) {
    const portConfig = this.config.portCapacity || { defaultBerths: 2 };
    if (this.portCapacityPolicy.canEnterPort(event.locationNodeId, portConfig)) {
      this.portCapacityPolicy.vesselEntered(event.locationNodeId);
      this.queue.enqueue({
        eventId: this.createEventId(),
        simulationTime: event.simulationTime,
        eventType: 'UNLOAD_STARTED',
        entityId: event.entityId,
        locationNodeId: event.locationNodeId,
        metadata: event.metadata
      });
    } else {
      this.queue.enqueue({
        eventId: this.createEventId(),
        simulationTime: event.simulationTime + (this.config.berthWaitHours || 1),
        eventType: 'WAITING_FOR_BERTH',
        entityId: event.entityId,
        locationNodeId: event.locationNodeId,
        metadata: event.metadata
      });
    }
  }

  private handleUnloadStarted(event: SimulationEvent) {
    const vessel = this.context.getVessel(event.entityId);
    StateMachine.transitionVessel(vessel.status, 'UNLOADING');
    this.context.updateVessel(vessel.vesselId, { status: 'UNLOADING' });
    
    const extraDelay = this.config.portDelayModifier?.getAdditionalDelay(event.locationNodeId, 'UNLOAD', event.simulationTime) || 0;

    this.queue.enqueue({
      eventId: this.createEventId(),
      simulationTime: event.simulationTime + this.config.unloadDurationHours + extraDelay,
      eventType: 'UNLOAD_COMPLETED',
      entityId: vessel.vesselId,
      locationNodeId: event.locationNodeId,
      metadata: { ...event.metadata }
    });
  }

  private handleUnloadCompleted(event: SimulationEvent) {
    const vessel = this.context.getVessel(event.entityId);
    StateMachine.transitionVessel(vessel.status, 'IDLE');
    const lateCargoIds: string[] = [];
    for (const cid of vessel.assignedCargoIds) {
      const cargo = this.context.getCargo(cid);
      StateMachine.transitionCargo(cargo.status, 'DELIVERED');
      const latenessHours = cargo.deadline === undefined ? undefined : Math.max(0, event.simulationTime - cargo.deadline);
      const deadlineMet = latenessHours === undefined ? undefined : latenessHours === 0;
      if (deadlineMet === false) lateCargoIds.push(cid);
      this.context.updateCargo(cid, { status: 'DELIVERED', assignedVesselId: undefined, deadlineMet, latenessHours });
    }
    event.metadata.lateCargoIds = lateCargoIds;
    
    this.context.updateVessel(vessel.vesselId, {
      status: 'IDLE',
      assignedCargoIds: [],
      currentRoute: undefined,
      currentVoyageStartedAt: undefined,
      expectedArrivalAt: undefined,
    });
    
    // Free the berth when unloading is complete
    this.portCapacityPolicy.vesselDeparted(event.locationNodeId);

    // vessel is now idle but might stay in port, for now assume available
    this.queue.enqueue({
      eventId: this.createEventId(),
      simulationTime: event.simulationTime,
      eventType: 'SHIP_AVAILABLE',
      entityId: vessel.vesselId,
      locationNodeId: event.locationNodeId,
      metadata: {}
    });
  }

  private handleShipAvailable(event: SimulationEvent) {
    const vessel = this.context.getVessel(event.entityId);
    if (this.config.bunkerPortNodeIds?.includes(vessel.currentNodeId)
      && (vessel.fuelRemainingTonnes ?? Infinity) < (vessel.fuelCapacityTonnes ?? Infinity) * 0.75) {
      this.queue.enqueue({
        eventId: this.createEventId(),
        simulationTime: event.simulationTime + (this.config.bunkeringDurationHours ?? 2),
        eventType: 'BUNKERING_COMPLETED',
        entityId: vessel.vesselId,
        locationNodeId: vessel.currentNodeId,
        metadata: {
          refuelledTonnes: (vessel.fuelCapacityTonnes ?? 0) - (vessel.fuelRemainingTonnes ?? 0),
        },
      });
      return;
    }
    let nextCargoTime = Infinity;

    for (const cargo of this.context.cargoes.values()) {
      if (cargo.status === 'CREATED'
        && !this.reservedCargoIds.has(cargo.cargoId)
        && this.cargoCompatibilityPolicy.isCompatible(cargo.cargoType ?? 'GENERAL', vessel.vesselCapability)
        && this.capacityPolicy.canAccept(vessel.vesselCapability, 0, cargo.quantity || 100)) {
        const earliestDeparture = cargo.earliestDeparture ?? 0;
        if (earliestDeparture > event.simulationTime) {
          nextCargoTime = Math.min(nextCargoTime, earliestDeparture);
          continue;
        }
        if (cargo.originNodeId !== vessel.currentNodeId) continue;
        
        this.reservedCargoIds.add(cargo.cargoId);
        this.queue.enqueue({
          eventId: this.createEventId(),
          simulationTime: event.simulationTime,
          eventType: 'SHIP_ASSIGNED',
          entityId: vessel.vesselId,
          locationNodeId: vessel.currentNodeId,
          metadata: { cargoIds: [cargo.cargoId] }
        });
        return;
      }
    }

    const queuedAvailability = this.queue.nextTime('SHIP_AVAILABLE', vessel.vesselId);
    let nearestReposition: { cargoId: string; routeDistance: number; routePath: NodeId[] } | undefined;
    for (const cargo of this.context.cargoes.values()) {
      if (cargo.status !== 'CREATED'
        || this.reservedCargoIds.has(cargo.cargoId)
        || cargo.originNodeId === vessel.currentNodeId
        || (cargo.earliestDeparture ?? 0) > event.simulationTime
        || !this.cargoCompatibilityPolicy.isCompatible(cargo.cargoType ?? 'GENERAL', vessel.vesselCapability)
        || !this.capacityPolicy.canAccept(vessel.vesselCapability, 0, cargo.quantity || 100)) continue;
      const route = this.router.findRoute({
        origin: vessel.currentNodeId as NodeId,
        destination: cargo.originNodeId as NodeId,
        vesselCapability: vessel.vesselCapability,
      });
      if (!route.found) continue;
      if (!nearestReposition || route.totalDistanceKm < nearestReposition.routeDistance) {
        nearestReposition = { cargoId: cargo.cargoId, routeDistance: route.totalDistanceKm, routePath: route.path };
      }
    }
    if (nearestReposition) {
      this.reservedCargoIds.add(nearestReposition.cargoId);
      this.queue.enqueue({
        eventId: this.createEventId(),
        simulationTime: event.simulationTime,
        eventType: 'REPOSITION_STARTED',
        entityId: vessel.vesselId,
        locationNodeId: vessel.currentNodeId,
        metadata: {
          cargoIds: [nearestReposition.cargoId],
          routeNodeIds: nearestReposition.routePath,
          distanceKm: nearestReposition.routeDistance,
        },
      });
      return;
    }
    if (Number.isFinite(nextCargoTime) && (queuedAvailability === undefined || nextCargoTime < queuedAvailability)) {
      if (queuedAvailability !== undefined) this.queue.remove('SHIP_AVAILABLE', vessel.vesselId);
      this.queue.enqueue({
        eventId: this.createEventId(),
        simulationTime: nextCargoTime,
        eventType: 'SHIP_AVAILABLE',
        entityId: vessel.vesselId,
        locationNodeId: vessel.currentNodeId,
        metadata: {},
      });
    }
  }

  private handleBunkeringCompleted(event: SimulationEvent): void {
    const vessel = this.context.getVessel(event.entityId);
    const fuelCapacityTonnes = vessel.fuelCapacityTonnes ?? 0;
    this.context.updateVessel(vessel.vesselId, { fuelRemainingTonnes: fuelCapacityTonnes });
    this.queue.enqueue({
      eventId: this.createEventId(),
      simulationTime: event.simulationTime,
      eventType: 'SHIP_AVAILABLE',
      entityId: vessel.vesselId,
      locationNodeId: event.locationNodeId,
      metadata: { bunkeringComplete: true },
    });
  }

  private handleRepositionStarted(event: SimulationEvent): void {
    const vessel = this.context.getVessel(event.entityId);
    const cargoIds = Array.isArray(event.metadata.cargoIds)
      ? event.metadata.cargoIds.filter((cargoId): cargoId is string => typeof cargoId === 'string')
      : [];
    const cargo = cargoIds.map(cargoId => this.context.cargoes.get(cargoId)).find(item => item?.status === 'CREATED');
    if (!cargo) {
      cargoIds.forEach(cargoId => this.reservedCargoIds.delete(cargoId));
      return;
    }
    const route = this.router.findRoute({
      origin: vessel.currentNodeId as NodeId,
      destination: cargo.originNodeId as NodeId,
      vesselCapability: vessel.vesselCapability,
    });
    if (!route.found) throw new Error(`Cannot reposition ${vessel.vesselId} to ${cargo.originNodeId}`);
    const estimate = this.movement.calculate(route, vessel.vesselCapability, event.simulationTime);
    const fuelBurnTonnes = estimate.durationHours * (vessel.fuelBurnTonnesPerHour ?? 0);
    const fuelRemainingTonnes = vessel.fuelRemainingTonnes ?? Infinity;
    if (fuelRemainingTonnes < fuelBurnTonnes) {
      throw new Error(`Vessel ${vessel.vesselId} needs ${fuelBurnTonnes.toFixed(1)} t fuel to reposition but has ${fuelRemainingTonnes.toFixed(1)} t`);
    }
    StateMachine.transitionVessel(vessel.status, 'REPOSITIONING');
    this.context.updateVessel(vessel.vesselId, {
      status: 'REPOSITIONING',
      currentRoute: route,
      fuelRemainingTonnes: fuelRemainingTonnes - fuelBurnTonnes,
      currentVoyageStartedAt: event.simulationTime,
      expectedArrivalAt: event.simulationTime + estimate.durationHours,
    });
    this.queue.enqueue({
      eventId: this.createEventId(),
      simulationTime: event.simulationTime + estimate.durationHours,
      eventType: 'REPOSITION_ARRIVED',
      entityId: vessel.vesselId,
      locationNodeId: cargo.originNodeId,
      metadata: { ...event.metadata, fuelBurnTonnes, distanceKm: estimate.distanceKm },
    });
  }

  private handleRepositionArrived(event: SimulationEvent): void {
    const vessel = this.context.getVessel(event.entityId);
    StateMachine.transitionVessel(vessel.status, 'IDLE');
    this.context.updateVessel(vessel.vesselId, {
      status: 'IDLE',
      currentNodeId: event.locationNodeId,
      currentRoute: undefined,
      currentVoyageStartedAt: undefined,
      expectedArrivalAt: undefined,
    });
    const cargoIds = Array.isArray(event.metadata.cargoIds)
      ? event.metadata.cargoIds.filter((cargoId): cargoId is string => typeof cargoId === 'string' && this.context.cargoes.get(cargoId)?.status === 'CREATED')
      : [];
    if (cargoIds.length === 0) {
      for (const cargoId of Array.isArray(event.metadata.cargoIds) ? event.metadata.cargoIds : []) {
        if (typeof cargoId === 'string') this.reservedCargoIds.delete(cargoId);
      }
      this.queue.enqueue({
        eventId: this.createEventId(),
        simulationTime: event.simulationTime,
        eventType: 'SHIP_AVAILABLE',
        entityId: vessel.vesselId,
        locationNodeId: event.locationNodeId,
        metadata: {},
      });
      return;
    }
    this.queue.enqueue({
      eventId: this.createEventId(),
      simulationTime: event.simulationTime,
      eventType: 'SHIP_ASSIGNED',
      entityId: vessel.vesselId,
      locationNodeId: event.locationNodeId,
      metadata: { cargoIds },
    });
  }
}
