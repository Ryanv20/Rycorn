import { SimulationEngine, type SimulationInput } from '@rycon/engine';
import { getDemoNetwork, DEMO_VESSELS, DEMO_CARGOES } from '../demo/demoNetwork.js';

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
}

export interface BroadcastMessage {
  type: 'SIMULATION_EVENT' | 'STATE_UPDATE' | 'ADMIN';
  [key: string]: unknown;
}

export class SimulationStream {
  private engine:     SimulationEngine | null = null;
  private connections = new Set<WebSocketConnection>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private tickIntervalMs = 200;
  private eventsProcessed = 0;
  private startedAt:    number | null = null;
  private errors:       Array<{ message: string; timestamp: number }> = [];
  private engineRunning = false;

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
    this.engine = new SimulationEngine();
    this.eventsProcessed = 0;
    this.startedAt = Date.now();
    this.errors = [];

    // Always use the server-built network — never trust a network from the client
    this.engine.initialize({
      vessels: input?.vessels ?? DEMO_VESSELS,
      cargoes: input?.cargoes ?? DEMO_CARGOES,
      network: getDemoNetwork(),
      config:  input?.config,
    });

    this.broadcastStateUpdate(0);
    this.broadcast({ type: 'ADMIN', payload: this.getSystemStatus() });
  }

  run(): void {
    if (!this.engine) this.initialize();
    if (this.intervalId) return;
    this.engineRunning = true;

    this.intervalId = setInterval(() => {
      try {
        this.step();
      } catch (err: any) {
        this.recordError(err.message);
        this.pause();
      }
    }, this.tickIntervalMs);

    this.broadcast({ type: 'ADMIN', payload: this.getSystemStatus() });
  }

  pause(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.engineRunning = false;
    this.broadcast({ type: 'ADMIN', payload: this.getSystemStatus() });
  }

  step(): SimulationEvent | undefined {
    if (!this.engine) throw new Error('Engine not initialized');

    const event = this.engine.step() as any;
    if (event) {
      this.eventsProcessed++;
      this.broadcast({ type: 'SIMULATION_EVENT', event, timestamp: Date.now() });
      this.broadcastStateUpdate(event.simulationTime);
      this.broadcast({ type: 'ADMIN', payload: this.getSystemStatus() });
    } else {
      this.pause(); // simulation complete
    }
    return event;
  }

  reset(): void {
    this.pause();
    this.engine = null;
    this.eventsProcessed = 0;
    this.startedAt = null;
    this.errors = [];
    this.broadcast({ type: 'ADMIN', payload: this.getSystemStatus() });
  }

  setSpeed(multiplier: number): void {
    this.tickIntervalMs = Math.max(10, 200 / multiplier);
    if (this.intervalId) { this.pause(); this.run(); }
  }

  // ── Getters ────────────────────────────────────────────────────────────
  getStatus() {
    return this.engine?.getState() ?? null;
  }

  getEvents() {
    return this.engine?.getEvents() ?? [];
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

  private broadcastStateUpdate(clockTime: number): void {
    const state = this.engine?.getState();
    if (!state) return;
    this.broadcast({
      type: 'STATE_UPDATE',
      vessels:        Array.from(state.vessels.values()),
      cargoes:        Array.from(state.cargoes.values()),
      simulationTime: clockTime,
    });
  }

  private recordError(message: string): void {
    const entry = { message, timestamp: Date.now() };
    this.errors.push(entry);
    this.broadcast({ type: 'ADMIN', payload: this.getSystemStatus() });
    this.broadcast({ type: 'ERROR_LOG', errors: this.errors });
  }
}

// Singleton
export const simulationStream = new SimulationStream();

// Type re-export so routes can import it
type SimulationEvent = ReturnType<SimulationStream['step']>;
