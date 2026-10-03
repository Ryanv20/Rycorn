import { motion } from 'framer-motion'
import styles from './DiagramPage.module.css'

export default function DiagramPage() {
  return (
    <div className={styles.page}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className={styles.title}>🗺️ System Diagram</h1>
        <p className={styles.subtitle}>
          The full Rycorn system — all packages, boundaries, data flows, and dependency directions.
        </p>

        {/* Full system flow */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>System Boundary & Data Flow</h2>
          <pre className={styles.diagram}>{`
EXTERNAL WORLD
┌─────────────────────────────────────────────────────────────┐
│  DS_System/                                                 │
│  ─────────────────────────────────────────────────────────  │
│  Domain:        CargoDemand · FleetSupply · ScenarioPlan    │
│  Contracts:     DemandProvider · FleetProvider              │
│  Application:   DemandSupplySystem · InMemoryStore          │
│  Infrastructure StaticDemandProvider · StaticFleetProvider  │
│                                                             │
│  Validation:    Zod schemas on all inputs                   │
│  Lifecycle:     PENDING → ASSIGNED → IN_TRANSIT             │
│                         → DELIVERED / CANCELLED / FAILED    │
└───────────────────────┬─────────────────────────────────────┘
                        │ cargo demand (via contracts)
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  packages/server/                                           │
│  ─────────────────────────────────────────────────────────  │
│  DemandAdapter: DS records → engine CargoDefinitions        │
│  Fastify API:   /simulation/* /network/* /ds/*              │
│  WebSocket:     SimulationStream → live events              │
│  Reporting:     OperationalReport assembly                  │
│  Data:          portCatalog (canonical-ports.json)          │
│  Maritime:      ScenarioNetwork · specialVessels            │
└──────┬──────────────────────────────────────────────────────┘
       │  initialize(input) + step()
       ▼
┌─────────────────────────────────────────────────────────────┐
│  packages/engine/                                           │
│  ─────────────────────────────────────────────────────────  │
│  Domain:                                                    │
│    nodes/   GeoPosition · GeographicNode                    │
│    ports/   Port                                            │
│    network/ NetworkEdge · VesselCapability · MaritimeNetwork │
│    regions/ Region                                          │
│    shared/  PortId · GeoPosition · enums · Provenance       │
│                                                             │
│  NetworkBuilder  →  NetworkValidator  →  MaritimeNetwork    │
│                                                             │
│  Router (Dijkstra + CompatibilityChecker)                   │
│  MovementCalculator (distance / speed + modifiers)          │
│                                                             │
│  SimulationEngine                                           │
│    ├── SimulationClock  (elapsed hours from T+0)            │
│    ├── EventQueue       (min-heap by simulationTime)        │
│    ├── SimulationContext (vessel + cargo state maps)        │
│    └── EventProcessor  (handles each EventType)             │
│                                                             │
│  Conditions:                                                │
│    WeatherModel · CongestionModel · CompositeModifier       │
│    SeededRng (deterministic reproducibility)                │
│                                                             │
│  Integration:                                               │
│    DemandAdapter · DemandInterface · CargoRequest           │
│                                                             │
│  Ingestion:                                                 │
│    wpiParser → wpiValidator → portNormalizer → generateId   │
└──────────────────────────────────────────────────────────────┘
                        │
                        │  events over WebSocket
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  packages/client/                                           │
│  ─────────────────────────────────────────────────────────  │
│  App.tsx + AdminSidebar                                     │
│    ├── Map.tsx          (2D maritime map)                    │
│    ├── GlobeView.tsx    (3D globe)                          │
│    ├── Fleet            (vessel list + status)              │
│    ├── Shipments        (cargo lifecycle view)              │
│    ├── EventLog.tsx     (live simulation event log)         │
│    ├── DSSystemPage.tsx (operator demand/supply console)    │
│    ├── OperationalReport.tsx (full report + CSV/JSON export)│
│    ├── SimulationControls.tsx (start/step/reset/clock)      │
│    ├── Clock.tsx + ClockPage.tsx                            │
│    └── NextStopPage.tsx · SpecialClassPage.tsx              │
│                                                             │
│  VesselMarker · PortMarker · SpecialVesselMarker            │
│  OperationsRail                                             │
│  Vite dev server  →  port 5173                              │
└─────────────────────────────────────────────────────────────┘`}
          </pre>
        </div>

        {/* Dependency direction */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Dependency Direction (Clean Architecture)</h2>
          <pre className={styles.diagram}>{`
Domain  ←─────────────── (no external deps)
  ↓ depended on by
Contracts / Interfaces
  ↓ depended on by
Application Logic
  ↓ depended on by
Infrastructure Adapters  ─── (PostgreSQL, Node, Python, etc.)

Rule: arrows only point INWARD.
      Infrastructure can be swapped without changing domain.`}
          </pre>
        </div>

        {/* Event lifecycle */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Simulation Event Lifecycle</h2>
          <pre className={styles.diagram}>{`
DS Cargo Demand (PENDING)
        │
        ▼
  SHIP_AVAILABLE ──→ scan for unassigned cargoes
        │
        ▼
  SHIP_ASSIGNED  ──→ cargo status = ASSIGNED
        │              vessel status = ASSIGNED
        ▼
  LOAD_STARTED   ──→ vessel status = LOADING
        │              (duration: loadDurationHours)
        ▼
  LOAD_COMPLETED
        │
        ▼
  DEPARTED       ──→ vessel status = SAILING
        │              route edges traversed
        ▼
  ARRIVED        ──→ vessel status = ARRIVED
        │
        ▼
  UNLOAD_STARTED ──→ vessel status = UNLOADING
        │              (duration: unloadDurationHours)
        ▼
  UNLOAD_COMPLETED ─→ cargo status = DELIVERED
        │              DS status updated to DELIVERED
        ▼
  SHIP_AVAILABLE ──→ vessel free for next cargo`}
          </pre>
        </div>

        {/* Data pipeline */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Port Data Ingestion Pipeline</h2>
          <pre className={styles.diagram}>{`
data/raw/world-port-index/   (WPI CSV — ~3700 real ports, immutable)
        │
        ▼  packages/engine/src/ingestion/
  wpiParser.ts         CSV → raw WPI record objects
        │
  wpiValidator.ts      validate required fields, reject bad rows
        │
  portNormalizer.ts    normalise name strings, map enums
        │
  generatePortId.ts    assign stable Rycorn IDs (YY-REGION-SEQ)
        │
        ▼
data/processed/canonical-ports.json   (used at runtime)
        │
        ▼  packages/engine/src/
  NetworkBuilder.ts    ports + edges → MaritimeNetwork (graph)
        │
  NetworkValidator.ts  validate graph connectivity
        │
        ▼
  MaritimeNetwork      live in-memory graph used by Router`}
          </pre>
        </div>

        {/* Tech stack */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Technology Stack</h2>
          <div className={styles.techGrid}>
            {[
              { cat: 'Runtime', items: ['Node.js v22'] },
              { cat: 'Language', items: ['TypeScript (strict)'] },
              { cat: 'Packages', items: ['pnpm workspaces'] },
              { cat: 'Framework', items: ['Fastify (server)', 'React + Vite (client)'] },
              { cat: 'Validation', items: ['Zod'] },
              { cat: 'Graph', items: ['Graphology (planned)', 'Custom Dijkstra (current)'] },
              { cat: 'Geography', items: ['Turf.js (planned)', 'Leaflet (map)'] },
              { cat: 'Testing', items: ['Vitest'] },
              { cat: 'Database', items: ['PostgreSQL + PostGIS (planned)', 'In-memory (current)'] },
              { cat: 'Secondary', items: ['Python (ML/analytics, via contracts)'] },
            ].map(item => (
              <div key={item.cat} className={styles.techCard}>
                <div className={styles.techCat}>{item.cat}</div>
                {item.items.map(i => (
                  <div key={i} className={styles.techItem}>{i}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
