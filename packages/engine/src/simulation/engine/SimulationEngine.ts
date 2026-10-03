import { SimulationEvent } from '../events/SimulationEvent';
import { EventQueue } from '../events/EventQueue';
import { SimulationContext } from '../state/SimulationContext';
import { VesselState } from '../state/VesselState';
import { CargoState } from '../state/CargoState';
import { SimulationConfig } from '../SimulationConfig';
import { EventProcessor } from './EventProcessor';
import { MaritimeNetwork } from '../../domain/network/MaritimeNetwork';
import { Router } from '../../routing/Router';
import { MovementCalculator } from '../../movement/MovementCalculator';
import { VesselCapability } from '../../domain/network/VesselCapability';
import { SimulationClock } from '../SimulationClock';

export interface VesselDefinition {
  id: string;
  capability: VesselCapability;
  startNodeId: string;
  vesselType?: string;
  deadweightTonnes?: number;
  fuelCapacityTonnes?: number;
  fuelRemainingTonnes?: number;
  fuelBurnTonnesPerHour?: number;
}

export interface CargoDefinition {
  id: string;
  origin: string;
  destination: string;
  quantity?: number;
  earliestDeparture?: number;
  deadline?: number;
  cargoType?: string;
}

export interface SimulationInput {
  vessels: VesselDefinition[];
  cargoes: CargoDefinition[];
  network: MaritimeNetwork;
  config?: SimulationConfig;
}

export interface SimulationResult {
  events: SimulationEvent[];
  finalVesselStates: Map<string, VesselState>;
  finalCargoStates: Map<string, CargoState>;
  totalSimulatedHours: number;
}

export class SimulationEngine {
  private clock = new SimulationClock();
  private queue = new EventQueue();
  private context = new SimulationContext();
  private events: SimulationEvent[] = [];
  private processor!: EventProcessor;
  private initialized = false;
  private demandEventCounter = 0;
  
  initialize(input: SimulationInput): void {
    const config = input.config || { loadDurationHours: 2, unloadDurationHours: 2 };
    const router = new Router(input.network);
    const movement = new MovementCalculator(config.speedProfiles, config.movementModifier);
    
    this.processor = new EventProcessor(this.context, this.queue, router, movement, config);
    this.clock.reset();
    this.initialized = true;
    
    for (const v of input.vessels) {
      this.context.vessels.set(v.id, {
        vesselId: v.id,
        vesselCapability: v.capability,
        vesselType: v.vesselType ?? 'GENERAL_CARGO',
        deadweightTonnes: v.deadweightTonnes ?? 12000,
        fuelCapacityTonnes: v.fuelCapacityTonnes ?? 1200,
        fuelRemainingTonnes: v.fuelRemainingTonnes ?? 900,
        fuelBurnTonnesPerHour: v.fuelBurnTonnesPerHour ?? 0.12,
        status: 'IDLE',
        currentNodeId: v.startNodeId,
        assignedCargoIds: []
      });
    }
    
    for (const c of input.cargoes) {
      this.context.cargoes.set(c.id, {
        cargoId: c.id,
        originNodeId: c.origin,
        destinationNodeId: c.destination,
        status: 'CREATED',
        quantity: c.quantity || 100,
        earliestDeparture: c.earliestDeparture ?? 0,
        deadline: c.deadline,
        cargoType: c.cargoType ?? 'GENERAL',
      });
    }
    
    for (const v of input.vessels) {
      this.queue.enqueue({
        eventId: `init-${v.id}`,
        simulationTime: 0,
        eventType: 'SHIP_AVAILABLE',
        entityId: v.id,
        locationNodeId: v.startNodeId,
        metadata: {}
      });
    }

    for (const cargo of input.cargoes) this.scheduleAvailableVessels(cargo);
  }

  addCargo(cargo: CargoDefinition): void {
    if (!this.initialized) throw new Error('Engine must be initialized before adding cargo');
    if (this.context.cargoes.has(cargo.id)) throw new Error(`Cargo ${cargo.id} already exists`);
    this.context.cargoes.set(cargo.id, {
      cargoId: cargo.id,
      originNodeId: cargo.origin,
      destinationNodeId: cargo.destination,
      status: 'CREATED',
      quantity: cargo.quantity ?? 100,
      earliestDeparture: cargo.earliestDeparture ?? this.clock.getTime(),
      deadline: cargo.deadline,
      cargoType: cargo.cargoType ?? 'GENERAL',
    });
    this.scheduleAvailableVessels(cargo);
  }

  updateCargo(cargoId: string, updates: Partial<Omit<CargoDefinition, 'id'>>): void {
    const cargo = this.context.getCargo(cargoId);
    if (cargo.status !== 'CREATED') throw new Error(`Cargo ${cargoId} can only be edited before assignment`);
    this.context.updateCargo(cargoId, {
      originNodeId: updates.origin ?? cargo.originNodeId,
      destinationNodeId: updates.destination ?? cargo.destinationNodeId,
      quantity: updates.quantity ?? cargo.quantity,
      earliestDeparture: updates.earliestDeparture ?? cargo.earliestDeparture,
      deadline: updates.deadline ?? cargo.deadline,
      cargoType: updates.cargoType ?? cargo.cargoType,
    });
    this.scheduleAvailableVessels({
      id: cargoId,
      origin: updates.origin ?? cargo.originNodeId,
      destination: updates.destination ?? cargo.destinationNodeId,
      earliestDeparture: updates.earliestDeparture ?? cargo.earliestDeparture,
    });
  }

  cancelCargo(cargoId: string): void {
    const cargo = this.context.getCargo(cargoId);
    if (cargo.status !== 'CREATED') throw new Error(`Cargo ${cargoId} can only be cancelled before assignment`);
    this.context.updateCargo(cargoId, { status: 'CANCELLED' });
  }

  run(): SimulationResult {
    while (!this.queue.isEmpty()) {
      const event = this.queue.dequeue()!;
      this.clock.advance(event.simulationTime - this.clock.getTime());
      this.events.push(event);
      this.processor.process(event);
    }
    
    return {
      events: this.events,
      finalVesselStates: this.context.vessels,
      finalCargoStates: this.context.cargoes,
      totalSimulatedHours: this.clock.getTime()
    };
  }

  step(): SimulationEvent | undefined {
    if (this.queue.isEmpty()) return undefined;
    const event = this.queue.dequeue()!;
    this.clock.advance(event.simulationTime - this.clock.getTime());
    this.events.push(event);
    this.processor.process(event);
    return event;
  }

  getState(): SimulationContext {
    return this.context;
  }

  getEvents(): SimulationEvent[] {
    return this.events;
  }

  getCurrentSimulationTime(): number {
    return this.clock.getTime();
  }

  getNextEventTime(): number | undefined {
    return this.queue.peek()?.simulationTime;
  }

  private scheduleAvailableVessels(cargo: CargoDefinition): void {
    const earliestDeparture = Math.max(
      this.clock.getTime(),
      cargo.earliestDeparture ?? this.clock.getTime(),
    );
    for (const vessel of this.context.vessels.values()) {
      if (vessel.status !== 'IDLE' || vessel.currentNodeId !== cargo.origin) continue;
      const queuedAvailability = this.queue.nextTime('SHIP_AVAILABLE', vessel.vesselId);
      if (queuedAvailability !== undefined && queuedAvailability <= earliestDeparture) continue;
      if (queuedAvailability !== undefined) this.queue.remove('SHIP_AVAILABLE', vessel.vesselId);
      this.queue.enqueue({
        eventId: `demand-${++this.demandEventCounter}-${vessel.vesselId}`,
        simulationTime: earliestDeparture,
        eventType: 'SHIP_AVAILABLE',
        entityId: vessel.vesselId,
        locationNodeId: cargo.origin,
        metadata: {},
      });
    }
  }
}
