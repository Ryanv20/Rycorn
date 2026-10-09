// ============================================================
// LearnersD — All learning content about the Rycorn system
// ============================================================

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type Category = 'overview' | 'domain' | 'engine' | 'server' | 'client' | 'ds' | 'data' | 'architecture';

export interface CodeExample {
  filename: string;
  language: string;
  code: string;
  note?: string;
}

export interface Section {
  id: string;
  title: string;
  content: string;              // Markdown-lite: supports **bold**, `code`, > blockquote, ## headings
  content2?: string;            // Optional second content block
  code?: CodeExample[];
  diagram?: string;             // ASCII/text diagram
}

export interface Lesson {
  id: string;
  title: string;
  subtitle: string;
  category: Category;
  difficulty: Difficulty;
  emoji: string;
  readTime: number;             // minutes
  sections: Section[];
  quiz?: QuizQuestion[];
  keyTerms?: { term: string; definition: string }[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  answer: number;               // index
  explanation: string;
}

// ============================================================
// LESSONS
// ============================================================

export const lessons: Lesson[] = [

  // ----------------------------------------------------------
  // 1. OVERVIEW
  // ----------------------------------------------------------
  {
    id: 'what-is-rycorn',
    title: 'What is Rycorn?',
    subtitle: 'The big picture — why this system exists and what it does',
    category: 'overview',
    difficulty: 'beginner',
    emoji: '🚢',
    readTime: 5,
    sections: [
      {
        id: 'purpose',
        title: 'System Purpose',
        content: `Rycorn is a **maritime network simulation system**. Its job is to model how vessels transport cargo between geographic ports across a constrained maritime network over simulated time.

Think of it as a virtual shipping world: you give it cargo that needs to move from A to B, vessels available to do the moving, and a network of sea-lanes connecting ports — then it simulates exactly what happens, step by step, down to loading, sailing, arriving, and unloading.

> Rycorn is a **simulation engine**, not a demand-generation system. It consumes cargo requirements from an external source (the DS System) and figures out how to fulfil them.`,
        diagram: `
EXTERNAL DEMAND/SUPPLY SYSTEM
            │
            │  cargo demand
            ▼
        RYCORN CORE
            │
            ├── Geographic Model
            ├── Port Model
            ├── Network Model
            ├── Vessel Model
            ├── Cargo Model
            ├── Routing Engine
            ├── Movement Engine
            ├── Simulation Engine
            └── Port Operations
            │
            ▼
       Simulation Results`,
      },
      {
        id: 'not-doing',
        title: 'What Rycorn Is NOT',
        content: `It's easy to mis-scope the system. Rycorn deliberately **does not**:

- Generate its own cargo demand (that comes from DS_System)
- Manage real ships or real ports
- Store persistent data in a production database (Iteration 1 is in-memory)
- Model weather, piracy, or geopolitical events (future iterations)
- Calculate fuel costs or commercial freight pricing

This tight boundary keeps the simulation engine focused and testable.`,
      },
      {
        id: 'workspace',
        title: 'Workspace Layout',
        content: `The repo is structured as a **pnpm monorepo** with four packages plus the DS System:`,
        diagram: `
Rycorn/
├── DS_System/         Demand & Supply contracts, store, tests
├── packages/
│   ├── engine/        Network, routing, movement, simulation core
│   ├── server/        Fastify API + WebSocket stream + reports
│   └── client/        React/Vite maritime operations UI
└── data/
    ├── raw/           Immutable source datasets (WPI, Natural Earth)
    └── processed/     canonical-ports.json and derivatives`,
      },
    ],
    quiz: [
      {
        id: 'q1',
        question: 'Rycorn is primarily responsible for:',
        options: [
          'Generating cargo demand for shipping companies',
          'Simulating how vessels transport cargo between ports',
          'Managing a real-time fleet tracking dashboard',
          'Optimising freight pricing models',
        ],
        answer: 1,
        explanation: 'Rycorn is a simulation engine. It takes cargo demand from an external DS System and models the movement of vessels through the maritime network.',
      },
      {
        id: 'q2',
        question: 'Which package owns routing and movement calculation?',
        options: ['DS_System', 'packages/server', 'packages/engine', 'packages/client'],
        answer: 2,
        explanation: 'packages/engine owns the maritime graph routing, movement calculation, vessel/cargo states, and the event queue.',
      },
    ],
    keyTerms: [
      { term: 'Simulation Engine', definition: 'The core component that processes events and advances simulated time' },
      { term: 'DS System', definition: 'Demand and Supply System — the external system that provides cargo orders and vessel availability' },
      { term: 'Maritime Network', definition: 'A graph of ports and sea-lane edges the simulation uses for routing' },
      { term: 'Monorepo', definition: 'A single repository containing multiple packages (engine, server, client, DS_System) managed with pnpm workspaces' },
    ],
  },

  // ----------------------------------------------------------
  // 2. DOMAIN MODEL
  // ----------------------------------------------------------
  {
    id: 'domain-model',
    title: 'Domain Model',
    subtitle: 'Ports, vessels, cargo, and the geographic world they inhabit',
    category: 'domain',
    difficulty: 'beginner',
    emoji: '🗺️',
    readTime: 8,
    sections: [
      {
        id: 'geo',
        title: 'Geographic Model',
        content: `Everything in Rycorn is grounded in real geography.

A **geographic region** is a closed loop of coordinate nodes. Any point inside that loop belongs to the region. This is a precise geometric definition, not a hand-waved administrative one.

Coordinates carry:
- \`latitude\` and \`longitude\`
- Coordinate reference information
- **Source provenance** — where the data came from

Coordinates must never be silently altered or fabricated.`,
        code: [
          {
            filename: 'GeoPosition.ts',
            language: 'typescript',
            code: `export interface GeoPosition {
  latitude: number;
  longitude: number;
}

// Used across: Port, GeographicNode, NetworkEdge geometry`,
          },
        ],
      },
      {
        id: 'port',
        title: 'Port Model',
        content: `A **Port** is the primary node type. It can serve as:
- Cargo **origin** or **destination**
- A **route waypoint**
- A vessel's **current location**
- A **simulation event** location

Every port has a stable Rycorn identifier (never a plain integer — see the ID Policy lesson).`,
        code: [
          {
            filename: 'Port.ts',
            language: 'typescript',
            code: `export interface Port {
  id: PortId;           // stable, structured ID
  name: string;
  country: string;
  position: GeoPosition;
  harborType: HarborType;
  harborSize: HarborSize;
  maximumVesselSize: string;
  provenance: Provenance; // data source info
}`,
          },
        ],
      },
      {
        id: 'vessel',
        title: 'Vessel Model',
        content: `Vessels are the primary actors in the simulation. Rycorn uses **five internal capability classes**: A, B, C, D, E — where A is smallest and E is largest.

These are Rycorn simulation abstractions, not official maritime classifications.

Capability affects:
- Which network edges a vessel can traverse (minimum vessel class per edge)
- Port compatibility
- Routing eligibility`,
        code: [
          {
            filename: 'VesselState.ts',
            language: 'typescript',
            code: `export type VesselStatus =
  | 'IDLE'      // waiting for cargo
  | 'ASSIGNED'  // cargo matched, not yet loading
  | 'LOADING'   // cargo being loaded at origin
  | 'SAILING'   // underway on a route
  | 'ARRIVED'   // at destination, pre-unload
  | 'UNLOADING';// cargo being unloaded

export interface VesselState {
  vesselId: string;
  vesselCapability: VesselCapability; // 'A'|'B'|'C'|'D'|'E'
  vesselType?: string;
  deadweightTonnes?: number;
  fuelCapacityTonnes?: number;
  fuelRemainingTonnes?: number;
  fuelBurnTonnesPerHour?: number;
  status: VesselStatus;
  currentNodeId: string;
  assignedCargoIds: string[];
  currentRoute?: RouteResult;
}`,
          },
        ],
      },
      {
        id: 'cargo',
        title: 'Cargo Model',
        content: `Cargo progresses through a lifecycle of statuses. Once a cargo is ASSIGNED or beyond, it can no longer be edited or cancelled — those actions are only possible in CREATED/PENDING state.`,
        code: [
          {
            filename: 'CargoState.ts',
            language: 'typescript',
            code: `export type CargoStatus =
  | 'CREATED'    // in engine, not yet assigned
  | 'ASSIGNED'   // vessel matched
  | 'IN_TRANSIT' // sailing
  | 'DELIVERED'  // unloaded at destination
  | 'CANCELLED'; // cancelled before assignment

export interface CargoState {
  cargoId: string;
  originNodeId: string;
  destinationNodeId: string;
  assignedVesselId?: string;
  status: CargoStatus;
  quantity: number;
  earliestDeparture?: number; // simulated hours from T+0
  deadline?: number;
  cargoType?: string;
}`,
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'q1',
        question: 'What is the vessel capability ranking in Rycorn?',
        options: ['E > D > C > B > A (E is largest)', 'A > B > C > D > E (A is largest)', 'All capabilities are equal', 'It depends on vessel type'],
        answer: 0,
        explanation: 'A < B < C < D < E. E is the largest/most capable class. These are Rycorn simulation abstractions, not official maritime classifications.',
      },
      {
        id: 'q2',
        question: 'At what cargo status can a cargo request be cancelled?',
        options: ['ASSIGNED', 'IN_TRANSIT', 'CREATED', 'DELIVERED'],
        answer: 2,
        explanation: 'Cargo can only be cancelled while in CREATED status. Once assigned to a vessel, it cannot be cancelled.',
      },
    ],
    keyTerms: [
      { term: 'VesselCapability', definition: 'One of A/B/C/D/E — determines which sea-lanes a vessel can use' },
      { term: 'Provenance', definition: 'Metadata recording the source of geographic or port data (e.g. WPI dataset)' },
      { term: 'HarborType', definition: 'Classification of a port\'s physical harbor (e.g. natural, river, lake)' },
      { term: 'deadweightTonnes', definition: 'The carrying capacity of a vessel in metric tonnes' },
    ],
  },

  // ----------------------------------------------------------
  // 3. NETWORK MODEL
  // ----------------------------------------------------------
  {
    id: 'network-model',
    title: 'Maritime Network',
    subtitle: 'The graph of nodes and edges that vessels navigate',
    category: 'domain',
    difficulty: 'intermediate',
    emoji: '🕸️',
    readTime: 7,
    sections: [
      {
        id: 'graph',
        title: 'Graph Fundamentals',
        content: `The maritime network is a **weighted directed graph**:

- **Vertices** (nodes): Ports + Intermediate maritime nodes
- **Edges**: Sea-lane connections with distance and capability constraints

This graph is built by the \`NetworkBuilder\` from port data and validated by \`NetworkValidator\` before any simulation can run.`,
        diagram: `
   PORT A ────────●────────●──────── PORT B
             (intermediate nodes ~5km apart)

   PORT B ──────────────────────────── PORT C
              (direct, short route)

Edges carry:
  • distanceKm
  • minimumVesselCapability ('A'|'B'|'C'|'D'|'E')`,
      },
      {
        id: 'intermediate',
        title: 'Intermediate Nodes',
        content: `Long maritime routes are **subdivided every ~5 km** using intermediate nodes. This:

1. Increases **network resolution** for movement calculation
2. Allows more accurate **time-step simulation**
3. Lets vessels report position along a route, not just at ports

Intermediate nodes are **not ports** — they cannot be cargo origins/destinations and must not be confused with canonical port nodes.`,
        code: [
          {
            filename: 'NetworkEdge.ts',
            language: 'typescript',
            code: `export interface NetworkEdge {
  id: EdgeId;
  fromNodeId: NodeId;
  toNodeId: NodeId;
  distanceKm: number;
  minimumVesselCapability: VesselCapability;
}

// Branded types prevent mixing up IDs:
export type EdgeId = string & { readonly __brand: unique symbol };`,
          },
        ],
      },
      {
        id: 'compatibility',
        title: 'Edge Compatibility',
        content: `The \`CompatibilityChecker\` enforces the rule: **a vessel can only traverse edges where its capability ≥ the edge's minimum capability**.

So a Class A (smallest) vessel cannot use edges marked as requiring Class C or higher. This models physical constraints like channel depth, bridge clearance, and port berth size.`,
        code: [
          {
            filename: 'CompatibilityChecker.ts',
            language: 'typescript',
            code: `// Capability order: A < B < C < D < E
const ORDER: Record<VesselCapability, number> = {
  A: 0, B: 1, C: 2, D: 3, E: 4,
};

export class CompatibilityChecker {
  static isEdgeCompatible(
    edge: NetworkEdge,
    vesselCapability: VesselCapability
  ): boolean {
    return ORDER[vesselCapability] >= ORDER[edge.minimumVesselCapability];
  }
}`,
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'q1',
        question: 'Can a Class B vessel traverse an edge with minimumVesselCapability of D?',
        options: [
          'Yes — vessel capability has no effect on routing',
          'No — B < D, so the edge is incompatible',
          'Only if the vessel carries less than 50% cargo',
          'Yes — minimumVesselCapability only affects speed',
        ],
        answer: 1,
        explanation: 'Capability order is A < B < C < D < E. A Class B vessel cannot use an edge requiring D or higher.',
      },
    ],
    keyTerms: [
      { term: 'NetworkEdge', definition: 'A directed connection between two nodes with a distance and capability constraint' },
      { term: 'Intermediate Node', definition: 'A synthetic network node inserted every ~5km on long edges to increase resolution' },
      { term: 'CompatibilityChecker', definition: 'Determines whether a vessel can use a given edge based on capability class' },
      { term: 'Branded Type', definition: 'A TypeScript pattern using `& { readonly __brand: unique symbol }` to prevent accidental ID type mixing' },
    ],
  },

  // ----------------------------------------------------------
  // 4. ROUTING ENGINE
  // ----------------------------------------------------------
  {
    id: 'routing-engine',
    title: 'Routing Engine',
    subtitle: "Dijkstra's algorithm adapted for vessel capability constraints",
    category: 'engine',
    difficulty: 'intermediate',
    emoji: '🧭',
    readTime: 8,
    sections: [
      {
        id: 'algorithm',
        title: "Dijkstra's Shortest Path",
        content: `The \`Router\` uses **Dijkstra's algorithm** to find the shortest valid path between two nodes — but with a Rycorn twist: edges incompatible with the vessel's capability class are **skipped during traversal**.

This means two vessels at the same port, going to the same destination, may take completely different routes if their capabilities differ.`,
        code: [
          {
            filename: 'Router.ts (simplified)',
            language: 'typescript',
            code: `findRoute(options: RouterOptions): RouteResult {
  const { origin, destination, vesselCapability } = options;
  
  // Initialise distance map — all infinity except origin
  const dist = new Map<NodeId, number>();
  for (const nodeId of this.network.nodes.keys()) {
    dist.set(nodeId, Infinity);
  }
  dist.set(origin, 0);

  while (unvisited.size > 0) {
    const current = pickLowestDist(unvisited, dist);
    if (current === destination) break;

    for (const edge of this.network.getEdgesFrom(current)) {
      // KEY: skip incompatible edges
      if (!CompatibilityChecker.isEdgeCompatible(edge, vesselCapability)) {
        continue;
      }
      // Relax edge if shorter path found
      const alt = dist.get(current)! + edge.distanceKm;
      if (alt < dist.get(edge.toNodeId)!) {
        dist.set(edge.toNodeId, alt);
        prev.set(edge.toNodeId, current);
      }
    }
  }
  // Reconstruct path from 'prev' map...
}`,
          },
        ],
      },
      {
        id: 'result',
        title: 'Route Result Shape',
        content: `The router returns a **discriminated union** — either a successful route with full path data, or a failure with a clear reason string. Consumers must check \`found\` before using path data.`,
        code: [
          {
            filename: 'Router.ts',
            language: 'typescript',
            code: `export interface RouteResultFound {
  found: true;
  path: NodeId[];           // sequence of node IDs
  totalDistanceKm: number;  // sum of edge distances
  edges: EdgeId[];          // sequence of edge IDs
}

export interface RouteResultNotFound {
  found: false;
  reason: string; // e.g. "Origin node X not found"
}

export type RouteResult = RouteResultFound | RouteResultNotFound;

// Usage:
const result = router.findRoute({ origin, destination, vesselCapability });
if (result.found) {
  console.log('Distance:', result.totalDistanceKm, 'km');
} else {
  console.error('Route failed:', result.reason);
}`,
          },
        ],
      },
      {
        id: 'routing-steps',
        title: 'Explicit Routing Steps',
        content: `The architecture spec mandates that business logic be **explicit at every step** — no black-box routing functions. The conceptual flow is:`,
        diagram: `
REQUEST ROUTE
    ↓
Validate origin/destination (nodes exist in network?)
    ↓
Load vessel capability
    ↓
Get network
    ↓
Filter incompatible edges (CompatibilityChecker)
    ↓
Calculate shortest valid path (Dijkstra)
    ↓
Return RouteResult (found | not found)`,
      },
    ],
    quiz: [
      {
        id: 'q1',
        question: 'What does the Router return when no path exists for the given vessel capability?',
        options: [
          'null',
          'An empty array',
          'RouteResultNotFound with a reason string',
          'Throws an exception',
        ],
        answer: 2,
        explanation: 'The Router returns a discriminated union. When no path is found it returns { found: false, reason: "..." }. It does not throw.',
      },
    ],
    keyTerms: [
      { term: "Dijkstra's Algorithm", definition: 'A graph shortest-path algorithm that explores nodes in order of increasing distance from origin' },
      { term: 'Discriminated Union', definition: 'A TypeScript union type with a shared discriminant field (like `found: true/false`) enabling type-safe narrowing' },
      { term: 'Edge Relaxation', definition: 'Updating a node\'s best-known distance when a shorter path through a neighbour is found' },
    ],
  },

  // ----------------------------------------------------------
  // 5. SIMULATION ENGINE
  // ----------------------------------------------------------
  {
    id: 'simulation-engine',
    title: 'Simulation Engine',
    subtitle: 'Discrete-event simulation — the beating heart of Rycorn',
    category: 'engine',
    difficulty: 'intermediate',
    emoji: '⚙️',
    readTime: 10,
    sections: [
      {
        id: 'des',
        title: 'Discrete-Event Simulation',
        content: `Rycorn uses **Discrete-Event Simulation (DES)**. Instead of running a loop every millisecond, the engine jumps directly from one event to the next — potentially hours or days of simulated time in a single step.

An **event queue** (min-heap by \`simulationTime\`) holds upcoming events. The engine:

1. Dequeues the next event
2. Advances the simulation clock to that event's time
3. Processes the event (which may enqueue more events)
4. Repeats until the queue is empty`,
        diagram: `
Event Queue (sorted by simulationTime):
┌────────────────────────────────────────┐
│  T=0    SHIP_AVAILABLE  vessel-1       │  ← dequeue
│  T=2    LOAD_STARTED    vessel-1       │
│  T=4    LOAD_COMPLETED  vessel-1       │
│  T=47   ARRIVED         vessel-1       │
│  T=49   UNLOAD_STARTED  vessel-1       │
│  T=51   UNLOAD_COMPLETED vessel-1      │
└────────────────────────────────────────┘
         Clock advances on dequeue`,
      },
      {
        id: 'events',
        title: 'Event Types',
        content: `Each event has an \`eventType\` that determines how the \`EventProcessor\` handles it:`,
        code: [
          {
            filename: 'SimulationEvent.ts',
            language: 'typescript',
            code: `export type EventType =
  | 'SHIP_AVAILABLE'    // vessel ready for cargo assignment
  | 'SHIP_ASSIGNED'     // vessel matched to cargo
  | 'LOAD_STARTED'      // loading begins at origin
  | 'LOAD_COMPLETED'    // loading done, about to depart
  | 'DEPARTED'          // vessel left origin port
  | 'ARRIVED'           // vessel reached destination
  | 'WAITING_FOR_BERTH' // port at capacity, vessel queuing
  | 'UNLOAD_STARTED'    // unloading begins
  | 'UNLOAD_COMPLETED'  // cargo delivered, vessel free
  | 'BUNKERING_COMPLETED'; // refuelling complete

export interface SimulationEvent {
  readonly eventId: string;
  readonly simulationTime: number; // elapsed modeled hours from T+0
  readonly eventType: EventType;
  readonly entityId: string;       // vesselId or cargoId
  readonly locationNodeId: string;
  readonly metadata: Record<string, unknown>;
}`,
          },
        ],
      },
      {
        id: 'voyage-lifecycle',
        title: 'A Complete Voyage Lifecycle',
        content: `Each step is a bounded, testable event. Nothing is implicit.`,
        diagram: `
Cargo Request arrives (PENDING in DS)
    ↓
SHIP_AVAILABLE triggers cargo scan
    ↓
SHIP_ASSIGNED  (vessel ↔ cargo matched)
    ↓
LOAD_STARTED   (at origin port, duration = config.loadDurationHours)
    ↓
LOAD_COMPLETED
    ↓
DEPARTED
    ↓
[intermediate ARRIVED at waypoints if modelled]
    ↓
ARRIVED        (at destination port)
    ↓
UNLOAD_STARTED (duration = config.unloadDurationHours)
    ↓
UNLOAD_COMPLETED → cargo status = DELIVERED
    ↓
SHIP_AVAILABLE (vessel free again)`,
      },
      {
        id: 'engine-api',
        title: 'Engine API',
        content: `\`SimulationEngine\` exposes three modes of operation:

- \`initialize(input)\` — set up vessels, cargo, and network
- \`run()\` — execute the full simulation to completion, return results
- \`step()\` — process a single event (useful for the live UI streaming mode)
- \`addCargo()\` — inject new cargo mid-simulation (used by the server's DS adapter)`,
        code: [
          {
            filename: 'SimulationEngine.ts',
            language: 'typescript',
            code: `const engine = new SimulationEngine();
engine.initialize({
  vessels: [...],
  cargoes: [...],
  network: maritimeNetwork,
  config: { loadDurationHours: 2, unloadDurationHours: 2 },
});

// Run all at once:
const result = engine.run();
console.log('Simulated hours:', result.totalSimulatedHours);
console.log('Events:', result.events.length);

// OR step-by-step (for live streaming):
let event = engine.step();
while (event) {
  broadcastToClients(event);
  event = engine.step();
}`,
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'q1',
        question: 'What does `simulationTime` represent in a SimulationEvent?',
        options: [
          'The current UTC wall-clock time',
          'Elapsed modelled hours from T+0',
          'A Unix timestamp in milliseconds',
          'The number of simulation steps taken',
        ],
        answer: 1,
        explanation: 'simulationTime is elapsed modelled hours from T+0. It is completely independent from wall-clock time (UTC) which is tracked separately by timeMetadata.observedAtUtc.',
      },
      {
        id: 'q2',
        question: 'What happens after UNLOAD_COMPLETED?',
        options: [
          'The simulation ends',
          'A SHIP_AVAILABLE event is enqueued, freeing the vessel',
          'The cargo status becomes IN_TRANSIT',
          'The vessel moves back to its origin automatically',
        ],
        answer: 1,
        explanation: 'After unloading, the engine enqueues a SHIP_AVAILABLE event for the vessel, making it available for the next cargo assignment.',
      },
    ],
    keyTerms: [
      { term: 'Discrete-Event Simulation', definition: 'A simulation paradigm where system state changes only at discrete event points, not continuously' },
      { term: 'Event Queue', definition: 'A priority queue sorted by simulationTime; the engine always processes the earliest event next' },
      { term: 'SimulationClock', definition: 'Tracks the current simulated time (in hours from T+0); only advances on event dequeue' },
      { term: 'EventProcessor', definition: 'Handles each event type, updates system state, and schedules follow-up events' },
    ],
  },

  // ----------------------------------------------------------
  // 6. DS SYSTEM
  // ----------------------------------------------------------
  {
    id: 'ds-system',
    title: 'DS System',
    subtitle: 'Demand & Supply — the external business world interface',
    category: 'ds',
    difficulty: 'beginner',
    emoji: '📦',
    readTime: 6,
    sections: [
      {
        id: 'what-is-ds',
        title: 'What is the DS System?',
        content: `**DS = Demand and Supply System**. It represents the outside business world that tells Rycorn:

1. What **cargo** needs to move (demand)
2. What **vessels** are available (supply)

DS_System is intentionally isolated. It knows nothing about how the simulation works. It just validates and exposes neutral contracts that the engine can consume.`,
        diagram: `
DS_System responsibilities:
─────────────────────────────────────────────
  ✓  Accept cargo demand (orders/bookings)
  ✓  Describe vessel supply
  ✓  Validate via Zod schemas
  ✓  Track demand lifecycle statuses
  ✓  Expose clean contracts

DS_System must NOT:
─────────────────────────────────────────────
  ✗  Import from packages/engine
  ✗  Decide routes
  ✗  Assign vessels
  ✗  Run simulation
  ✗  Render a dashboard`,
      },
      {
        id: 'demand',
        title: 'Cargo Demand',
        content: `Each cargo demand request carries a full lifecycle status. The DS tracks it; Rycorn writes results back through the server.`,
        code: [
          {
            filename: 'CargoDemand.ts',
            language: 'typescript',
            code: `export const demandStatusSchema = z.enum([
  'PENDING',    // submitted, not yet assigned
  'ASSIGNED',   // vessel picked up the order
  'IN_TRANSIT', // sailing
  'DELIVERED',  // done
  'CANCELLED',  // cancelled by operator
  'FAILED',     // undeliverable
]);

export const cargoDemandSchema = z.object({
  requestId: z.string().min(1),
  origin: z.string().min(1),
  destination: z.string().min(1),
  quantity: z.number().positive(),
  earliestDeparture: z.number().nonnegative(),
  deadline: z.number().positive(),
  cargoType: z.string().default('GENERAL'),
  status: demandStatusSchema.default('PENDING'),
});`,
          },
        ],
      },
      {
        id: 'vessel-supply',
        title: 'Vessel Supply',
        content: `Vessel supply describes the fleet available to Rycorn. The five vessel types map to real-world shipping categories, validated by Zod.`,
        code: [
          {
            filename: 'FleetSupply.ts',
            language: 'typescript',
            code: `export const vesselTypeSchema = z.enum([
  'CONTAINER',
  'BULK_CARRIER',
  'TANKER',
  'GENERAL_CARGO',
  'REEFER',         // refrigerated cargo
]);

export const vesselSupplySchema = z.object({
  id: z.string().min(1),
  capability: vesselCapabilitySchema, // 'A'|'B'|'C'|'D'|'E'
  startNodeId: z.string().min(1),
  vesselType: vesselTypeSchema.default('GENERAL_CARGO'),
  deadweightTonnes: z.number().positive().default(12000),
  fuelCapacityTonnes: z.number().positive().default(1200),
  fuelRemainingTonnes: z.number().nonnegative().default(900),
  fuelBurnTonnesPerHour: z.number().positive().default(0.12),
}).refine(
  v => v.fuelRemainingTonnes <= v.fuelCapacityTonnes,
  { message: 'Remaining fuel cannot exceed capacity' }
);`,
          },
        ],
      },
      {
        id: 'contracts',
        title: 'Provider Contracts',
        content: `The DS System uses **interface contracts** (not implementations) so that providers can be swapped without touching the core. A static file provider, a REST API provider, a database provider, and a message-queue provider all look the same to the consumer.`,
        code: [
          {
            filename: 'DemandProvider.ts',
            language: 'typescript',
            code: `import type { CargoDemand } from '../domain/CargoDemand.js';

export interface DemandProvider {
  getCargoDemands(): Promise<readonly CargoDemand[]> | readonly CargoDemand[];
}

// Concrete implementations:
// StaticDemandProvider  (test adapter, reads hard-coded data)
// Future: ApiDemandProvider, DatabaseDemandProvider, KafkaDemandProvider`,
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'q1',
        question: 'Which statement about DS_System is correct?',
        options: [
          'DS_System can import from packages/engine to assign vessels',
          'DS_System is isolated — it exposes contracts, never runs simulation logic',
          'DS_System directly calls the Router to plan routes',
          'DS_System renders the maritime map',
        ],
        answer: 1,
        explanation: 'DS_System is strictly isolated. It must not import from engine, domain, server, or client. Its role is to validate and expose demand/supply contracts.',
      },
    ],
    keyTerms: [
      { term: 'DemandProvider', definition: 'Interface contract for anything that can supply cargo demand data to Rycorn' },
      { term: 'FleetProvider', definition: 'Interface contract for anything that supplies vessel availability' },
      { term: 'Zod', definition: 'TypeScript-first schema validation library used to validate all incoming DS data' },
      { term: 'REEFER', definition: 'A refrigerated cargo vessel type for temperature-sensitive goods' },
    ],
  },

  // ----------------------------------------------------------
  // 7. SERVER LAYER
  // ----------------------------------------------------------
  {
    id: 'server-layer',
    title: 'Server Layer',
    subtitle: 'Fastify API, WebSocket streaming, and operational reports',
    category: 'server',
    difficulty: 'intermediate',
    emoji: '🖥️',
    readTime: 7,
    sections: [
      {
        id: 'responsibility',
        title: 'What the Server Does',
        content: `The server (\`packages/server\`) is the **adapter layer** between DS, the engine, and the client. It:

- Adapts DS demand records into engine \`CargoDefinition\` objects
- Drives the engine's \`step()\` loop and **streams events** via WebSocket
- Serves REST API routes for simulation control and data queries
- Assembles **operational reports** on demand`,
        diagram: `
DS_System ──→ Server ──→ Engine
                │
                ├── REST API (Fastify)    GET /simulation/state
                │                        POST /simulation/start
                │                        GET /network/ports
                │                        routes: ds, network, root, simulation
                │
                └── WebSocket Stream     live events, vessel positions,
                                         cargo status updates`,
      },
      {
        id: 'websocket',
        title: 'WebSocket Streaming',
        content: `The \`SimulationStream\` class manages the live event feed. The client connects via WebSocket and receives every \`SimulationEvent\` as the engine processes them — enabling the live fleet map and event log.

Real-wall-clock time is stamped on each event as \`timeMetadata.observedAtUtc\` using \`Date.now()\`. This is separate from \`simulationTime\` (modelled hours).`,
        code: [
          {
            filename: 'SimulationStream.ts (concept)',
            language: 'typescript',
            code: `// Server streams each engine step to connected clients
while (true) {
  const event = engine.step();
  if (!event) break;
  
  const payload = {
    ...event,
    timeMetadata: {
      observedAtUtc: new Date().toISOString(), // wall-clock stamp
    },
  };
  
  websocketClients.forEach(client => {
    client.send(JSON.stringify(payload));
  });
}`,
          },
        ],
      },
      {
        id: 'report',
        title: 'Operational Report',
        content: `The server assembles a live **Operational Report** that the client renders. It includes:

- Demand/supply summary (from DS_System)
- Vessel and cargo states
- Route/distance information
- Full event history
- Time observations (simulated vs wall-clock)
- Errors

The report is accessible via **REPORT** in the simulation toolbar and can be exported as JSON or CSV.`,
      },
      {
        id: 'routes',
        title: 'REST API Routes',
        content: `The API is organised by domain concern. All routes are served by **Fastify** — a high-performance Node.js HTTP framework.`,
        code: [
          {
            filename: 'routes/simulation.ts (concept)',
            language: 'typescript',
            code: `// GET  /simulation/state          → current vessels + cargo states
// POST /simulation/start          → initialise + start engine
// POST /simulation/reset          → clear state
// GET  /simulation/time-observations → compare sim vs wall clocks

// GET  /network/ports             → list canonical ports
// GET  /network/edges             → network edge graph

// GET  /ds/demands                → all cargo demand records
// POST /ds/demands                → create new demand
// PATCH /ds/demands/:id           → edit pending demand
// DELETE /ds/demands/:id          → cancel pending demand`,
          },
        ],
      },
    ],
    quiz: [
      {
        id: 'q1',
        question: 'What is `timeMetadata.observedAtUtc`?',
        options: [
          'The simulated calendar date when an event occurs',
          'The wall-clock UTC time when the server processed the event',
          'The vessel\'s local timezone timestamp',
          'The expected arrival time in the simulation',
        ],
        answer: 1,
        explanation: 'observedAtUtc records when the Rycorn server processed an event using Date.now(). It is not a simulated date — it is a real wall-clock stamp for observability.',
      },
    ],
    keyTerms: [
      { term: 'Fastify', definition: 'High-performance Node.js HTTP framework used for the Rycorn REST API' },
      { term: 'SimulationStream', definition: 'WebSocket manager that forwards engine events to all connected clients in real-time' },
      { term: 'OperationalReport', definition: 'Server-assembled document with full shipment, vessel, cargo, event, and timing data' },
      { term: 'observedAtUtc', definition: 'ISO 8601 wall-clock timestamp added by the server when it processes each simulation event' },
    ],
  },

  // ----------------------------------------------------------
  // 8. CLIENT / UI
  // ----------------------------------------------------------
  {
    id: 'client-ui',
    title: 'Client UI',
    subtitle: 'The React maritime operations interface',
    category: 'client',
    difficulty: 'beginner',
    emoji: '🗃️',
    readTime: 6,
    sections: [
      {
        id: 'stack',
        title: 'Tech Stack',
        content: `The client (\`packages/client\`) is a **React + TypeScript + Vite** single-page application. It connects to the server via:

- **REST API** — initial data loads, controls
- **WebSocket** — live event streaming

No Redux or complex state management — the live data flows directly from WebSocket messages into component state.`,
      },
      {
        id: 'views',
        title: 'Key Views and Components',
        content: `The UI is organised around an **AdminSidebar** with four main views:`,
        diagram: `
AdminSidebar
├── Map               — Leaflet/Mapbox interactive map with vessel markers
│                       PortMarker, VesselMarker, SpecialVesselMarker
├── Fleet             — list of all vessels with real-time status
├── Shipments         — list of all cargo with lifecycle status  
├── Activity          — event log (EventLog.tsx)
├── DS System         — DSSystemPage: demand/supply console
├── REPORT            — OperationalReport: live report + export
└── Simulation Controls — SimulationControls: start/step/reset
                          Clock display`,
      },
      {
        id: 'map',
        title: 'Map & Globe Views',
        content: `Two geographic visualisations:

- **Map.tsx** — 2D maritime map with port markers and vessel paths
- **GlobeView.tsx** — 3D globe visualisation (rotatable)

Port and vessel markers update live as WebSocket events arrive. The map is the primary tool for understanding where vessels are and what routes they take.`,
      },
      {
        id: 'ds-console',
        title: 'DS Console',
        content: `The **DSSystemPage** provides an operator console for the DS System:

- View all pending, assigned, in-transit, and delivered demand
- Create new cargo demand
- Edit or cancel PENDING demands
- No login required in development (API binds to 127.0.0.1)

> ⚠️ The unauthenticated development API must never be exposed outside localhost.`,
      },
    ],
    keyTerms: [
      { term: 'Vite', definition: 'Fast ES module-based build tool and dev server used for the React client' },
      { term: 'AdminSidebar', definition: 'Navigation rail component that houses all major views in the client UI' },
      { term: 'GlobeView', definition: 'Optional 3D globe visualisation showing the maritime network globally' },
      { term: 'SimulationControls', definition: 'UI component for starting, stepping, resetting, and observing the simulation clock' },
    ],
  },

  // ----------------------------------------------------------
  // 9. ARCHITECTURE PRINCIPLES
  // ----------------------------------------------------------
  {
    id: 'architecture',
    title: 'Architecture Principles',
    subtitle: 'The design rules that govern how everything fits together',
    category: 'architecture',
    difficulty: 'advanced',
    emoji: '🏛️',
    readTime: 10,
    sections: [
      {
        id: 'layered',
        title: 'Layered Architecture',
        content: `Dependencies only flow **inward**. Business logic never depends on infrastructure.`,
        diagram: `
Domain
  ↓  (depends on nothing)
Interfaces / Contracts
  ↓  (depends on domain)
Application Logic
  ↓  (depends on interfaces)
Infrastructure Adapters
  ↓  (depends on application, implements interfaces)
PostgreSQL / Node / Python / etc.

✓  Domain can be tested without Node.js
✓  Swap PostgreSQL for another DB: only adapters change
✓  Python workers connect via stable contracts only`,
      },
      {
        id: 'loose-coupling',
        title: 'Loose Coupling Rule',
        content: `Business logic must NOT depend directly on Node-specific infrastructure.`,
        code: [
          {
            filename: 'coupling-example.ts',
            language: 'typescript',
            code: `// ❌ BAD — business logic coupled to Prisma (infrastructure)
class VesselService {
  constructor(private prisma: PrismaClient) {}
}

// ✓ GOOD — business logic depends on an abstract interface
class VesselService {
  constructor(private vesselRepository: VesselRepository) {}
}
// VesselRepository is an interface.
// PrismaVesselRepository implements it in the infrastructure layer.`,
            note: 'This keeps domain code portable and independently testable.',
          },
        ],
      },
      {
        id: 'id-policy',
        title: 'Identifier Policy',
        content: `Sequential integers (1, 2, 3...) are **forbidden** as entity IDs. IDs must encode structural information:`,
        code: [
          {
            filename: 'id-policy.ts',
            language: 'typescript',
            code: `// ❌ BAD
const portId = 42;
const vesselId = 7;

// ✓ GOOD — matriculation-style: YY + REGION/TYPE + SEQUENCE
// Example structure: "26-EU-0041"
//   26   = year
//   EU   = region
//   0041 = local sequence

// All ID generation is centralised in one module.
// Changing the format means changing one policy file.`,
          },
        ],
        content2: `IDs must be:
- **Deterministic** — same input always produces same ID
- **Unique** within their namespace
- **Stable** — never change once assigned
- **Machine-readable** and **human-auditable**`,
      },
      {
        id: 'cross-language',
        title: 'Cross-Language Contract Rule',
        content: `> **Node executes the system; contracts define the system.**

Contracts (schemas, interfaces, event shapes) are defined **independently of their implementation language**. This gives a clean migration path to Python without redesigning Rycorn.`,
        diagram: `
Node.js Rycorn Core
        │
        ├── API
        ├── Simulation
        ├── Routing
        └── Operations
                │
                │  stable contracts (JSON schemas / event types)
                ▼
        Python workers
        (analytics / ML / optimization)

Python is a SECONDARY environment.
It is NOT a dependency of the core engine.`,
      },
      {
        id: 'explicit-business-logic',
        title: 'Explicit Business Logic',
        content: `Each business step must be **visible and bounded** in code. No single function should silently do multiple conceptual steps.

The architecture spec gives the voyage as the canonical example:`,
        diagram: `
Cargo Request
    ↓ Assign Vessel
    ↓ Validate Vessel/Cargo
    ↓ Load Cargo
    ↓ Calculate Compatible Route
    ↓ Calculate Travel Duration
    ↓ Schedule Arrival
    ↓ Unload
    ↓ Mark Cargo Delivered
    ↓ Release Vessel

Each arrow is a distinct, testable step.
Not a single "processVoyage()" black box.`,
      },
    ],
    quiz: [
      {
        id: 'q1',
        question: 'According to the Loose Coupling Rule, what should VesselService depend on?',
        options: [
          'PrismaClient directly (performance)',
          'A VesselRepository interface (abstract contract)',
          'The DS_System demand store',
          'The SimulationEngine directly',
        ],
        answer: 1,
        explanation: 'Business logic must depend on abstract interfaces, not concrete infrastructure like Prisma. This makes the domain portable and testable.',
      },
      {
        id: 'q2',
        question: 'Why are sequential integer IDs (1, 2, 3) forbidden in Rycorn?',
        options: [
          'They are too slow to generate',
          'They conflict with Zod validation',
          'They carry no structural information and are hard to audit',
          'They are incompatible with TypeScript',
        ],
        answer: 2,
        explanation: 'The spec mandates IDs that encode structural information (region, year, type) and are human-auditable. Plain integers tell you nothing about what the entity is.',
      },
    ],
    keyTerms: [
      { term: 'Loose Coupling', definition: 'Designing components to depend on abstractions, not concrete implementations' },
      { term: 'Matriculation-style ID', definition: 'An ID encoding year, category, and sequence — making it self-describing and auditable' },
      { term: 'Cross-Language Contract', definition: 'A schema or interface defined independently of any language so multiple languages can implement it' },
      { term: 'Dependency Direction', definition: 'Domain → Interfaces → Application → Infrastructure (never reversed)' },
    ],
  },

  // ----------------------------------------------------------
  // 10. DATA PIPELINE
  // ----------------------------------------------------------
  {
    id: 'data-pipeline',
    title: 'Data Pipeline',
    subtitle: 'From raw World Port Index data to canonical network nodes',
    category: 'data',
    difficulty: 'intermediate',
    emoji: '🗄️',
    readTime: 6,
    sections: [
      {
        id: 'raw',
        title: 'Raw Data Sources',
        content: `Rycorn grounds its port network in **real maritime data**:

- **World Port Index (WPI)** — US National Geospatial-Intelligence Agency dataset of ~3,700 ports worldwide, including coordinates, harbor type, harbor size, and vessel capacity information
- **Natural Earth** — geographic vector data (coastlines, countries) — referenced in provenance notes, not yet used for coastline screening

Raw data lives in \`data/raw/\` and is **never modified in place**. It is immutable source material.`,
      },
      {
        id: 'ingestion',
        title: 'Ingestion Pipeline',
        content: `The ingestion pipeline (\`packages/engine/src/ingestion/\`) transforms raw WPI CSV data into canonical Rycorn port objects:`,
        diagram: `
data/raw/world-port-index/
    │
    ▼  wpiParser.ts       (CSV → raw WPI records)
    ▼  wpiValidator.ts    (validate required fields)
    ▼  portNormalizer.ts  (normalise names, enums)
    ▼  generatePortId.ts  (assign stable Rycorn IDs)
    ▼
data/processed/canonical-ports.json
    │
    ▼  NetworkBuilder     (ports → network graph)
    ▼
MaritimeNetwork (in-memory graph)`,
      },
      {
        id: 'id-gen',
        title: 'Port ID Generation',
        content: `Port IDs are generated deterministically from the WPI source ID + region, following the ID policy. This means re-running ingestion on the same data produces identical IDs — no drift, no collision.`,
        code: [
          {
            filename: 'generatePortId.ts (concept)',
            language: 'typescript',
            code: `// Centralized ID generation — one place to change format
function generatePortId(
  wpiSourceId: string,
  region: string,
  year: number
): PortId {
  const regionCode = mapRegionToCode(region);    // e.g. "EU"
  const yearShort = String(year).slice(2);        // e.g. "26"
  const seq = padded(wpiSourceId);               // e.g. "0041"
  return \`\${yearShort}-\${regionCode}-\${seq}\` as PortId;
}`,
          },
        ],
      },
    ],
    keyTerms: [
      { term: 'WPI', definition: 'World Port Index — NGA dataset of global port data used as Rycorn\'s port source' },
      { term: 'Canonical Port', definition: 'A normalised, ID-assigned port object derived from WPI data and stored in canonical-ports.json' },
      { term: 'Ingestion Pipeline', definition: 'The parse → validate → normalise → ID assign pipeline that converts raw WPI data to engine-ready ports' },
      { term: 'Natural Earth', definition: 'Open geographic dataset providing coastline and country boundary data (referenced in provenance)' },
    ],
  },

  // ----------------------------------------------------------
  // 11. CONDITIONS & MODIFIERS
  // ----------------------------------------------------------
  {
    id: 'conditions',
    title: 'Conditions & Movement Modifiers',
    subtitle: 'Weather, congestion, and stochastic simulation events',
    category: 'engine',
    difficulty: 'advanced',
    emoji: '🌊',
    readTime: 6,
    sections: [
      {
        id: 'modifier',
        title: 'Movement Modifiers',
        content: `The \`MovementCalculator\` can accept a \`movementModifier\` — a function that adjusts travel time based on conditions. This is how weather, congestion, and other environmental effects are modelled.

Without a modifier, travel time is deterministic: \`distanceKm / speedKmh\`.

With a modifier, the same route can take longer (or occasionally shorter) depending on conditions in effect.`,
        code: [
          {
            filename: 'ConditionModel.ts (concept)',
            language: 'typescript',
            code: `export interface MovementModifier {
  // Returns a multiplier: 1.0 = no change, 1.3 = 30% slower
  getMultiplier(
    edge: NetworkEdge,
    simulationTime: number,
    rng: SeededRng
  ): number;
}

// CompositeMovementModifier chains multiple models:
const modifier = new CompositeMovementModifier([
  new WeatherModel({ stormProbability: 0.05, maxDelay: 1.5 }),
  new CongestionModel({ peakPortIds: ['26-EU-0041'] }),
]);`,
          },
        ],
      },
      {
        id: 'rng',
        title: 'Seeded RNG',
        content: `Stochastic (random) conditions use a **seeded RNG** (\`SeededRng\`). This means simulations are **reproducible** — given the same seed and input, the same weather events, delays, and outcomes are generated every run.

This is critical for:
- **Debugging** (reproduce a specific run)
- **Testing** (deterministic test assertions)
- **Comparisons** (A/B test two routing strategies on identical conditions)`,
        code: [
          {
            filename: 'SeededRng.ts (concept)',
            language: 'typescript',
            code: `// Using seed 42 always produces the same sequence
const rng = new SeededRng(42);
rng.next(); // always 0.374...
rng.next(); // always 0.817...

// Bad: Math.random() — non-reproducible
// Good: SeededRng — deterministic, testable`,
          },
        ],
      },
    ],
    keyTerms: [
      { term: 'MovementModifier', definition: 'An interface that returns a travel-time multiplier based on conditions (weather, congestion)' },
      { term: 'CompositeMovementModifier', definition: 'Chains multiple modifier models together, combining their effects' },
      { term: 'SeededRng', definition: 'Deterministic pseudo-random number generator — same seed = same simulation outcomes' },
      { term: 'Stochastic', definition: 'Simulation behaviour involving randomness (vs deterministic, which is fully predictable)' },
    ],
  },

  // ----------------------------------------------------------
  // 12. TESTING STRATEGY
  // ----------------------------------------------------------
  {
    id: 'testing',
    title: 'Testing Strategy',
    subtitle: 'How Rycorn ensures correctness across all layers',
    category: 'architecture',
    difficulty: 'intermediate',
    emoji: '🧪',
    readTime: 6,
    sections: [
      {
        id: 'tools',
        title: 'Test Tools',
        content: `Rycorn uses **Vitest** as its test runner — a fast, Vite-native test framework with first-class TypeScript support. Tests are co-located with source in \`tests/\` directories.

Three test suites:
- \`pnpm test\` — engine tests (routing, movement, network, simulation, conditions)
- \`pnpm test:ds\` — DS System tests
- \`pnpm test:server\` — API and DS-to-engine integration tests`,
      },
      {
        id: 'coverage',
        title: 'What is Tested',
        content: `Test coverage spans every major domain:`,
        diagram: `
packages/engine/tests/
├── conditions/
│   ├── compositeModifier.test.ts
│   ├── congestionModel.test.ts
│   ├── engineWithModels.test.ts
│   ├── seededRng.test.ts
│   └── weatherModel.test.ts
├── domain/
│   ├── geoPosition.test.ts
│   ├── port.test.ts
│   └── region.test.ts
├── ingestion/
│   ├── generatePortId.test.ts
│   ├── portNormalizer.test.ts
│   ├── wpiParser.test.ts
│   └── wpiValidator.test.ts
├── integration/
│   ├── cargoRequest.test.ts
│   ├── demandAdapter.test.ts
│   └── demandFlow.test.ts
├── movement/    movement.test.ts
├── network/     networkBuilder, networkValidator
├── operations/  capacity, compatibility, portCapacity
├── routing/     compatibility, router
└── simulation/
    ├── clock.test.ts
    ├── eventQueue.test.ts
    ├── multiVessel.test.ts   ← multi-vessel scenario
    ├── singleVoyage.test.ts  ← full A→B voyage
    └── stateMachine.test.ts`,
      },
      {
        id: 'determinism',
        title: 'Deterministic Tests',
        content: `All tests must be **deterministic**. Random conditions in tests use the seeded RNG with a fixed seed, so tests never flake due to randomness.

The \`singleVoyage.test.ts\` and \`multiVessel.test.ts\` tests run full simulations and assert exact final states, event sequences, and simulated hour totals.`,
      },
    ],
    keyTerms: [
      { term: 'Vitest', definition: 'Vite-native test runner with TypeScript support — used for all Rycorn engine and server tests' },
      { term: 'Deterministic Test', definition: 'A test that produces the same result every run, regardless of timing or random values' },
      { term: 'Integration Test', definition: 'Tests that exercise multiple components together (e.g. DS → engine handoff)' },
      { term: 'demandFlow.test.ts', definition: 'Tests the full path from a DS demand record through the engine adapter to cargo delivery' },
    ],
  },
];

// ============================================================
// CATEGORIES metadata
// ============================================================

export const categories: Record<Category, { label: string; color: string; description: string }> = {
  overview:     { label: 'Overview',       color: '#3b82f6', description: 'What Rycorn is and why it exists' },
  domain:       { label: 'Domain Model',   color: '#10b981', description: 'Ports, vessels, cargo, and geography' },
  engine:       { label: 'Engine',         color: '#6366f1', description: 'Routing, movement, and simulation core' },
  server:       { label: 'Server',         color: '#f59e0b', description: 'API, WebSocket, and reports' },
  client:       { label: 'Client UI',      color: '#ec4899', description: 'React maritime operations interface' },
  ds:           { label: 'DS System',      color: '#14b8a6', description: 'Demand & Supply contracts' },
  data:         { label: 'Data',           color: '#a78bfa', description: 'Port data ingestion pipeline' },
  architecture: { label: 'Architecture',   color: '#fb7185', description: 'Design rules and principles' },
};
