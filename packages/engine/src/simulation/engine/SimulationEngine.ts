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
}

export interface CargoDefinition {
  id: string;
  origin: string;
  destination: string;
  quantity?: number;
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
  
  initialize(input: SimulationInput): void {
    const config = input.config || { loadDurationHours: 2, unloadDurationHours: 2 };
    const router = new Router(input.network);
    const movement = new MovementCalculator(config.speedProfiles, config.movementModifier);
    
    this.processor = new EventProcessor(this.context, this.queue, router, movement, config);
    this.clock.reset();
    
    for (const v of input.vessels) {
      this.context.vessels.set(v.id, {
        vesselId: v.id,
        vesselCapability: v.capability,
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
        quantity: c.quantity || 100 // fallback
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
}
