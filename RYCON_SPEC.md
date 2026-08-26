# RYCON System Specification — Iteration 1

---

## 1. System Purpose

Rycon is a maritime network simulation system.

Its responsibility is to model how vessels transport cargo between geographic ports across a constrained maritime network over time.

Rycon is a **simulation engine**, not the demand-generation system.

The external demand/supply system will eventually provide cargo requirements. Rycon consumes those requirements and determines how vessels can move the cargo through the network.

---

## 2. Core System Boundary

```text
EXTERNAL DEMAND / SUPPLY SYSTEM
            │
            │ cargo demand
            ▼
        RYCON CORE
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
       Simulation Results
```

Rycon must not generate demand or supply internally in Iteration 1.

---

## 3. Geographic Model

### 3.1 Geographic Region

A geographic region is defined as a **closed loop of nodes**.

Any geographic point/node falling inside that closed loop belongs to the region.

This definition is fundamental and must not be replaced with arbitrary administrative-region assumptions.

```text
       Node ───── Node
      /             \
    Node    REGION   Node
      \             /
       Node ───── Node
```

### 3.2 Coordinates

Geographic entities must preserve:

* latitude
* longitude
* coordinate reference information where applicable
* source provenance

Coordinates must not be silently altered.

Coordinate transformations must be explicit.

---

## 4. Port Model

A port is a canonical Rycon geographic node capable of acting as:

* cargo origin
* cargo destination
* route node
* vessel location
* simulation event location

A port must have a stable Rycon identifier.

---

## 5. Identifier Policy

Rycon must NOT use meaningless sequential IDs such as:

```text
1
2
3
4
```

Identifiers should encode useful structural information where practical.

The design should follow the principle of matriculation-style identifiers:

```text
year / category / individual sequence
```

Example conceptual structure:

```text
YY + REGION/TYPE + LOCAL_SEQUENCE
```

The exact production format must be centralized in an ID-generation module.

IDs must be:

* deterministic
* unique within their namespace
* stable
* machine-readable
* human-auditable

Changing the ID format must require changing one centralized policy, not multiple files.

---

## 6. Network Model

The maritime network is a graph.

```text
Port / Intermediate Node = Vertex
Maritime connection       = Edge
```

Edges must contain enough information for routing and movement calculations.

Minimum edge concepts:

```text
edge_id
from_node
to_node
distance
minimum_vessel_class
```

---

## 7. Intermediate Maritime Nodes

Long maritime edges are subdivided using approximately **5 km intermediate spacing**.

Example:

```text
PORT A
  │
  ●
  │
  ●
  │
  ●
  │
PORT B
```

These nodes exist to increase network resolution.

They are not automatically ports.

They must remain distinguishable from canonical ports.

---

## 8. Vessel Capability Model

Rycon uses five internal vessel capability classes:

```text
A
B
C
D
E
```

These are Rycon simulation abstractions informed by real-world vessel classes.

They are not intended to represent an official maritime classification system.

Capability ranking:

```text
A < B < C < D < E
```

A higher class has at least the traversal capability of a lower class unless a future rule explicitly overrides this assumption.

---

## 9. Segment Compatibility

Every network edge may specify a minimum vessel capability.

Example:

```text
minimum_vessel_class = C
```

Compatibility rule:

```text
vessel capability >= segment requirement
```

Therefore:

```text
A → C segment = INVALID
B → C segment = INVALID
C → C segment = VALID
D → C segment = VALID
E → C segment = VALID
```

Routing must reject incompatible edges.

Iteration 1 may use conservative/default compatibility values where physical navigational constraints are unavailable.

The system must not invent bathymetric or navigational restrictions.

---

## 10. Routing Engine

Rycon uses Dijkstra-based shortest-path routing.

Routing is not simply:

```text
shortest path
```

It is:

```text
shortest compatible path
```

The routing engine must consider:

* origin
* destination
* vessel capability
* edge availability
* edge compatibility
* edge traversal cost

The routing engine must not contain vessel-specific business logic that belongs in the vessel domain model.

---

## 11. Movement Model

Movement converts a selected route into simulation duration.

Conceptually:

```text
route distance
      ↓
vessel capability
      ↓
nominal vessel speed
      ↓
travel duration
```

Formula:

```text
travel_time = distance / vessel_speed
```

Iteration 1 uses deterministic nominal speeds.

The following are explicitly excluded from the base movement model:

* weather
* currents
* fuel consumption
* congestion
* traffic
* stochastic delays

These may become future extensions.

---

## 12. Cargo Model

Cargo represents a transport requirement.

Minimum concepts:

```text
cargo_id
origin
destination
assigned_vessel
state
```

Cargo lifecycle:

```text
CREATED
   ↓
ASSIGNED
   ↓
IN_TRANSIT
   ↓
DELIVERED
```

Multiple cargo records may be assigned to one vessel.

Different cargoes on the same vessel may have different destinations.

---

## 13. Vessel Model

Minimum concepts:

```text
vessel_id
vessel_class
current_node
current_port
state
assigned_cargo
current_route
```

Vessel lifecycle:

```text
IDLE
 ↓
ASSIGNED
 ↓
LOADING
 ↓
SAILING
 ↓
ARRIVED
 ↓
UNLOADING
 ↓
IDLE
```

A vessel must be reusable.

After completing a delivery, it can receive another assignment.

---

## 14. Multi-Vessel Requirement

Rycon must support multiple vessels operating simultaneously.

Example:

```text
Ship A
 ├── Cargo 1 → Port X
 └── Cargo 2 → Port Y

Ship B
 └── Cargo 3 → Port Z

Ship C
 └── Cargo 4 → Port X
```

Their timelines may overlap.

The simulation must not process vessels as if only one vessel exists.

---

## 15. Simulation Engine

Rycon uses a **discrete-event simulation model**.

The engine maintains a chronological event queue.

The simulation advances from event to event rather than continuously iterating every second.

Conceptually:

```text
Event Queue
     │
     ▼
next event
     │
     ▼
update entity state
     │
     ▼
schedule future events
     │
     ▼
next event
```

Events must have:

```text
event_id
simulation_time
event_type
entity_id
location
metadata
```

---

## 16. Core Events

Iteration 1 requires at minimum:

```text
SHIP_ASSIGNED
LOAD_STARTED
LOAD_COMPLETED
DEPARTED
ARRIVED
UNLOAD_STARTED
UNLOAD_COMPLETED
SHIP_AVAILABLE
```

Events must be immutable historical records.

Current state must be derived/maintained separately from the event history.

---

## 17. Port Operations

Port operations are explicitly separated from sailing time.

Iteration 1 uses deterministic placeholder durations:

```text
LOAD   = 2 hours
UNLOAD = 2 hours
```

These values are simulation defaults only.

They are not claims about actual port performance.

Port lifecycle:

```text
ARRIVED
   ↓
UNLOAD_STARTED
   ↓
UNLOAD_COMPLETED
   ↓
SHIP_AVAILABLE
```

Future port complexity may include:

* berth capacity
* queues
* congestion
* handling productivity
* cargo-specific handling time
* customs
* inspections
* stochastic delays

These are outside Iteration 1.

---

## 18. State Integrity

Invalid state transitions must be rejected.

Examples:

```text
IDLE → UNLOADING
```

is invalid.

```text
SAILING → LOADING
```

is invalid.

The simulation engine must enforce valid lifecycle transitions.

---

## 19. External Demand/Supply Interface

The future external system will provide transport demand.

Conceptually:

```text
Demand/Supply System
        ↓
Cargo Request
        ↓
Rycon
        ↓
Vessel Assignment
        ↓
Routing
        ↓
Movement
        ↓
Delivery
```

The interface should be designed so that the demand/supply system can later be replaced without rewriting the simulation engine.

Iteration 1 does not implement the demand/supply engine.

---

## 20. Iteration 1 Scope

Iteration 1 includes:

* geographic data
* canonical ports
* geographic regions
* network nodes
* maritime edges
* 5 km intermediate nodes
* Rycon port IDs
* vessel A–E capability
* segment compatibility
* compatible Dijkstra routing
* deterministic vessel movement
* cargo entities
* vessel entities
* discrete-event simulation
* state machines
* basic loading
* basic unloading
* multiple simultaneous vessels
* multiple cargoes
* consecutive vessel assignments

---

## 21. Explicitly Out of Scope

Do NOT implement these in Iteration 1:

* demand forecasting
* supply forecasting
* optimization
* AI route optimization
* dynamic pricing
* fuel optimization
* weather routing
* ocean current modelling
* congestion modelling
* berth optimization
* stochastic port delays
* vessel capacity optimization
* economic modelling
* advanced data-quality pipelines

The architecture must allow these to be added later without rewriting the core.

---

## 22. Iteration 1 Acceptance Criteria

Iteration 1 is complete only when the system can successfully demonstrate:

### Scenario

At least:

```text
2+ vessels
3+ cargo records
2+ destinations
```

with overlapping operations.

The system must demonstrate:

```text
cargo assignment
      ↓
loading
      ↓
compatible route selection
      ↓
sailing
      ↓
arrival
      ↓
unloading
      ↓
cargo delivery
      ↓
vessel becomes available
      ↓
vessel receives another assignment
```

### Required Validation

All cargoes in the test scenario must reach:

```text
DELIVERED
```

Expected reusable vessels must return to:

```text
IDLE
```

The event log must preserve chronological order.

No vessel may traverse a segment incompatible with its capability.

No invalid state transition may be accepted.

---

## 23. Architecture Principle

Keep the system modular.

The following responsibilities must remain separate:

```text
DOMAIN
  ├── Port
  ├── Vessel
  ├── Cargo
  ├── Network
  └── Region

ROUTING
  └── Path finding

MOVEMENT
  └── Travel-time calculation

OPERATIONS
  └── Loading / unloading

SIMULATION
  ├── Clock
  ├── Event queue
  ├── Event processing
  └── State transitions

DATA
  ├── Raw datasets
  ├── Processed datasets
  └── Schemas

INTEGRATION
  └── External demand/supply interface
```

No module should become a dumping ground for unrelated business logic.

---

## 24. Source-of-Truth Rule

`RYCON_SPEC.md` is the authoritative Iteration-1 system specification.

Before implementing a feature, the agent must determine:

1. Which domain concept owns the feature.
2. Which module should contain it.
3. Whether the feature belongs to Iteration 1.
4. Whether implementing it introduces assumptions not supported by available data.

If a requirement conflicts with this specification, the agent must flag the conflict rather than silently changing the architecture.

---

## 25. Implementation Rule

The Antigravity Agent must work incrementally.

It must:

1. Inspect the existing repository.
2. Report the current structure.
3. Map existing files to this specification.
4. Identify missing components.
5. Implement one bounded component at a time.
6. Run tests after each meaningful change.
7. Never overwrite source datasets unnecessarily.
8. Never fabricate geographic or maritime facts.
9. Preserve raw data separately from processed data.
10. Keep generated artifacts outside source-code modules.

Do not begin by generating the entire system.

First establish the repository structure and domain model.

---

## 26. Current Project Position

The conceptual architecture is substantially defined.

The immediate implementation objective is:

```text
SPECIFICATION
      ↓
REPOSITORY STRUCTURE
      ↓
DOMAIN MODELS
      ↓
NETWORK MODEL
      ↓
ROUTING
      ↓
MOVEMENT
      ↓
SIMULATION ENGINE
      ↓
PORT OPERATIONS
      ↓
INTEGRATION TEST
      ↓
ITERATION 1 FREEZE
```

The first coding milestone is therefore **not the full simulation engine**.

It is establishing the domain model and repository architecture correctly.

---

## 27. Technology Stack

### Primary Implementation

```text
Runtime      Node.js
Language     TypeScript
Package mgr  pnpm
Database     PostgreSQL + PostGIS
Geography    Turf.js
Graph        Graphology
HTTP         Fastify
Validation   Zod
Testing      Vitest
```

### Secondary Computational Environment

Python is a **secondary environment**, not a dependency of the core engine.

It is reserved for:

```text
ML / optimization
Advanced analytics
Specialist scientific computation
```

Python workers connect to the Rycon core via stable contracts, not shared code.

### Future integration shape

```text
Node.js Rycon Core
        │
        ├── API
        ├── Simulation
        ├── Routing
        └── Operations
                │
                │  stable contracts
                ▼
        Python workers
        (analytics / ML / optimization)
```

---

## 28. Loose Coupling Rule

The business logic must NOT depend directly on Node-specific infrastructure.

**Bad:**

```ts
class VesselService {
  constructor(private prisma: PrismaClient) {}
}
```

**Good:**

```ts
class VesselService {
  constructor(private vesselRepository: VesselRepository) {}
}
```

### Dependency direction

```text
Domain
  ↓
Interfaces / contracts
  ↓
Application logic
  ↓
Infrastructure adapters
```

PostgreSQL, Node, Python, or another storage/compute system can be swapped without rewriting the domain.

---

## 29. Explicit Business Logic Rule

Business logic must be explicit at each step.

### Routing example

```text
REQUEST ROUTE
    ↓
Validate origin/destination
    ↓
Load vessel capability
    ↓
Get network
    ↓
Filter incompatible edges
    ↓
Calculate shortest valid path
    ↓
Return Route
```

Not: a single Dijkstra function doing everything.

### Voyage example

```text
Cargo Request
    ↓
Assign Vessel
    ↓
Validate Vessel/Cargo
    ↓
Load Cargo
    ↓
Calculate Compatible Route
    ↓
Calculate Travel Duration
    ↓
Schedule Arrival
    ↓
Unload
    ↓
Mark Cargo Delivered
    ↓
Release Vessel
```

Each step is a clear, bounded use case.
Infrastructure lives beneath it.

---

## 30. Cross-Language Contract Rule

> **Node executes the system; contracts define the system.**

Contracts (schemas, interfaces, event shapes) must be defined independently of their implementation language.

This gives a clean migration path to Python without designing Rycon twice.
