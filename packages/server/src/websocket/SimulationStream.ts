import { SimulationEngine, type CargoDefinition, type SimulationInput } from '@rycon/engine';
import type { CargoDemand, DemandStatus } from '@rycon/ds-system';
import { getDemoNetwork, DEMO_VESSELS, DEMO_CARGOES } from '../demo/demoNetwork.js';
import { dsStore } from '../dsStore.js';

interface WebSocketConnection {
  readyState: number;
  send(payload: string): void;
  on(event: 'close', listener: () => void): void;
}

export type AdminMessage =
  | { type: 'CONNECTION_COUNT'; count: number }
  | { type: 'ERROR'; message: string; timestamp: number }
  | { type: 'SYSTEM_STATUS'; status: SystemStatus };

export interface SystemStatus {
  engineInitialized: boolean;
  engineRunning:     boolean;
  connectionCount:   number;
  totalEventsProcessed: number;
  startedAt:         number | null;
  uptime:            number;
  clockProfileId:    ClockProfileId;
}

export interface TimeMetadata {
  eventId?: string;
  simulationTimeHours: number;
  simulationTimeSource: 'engine-event-queue';
  observedAtUtc: string;
  observedAtEpochMs: number;
  observedAtSource: 'server-host-system-clock';
}

export type ClockProfileId = 'REAL_TIME' | 'HOUR_PER_SECOND' | 'DAY_PER_MINUTE' | 'FAST_REVIEW' | 'MINUTE_PER_SECOND' | 'SIX_HOURS_PER_SECOND' | 'WEEK_PER_SECOND';

export interface ClockProfile {
  id: ClockProfileId;
  label: string;
  description: string;
  simulatedHoursPerWallSecond: number;
}

export const CLOCK_PROFILES: ClockProfile[] = [
  { id: 'REAL_TIME', label: 'RTS · Real time', description: 'One simulated hour takes one wall-clock hour.', simulatedHoursPerWallSecond: 1 / 3600 },
  { id: 'HOUR_PER_SECOND', label: 'One hour / second', description: 'One simulated hour advances every real second.', simulatedHoursPerWallSecond: 1 },
  { id: 'DAY_PER_MINUTE', label: 'One day / minute', description: 'Twenty-four simulated hours advance each real minute.', simulatedHoursPerWallSecond: 0.4 },
  { id: 'FAST_REVIEW', label: 'Fast review', description: 'One simulated day advances every real second.', simulatedHoursPerWallSecond: 24 },
  { id: 'MINUTE_PER_SECOND', label: 'Minute / second', description: 'One modeled minute advances each real second for slow, readable playback.', simulatedHoursPerWallSecond: 1 / 60 },
  { id: 'SIX_HOURS_PER_SECOND', label: 'Six hours / second', description: 'Six modeled hours advance each real second for quick scenario review.', simulatedHoursPerWallSecond: 6 },
  { id: 'WEEK_PER_SECOND', label: 'Week / second', description: 'One modeled week advances each real second for high speed batch runs.', simulatedHoursPerWallSecond: 168 },
];

export interface BroadcastMessage {
  type: 'SIMULATION_EVENT' | 'STATE_UPDATE' | 'ADMIN';
  [key: string]: unknown;
}

export class SimulationStream {
  private engine:     SimulationEngine | null = null;
  private connections = new Set<WebSocketConnection>();
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private clockProfileId: ClockProfileId = 'HOUR_PER_SECOND';
  private eventsProcessed = 0;
  private startedAt:    number | null = null;
  private errors:       Array<{ message: string; timestamp: number }> = [];
  private engineRunning = false;
  private resumeOnDemand = false;
  private timeObservations: TimeMetadata[] = [];
  private continuousTemplate: CargoDemand[] = [];
  private continuousCycle = 0;

  // ── Connection management ──────────────────────────────────────────────
  addConnection(conn: WebSocketConnection): void {
    this.connections.add(conn);
    conn.on('close', () => this.connections.delete(conn));

    // Send current status immediately on connect
    this.sendTo(conn, { type: 'ADMIN', payload: this.getSystemStatus() });
    this.broadcastConnectionCount();
  }

  get connectionCount(): number {
    return this.connections.size;
  }

  // ── Engine lifecycle ───────────────────────────────────────────────────
  initialize(input?: Partial<SimulationInput>): void {
    this.pause();
    this.resumeOnDemand = false;
    this.engine = new SimulationEngine();
    this.eventsProcessed = 0;
    this.startedAt = Date.now();
    this.errors = [];
    this.timeObservations = [];

    // Always use the server-built network — never trust a network from the client
    this.engine.initialize({
      vessels: input?.vessels ?? DEMO_VESSELS,
      cargoes: input?.cargoes ?? DEMO_CARGOES,
      network: input?.network ?? getDemoNetwork(),
      config:  input?.config,
    });

    this.broadcastStateUpdate(0);
    this.broadcast({ type: 'ADMIN', payload: this.getSystemStatus() });
  }

  run(): void {
    if (!this.engine) this.initialize();
    this.resumeOnDemand = true;
    if (this.timerId) return;
    this.engineRunning = true;
    this.scheduleNextEvent();

    this.broadcast({ type: 'ADMIN', payload: this.getSystemStatus() });
  }

  pause(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.engineRunning = false;
    this.resumeOnDemand = false;
    this.broadcast({ type: 'ADMIN', payload: this.getSystemStatus() });
  }

  addDemand(demand: CargoDemand): boolean {
    if (!this.engine) return false;
    this.engine.addCargo(this.toCargoDefinition(demand));
    if (!this.engineRunning && this.resumeOnDemand) this.run();
    return true;
  }

  updateDemand(demand: CargoDemand): boolean {
    if (!this.engine?.getState().cargoes.has(demand.requestId)) return false;
    this.engine.updateCargo(demand.requestId, this.toCargoDefinition(demand));
    return true;
  }

  cancelDemand(requestId: string): boolean {
    if (!this.engine?.getState().cargoes.has(requestId)) return false;
    this.engine.cancelCargo(requestId);
    return true;
  }

  step(): SimulationEvent | undefined {
    if (!this.engine) throw new Error('Engine not initialized');

    let event: SimulationEvent | undefined;
    try {
      event = this.engine.step();
    } catch (error) {
      const events = this.engine.getEvents();
      const failedEvent = events[events.length - 1];
      if (failedEvent) this.failDemandFromEvent(failedEvent);
      throw error;
    }
    if (event) {
      this.updateDemandStatus(event);
      this.eventsProcessed++;
      const timeMetadata = this.createTimeMetadata(event.simulationTime, event.eventId);
      this.timeObservations.push(timeMetadata);
      this.broadcast({ type: 'SIMULATION_EVENT', event, timestamp: timeMetadata.observedAtEpochMs, timeMetadata });
      this.broadcastStateUpdate(event.simulationTime, timeMetadata);
      this.broadcast({ type: 'ADMIN', payload: this.getSystemStatus() });
    } else {
      this.finishCurrentQueue();
    }
    return event;
  }

  reset(): void {
    this.pause();
    this.engine = null;
    this.eventsProcessed = 0;
    this.startedAt = null;
    this.errors = [];
    this.timeObservations = [];
    this.resumeOnDemand = false;
    this.broadcast({ type: 'ADMIN', payload: this.getSystemStatus() });
  }

  setClockProfile(profileId: ClockProfileId): void {
    if (!CLOCK_PROFILES.some(profile => profile.id === profileId)) throw new Error(`Unknown clock profile ${profileId}`);
    this.clockProfileId = profileId;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.engineRunning) this.scheduleNextEvent();
    this.broadcast({ type: 'ADMIN', payload: this.getSystemStatus() });
  }

  setContinuousDemands(demands: readonly CargoDemand[] | null): void {
    this.continuousTemplate = demands ? [...demands] : [];
    this.continuousCycle = 0;
  }

  getClockProfile(): ClockProfile {
    return CLOCK_PROFILES.find(profile => profile.id === this.clockProfileId)!;
  }

  getClockProfiles(): ClockProfile[] {
    return CLOCK_PROFILES;
  }

  // ── Getters ────────────────────────────────────────────────────────────
  getStatus() {
    return this.engine?.getState() ?? null;
  }

  getEvents() {
    return this.engine?.getEvents() ?? [];
  }

  getTimeObservations(): TimeMetadata[] {
    return [...this.timeObservations];
  }

  getErrors() {
    return this.errors;
  }

  getSystemStatus(): SystemStatus {
    return {
      engineInitialized:    this.engine !== null,
      engineRunning:        this.engineRunning,
      connectionCount:      this.connections.size,
      totalEventsProcessed: this.eventsProcessed,
      startedAt:            this.startedAt,
      uptime:               this.startedAt ? Date.now() - this.startedAt : 0,
      clockProfileId:       this.clockProfileId,
    };
  }

  // ── Broadcast helpers ──────────────────────────────────────────────────
  broadcast(message: object): void {
    const payload = JSON.stringify(message);
    for (const conn of this.connections) {
      if (conn.readyState === 1) conn.send(payload);
    }
  }

  private sendTo(conn: WebSocketConnection, message: object): void {
    if (conn.readyState === 1) conn.send(JSON.stringify(message));
  }

  private broadcastConnectionCount(): void {
    this.broadcast({ type: 'ADMIN', payload: this.getSystemStatus() });
  }

  private broadcastStateUpdate(clockTime: number, timeMetadata?: TimeMetadata): void {
    const state = this.engine?.getState();
    if (!state) return;
    const currentTimeMetadata = timeMetadata ?? this.createTimeMetadata(clockTime);
    this.broadcast({
      type: 'STATE_UPDATE',
      vessels:        Array.from(state.vessels.values()),
      cargoes:        Array.from(state.cargoes.values()),
      simulationTime: clockTime,
      timeMetadata: currentTimeMetadata,
    });
  }

  private recordError(message: string): void {
    const entry = { message, timestamp: Date.now() };
    this.errors.push(entry);
    this.broadcast({ type: 'ADMIN', payload: this.getSystemStatus() });
    this.broadcast({ type: 'ERROR_LOG', errors: this.errors });
  }

  private updateDemandStatus(event: SimulationEvent): void {
    const nextStatus: Partial<Record<SimulationEvent['eventType'], DemandStatus>> = {
      SHIP_ASSIGNED: 'ASSIGNED',
      DEPARTED: 'IN_TRANSIT',
      UNLOAD_COMPLETED: 'DELIVERED',
    };
    const status = nextStatus[event.eventType];
    const cargoIds = event.metadata.cargoIds;
    if (!status || !Array.isArray(cargoIds)) return;
    for (const cargoId of cargoIds) {
      if (typeof cargoId !== 'string') continue;
      const demand = dsStore.getCargoDemands().find(item => item.requestId === cargoId);
      if (demand) dsStore.setDemandStatus(cargoId, status);
    }
  }

  private failDemandFromEvent(event: SimulationEvent): void {
    const cargoIds = event.metadata.cargoIds;
    if (!Array.isArray(cargoIds)) return;
    for (const cargoId of cargoIds) {
      if (typeof cargoId !== 'string') continue;
      const demand = dsStore.getCargoDemands().find(item => item.requestId === cargoId);
      if (demand && ['PENDING', 'ASSIGNED', 'IN_TRANSIT'].includes(demand.status)) {
        dsStore.setDemandStatus(cargoId, 'FAILED');
      }
    }
  }

  private toCargoDefinition(demand: CargoDemand): CargoDefinition {
    return {
      id: demand.requestId,
      origin: demand.origin,
      destination: demand.destination,
      quantity: demand.quantity,
      earliestDeparture: demand.earliestDeparture,
      deadline: demand.deadline,
      cargoType: demand.cargoType,
    };
  }

  private finishCurrentQueue(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.engineRunning = false;
    this.broadcast({ type: 'ADMIN', payload: this.getSystemStatus() });
  }

  private scheduleNextEvent(): void {
    if (!this.engine || !this.engineRunning || this.timerId) return;
    const nextEventTime = this.engine.getNextEventTime();
    if (nextEventTime === undefined) {
      if (this.engineRunning && this.continuousTemplate.length > 0) {
        this.continuousCycle += 1;
        for (const demand of this.continuousTemplate) {
          const nextDemand: CargoDemand = {
            ...demand,
            requestId: `${demand.requestId}-C${String(this.continuousCycle).padStart(4, '0')}`,
            earliestDeparture: this.engine.getCurrentSimulationTime(),
            status: 'PENDING',
          };
          dsStore.addDemand(nextDemand);
          this.engine.addCargo(this.toCargoDefinition(nextDemand));
        }
        this.scheduleNextEvent();
        return;
      }
      this.finishCurrentQueue();
      return;
    }
    const profile = this.getClockProfile();
    const timeUntilEvent = Math.max(0, nextEventTime - this.engine.getCurrentSimulationTime());
    const delayMs = Math.max(30, timeUntilEvent / profile.simulatedHoursPerWallSecond * 1000);
    this.timerId = setTimeout(() => {
      this.timerId = null;
      try {
        this.step();
        if (this.engineRunning) this.scheduleNextEvent();
      } catch (error) {
        this.recordError(error instanceof Error ? error.message : 'Simulation event failed');
        this.pause();
      }
    }, delayMs);
  }

  private createTimeMetadata(simulationTimeHours: number, eventId?: string): TimeMetadata {
    const observedAtEpochMs = Date.now();
    return {
      eventId,
      simulationTimeHours,
      simulationTimeSource: 'engine-event-queue',
      observedAtUtc: new Date(observedAtEpochMs).toISOString(),
      observedAtEpochMs,
      observedAtSource: 'server-host-system-clock',
    };
  }
}

// Singleton
export const simulationStream = new SimulationStream();

// Type re-export so routes can import it
type SimulationEvent = ReturnType<SimulationStream['step']>;
