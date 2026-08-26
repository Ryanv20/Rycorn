# Rycon — Maritime Network Simulation Engine

A deterministic discrete-event simulation engine for maritime cargo logistics.

---

## Quick start (from VSCode)

### 1. Open the folder

```
File → Open Folder → select project_e
```

### 2. Open a terminal

```
Terminal → New Terminal   (or Ctrl + `)
```

### 3. Install dependencies

```bash
pnpm install
```

### 4. Run all tests

```bash
pnpm test
```

You should see **43 tests pass** across 23 test files.
Every green checkmark proves a specific behaviour of the system is working correctly.

---

## What the tests prove

### Data layer
```
tests/ingestion/
  generatePortId.test.ts     — IDs are deterministic and unique
  wpiValidator.test.ts       — invalid coordinates, missing fields rejected
  wpiParser.test.ts          — duplicate source IDs detected; errors are actionable
  portNormalizer.test.ts     — source record → canonical port transformation
```

### Domain models
```
tests/domain/
  geoPosition.test.ts        — coordinate validation (lat/lon bounds)
  port.test.ts               — canonical Port entity with enums and provenance
  region.test.ts             — closed-polygon geographic region
```

### Network
```
tests/network/
  networkBuilder.test.ts     — ports become nodes; 5 km intermediate nodes generated
  networkValidator.test.ts   — orphan edges detected
```

### Routing
```
tests/routing/
  compatibility.test.ts      — Class A vessel rejected on Class C minimum edge
  router.test.ts             — compatible Dijkstra path returned; incompatible path returns { found: false }
```

### Movement
```
tests/movement/
  movement.test.ts           — travel duration = distance / (speed in km/h)
```

### Simulation engine
```
tests/simulation/
  clock.test.ts              — simulation clock advances correctly
  eventQueue.test.ts         — events ordered by simulation time
  stateMachine.test.ts       — IDLE→UNLOADING throws SimulationError
  singleVoyage.test.ts       — one vessel, one cargo, full lifecycle: DELIVERED
  multiVessel.test.ts        — 3 vessels, 5 cargoes, overlapping; all DELIVERED
```

### Demand interface
```
tests/integration/
  cargoRequest.test.ts       — Zod schema rejects invalid cargo requests
  demandAdapter.test.ts      — external request converts to engine input
  demandFlow.test.ts         — StaticDemandProvider → engine → all cargo DELIVERED
```

### Operational constraints
```
tests/operations/
  capacity.test.ts           — vessel over capacity rejected
  portCapacity.test.ts       — second vessel waits when port is full
  compatibility.test.ts      — cargo compatibility policy (Phase 8 stub)
```

---

## Run tests in watch mode (auto-rerun on file save)

```bash
pnpm exec vitest
```

Edit any source file, save it, and the affected tests rerun instantly.

---

## Run the WPI ingestion command

You need the real World Port Index CSV file first.

1. Download `UpdatedPub150.csv` from the NGA (National Geospatial-Intelligence Agency)
2. Place it at: `data/raw/world-port-index/UpdatedPub150.csv`
3. Run:

```bash
pnpm run ingest:wpi
```

This will:
- Parse every port record
- Validate coordinates and required fields
- Generate deterministic Rycon IDs (`19WPI-{sourceId}`)
- Write `data/processed/canonical-ports.json`
- Print a processing summary

Without the CSV, the command exits cleanly with an error pointing to the PROVENANCE.md.

---

## Run a simulation manually

Create a file `scripts/try-simulation.ts` with this content:

```ts
import { SimulationEngine } from '../src/simulation/engine/SimulationEngine.js';
import { NetworkBuilder } from '../src/network/NetworkBuilder.js';
import { VesselCapability } from '../src/domain/network/VesselCapability.js';

// Build a small test network
const builder = new NetworkBuilder();
builder.addPorts([
  { id: 'PORT-A', name: 'Port Alpha', country: 'XX', position: { latitude: 1.0, longitude: 103.0 }, sourceId: 'A' } as any,
  { id: 'PORT-B', name: 'Port Beta',  country: 'XX', position: { latitude: 1.0, longitude: 104.0 }, sourceId: 'B' } as any,
  { id: 'PORT-C', name: 'Port Gamma', country: 'XX', position: { latitude: 2.0, longitude: 104.0 }, sourceId: 'C' } as any,
]);
builder.addEdges([
  { fromPortId: 'PORT-A', toPortId: 'PORT-B', minimumCapability: VesselCapability.B },
  { fromPortId: 'PORT-B', toPortId: 'PORT-A', minimumCapability: VesselCapability.B },
  { fromPortId: 'PORT-B', toPortId: 'PORT-C', minimumCapability: VesselCapability.A },
  { fromPortId: 'PORT-C', toPortId: 'PORT-B', minimumCapability: VesselCapability.A },
]);
const network = builder.build();

// Define vessels and cargo
const engine = new SimulationEngine();
engine.initialize({
  vessels: [
    { id: 'VESSEL-1', capability: VesselCapability.C, startNodeId: 'node-PORT-A' },
    { id: 'VESSEL-2', capability: VesselCapability.B, startNodeId: 'node-PORT-B' },
  ],
  cargoes: [
    { id: 'CARGO-1', origin: 'node-PORT-A', destination: 'node-PORT-B', quantity: 100 },
    { id: 'CARGO-2', origin: 'node-PORT-B', destination: 'node-PORT-C', quantity: 50 },
    { id: 'CARGO-3', origin: 'node-PORT-A', destination: 'node-PORT-C', quantity: 200 },
  ],
  network,
});

// Run the simulation
const result = engine.run();

// Print the event log
console.log('\n=== EVENT LOG ===');
for (const event of result.events) {
  const t = event.simulationTime.toFixed(2).padStart(8);
  console.log(`  t=${t}h  [${event.eventType.padEnd(18)}]  entity=${event.entityId}  at=${event.locationNodeId}`);
}

// Print final states
console.log('\n=== FINAL VESSEL STATES ===');
for (const [id, v] of result.finalVesselStates) {
  console.log(`  ${id}: ${v.status}`);
}

console.log('\n=== FINAL CARGO STATES ===');
for (const [id, c] of result.finalCargoStates) {
  console.log(`  ${id}: ${c.status} (${c.originNodeId} → ${c.destinationNodeId})`);
}

console.log(`\nTotal simulated time: ${result.totalSimulatedHours.toFixed(2)} hours`);
```

Then run it:

```bash
pnpm tsx scripts/try-simulation.ts
```

You will see the full chronological event log, final vessel states (all IDLE), and final cargo states (all DELIVERED).

---

## What is complete

| Phase | What it does |
|---|---|
| 0 | Specification documents (`RYCON_SPEC.md`, `ARCHITECTURE.md`) |
| 1 | World Port Index CSV ingestion, validation, canonical ID generation |
| 2 | Domain models: `Port`, `Region`, `GeographicNode`, `GeoPosition`, enums |
| 3 | Maritime network graph: nodes, edges, 5 km intermediate nodes |
| 4 | Dijkstra routing (capability-filtered) + deterministic movement calculation |
| 5 | Discrete-event simulation engine: clock, event queue, state machines |
| 6 | Multi-vessel concurrent simulation with vessel reuse |
| 7 | External demand interface: `CargoRequest` schema, `DemandAdapter` |
| 8 | Operational constraints: vessel capacity, port berths, queuing |

## What is remaining

| Phase | What it adds |
|---|---|
| 9 | Pluggable dynamic conditions (weather, congestion, port delays) |
| 10 | Real-time visualization: Fastify API + WebSocket + React + Leaflet map |

---

## Project structure

```
src/
  domain/         Pure domain types — no infrastructure
  ingestion/      WPI parsing, validation, ID generation
  integration/    External demand/supply interface
  network/        Network builder, intermediate nodes, validator
  routing/        Compatible Dijkstra router
  movement/       Travel-time calculator
  operations/     Capacity and port constraint policies
  simulation/     Discrete-event engine (clock, queue, state machines)
  errors/         Typed error classes

data/
  raw/            Immutable source data (never modified)
  processed/      Generated artifacts (reproducible from raw)

tests/            One test file per source module
scripts/          CLI commands
```
