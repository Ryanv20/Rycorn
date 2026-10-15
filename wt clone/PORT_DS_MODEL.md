# WT port model: Demand and Supply pilot

## Purpose

This file records the first port-focused model for WT (Waretrack). WT's
warehouse yard is the interaction and visualization reference; the domain
being represented becomes one Rycon port and the cargo demand and vessel
supply connected to it. Keep the live dashboard feel and recognizable
operational entities, while changing warehouse-specific names and measures
where the port domain requires it.

The pilot is **Port of Los Angeles** (`19WPI-16080`, UN/LOCODE `US LAX`). It
already appears in Rycon's scenario routes, and its World Port Index source
record contains detailed navigation, facility, equipment, and service fields.
Completeness alone does not identify a unique winner: many WPI records have
the same number of populated fields. Los Angeles is a practical pilot based on
existing scenario coverage and useful operational detail, not a claim that it
has the most complete record in the entire WPI.

## Source facts and data boundaries

The canonical Rycon record is in
`Rycorn/data/processed/canonical-ports.json`; the raw source row is in
`Rycorn/data/raw/world-port-index/UpdatedPub150.csv` and is preserved under
`Rycorn/data/raw/world-port-index/PROVENANCE.md`.

| Field | Pilot value | Source |
|---|---|---|
| Port ID / source ID | `19WPI-16080` / `16080` | Canonical port catalog / WPI |
| Name / aliases | Los Angeles / San Pedro, Terminal Island, Wilmington | WPI |
| Country / sea area | United States / North Pacific Ocean | WPI |
| Coordinates | 33.750000, -118.250000 | WPI |
| Harbor | Large; Coastal (Breakwater) | WPI |
| Cargo pier / channel depth | 16.8 m / 16.1 m | WPI |
| Maximum vessel dimensions | 400 m length, 61.2 m beam, 15.0 m draft | WPI |
| Reported facilities | Wharves, Ro-Ro, solid and liquid bulk, containers, breakbulk, oil terminal | WPI |
| Reported equipment | Fixed, mobile and floating cranes; 100+ ton, 50–100 ton and 25–49 ton lifts | WPI |

WPI is a port reference source, not a live operations feed. It does not give
current berth occupancy, yard stock, bookings, cargo tonnage, vessel ETAs, or
handling rates. WT's current inventory, capacity, truck, and timing numbers
are synthetic demo values. In the port pilot, any retained values of that kind
must remain explicitly modeled values; do not present them as observed Port
of Los Angeles data. Rycon DS quantities are also model units unless a sourced
unit is supplied.

## Reverse-engineered WT to port/DS mapping

| WT concept | Port/DS concept | Treatment |
|---|---|---|
| Warehouse/site (`WarehouseDef`) | Port (`portId`) | Replace warehouse identity with canonical port identity. Do not treat every WPI entry as a warehouse. |
| Warehouse docks / `DockState` | Berths and berth occupancy | Preserve dock-like visual layout. WPI does not provide a usable berth count, so counts and occupancy remain clearly marked simulation settings. |
| Truck / shipment | Vessel call / cargo movement | Keep a moving vehicle entity and shipment detail panel; change road/driver/carrier fields to voyage, vessel, and operator fields where available. |
| Truck `load` / `unload` mode | Port call operation | Map to loading or discharge at the pilot port. Use DS demand and vessel supply when connected; keep generated traffic marked as demo. |
| Forklift | Cargo-handling equipment / work crew | Keep the moving-resource visualization. WPI crane and lift facilities are capability/reference flags, not equipment counts or live assignments. |
| Warehouse slot / inventory | Yard position / cargo stock | Preserve the spatial stock presentation. Item counts and yard positions are modeled WT data until sourced. |
| Capacity, stock, outbound, putaways, on-time KPI | Port operating KPIs | Retain dashboard presentation, but rename the measures and attach unit/source metadata. Do not infer port capacity or throughput from WPI. |
| `sim.time` | Simulation time | Continue to display modeled time; keep it separate from observation timestamps. |
| Site selector | Port selector | For this pilot show only Los Angeles; the selector can become a list of canonical ports later. |

## Pilot data shape

Use the existing `CargoDemand` and `VesselSupply` contracts as the DS handoff.
They remain distinct from the port reference record and from WT's live visual
entities. A WT port snapshot should combine them without rewriting their
meaning:

```ts
interface PortOperationsSnapshot {
  port: CanonicalPortRecord;
  observedAt: string;
  simulationTime: number;
  cargoDemands: readonly CargoDemand[];
  vesselSupply: readonly VesselSupply[];
  calls: readonly PortCall[];
  berths: readonly BerthState[];
  handlingResources: readonly HandlingResource[];
  yardCargo: readonly YardCargo[];
  metrics: PortMetrics;
}
```

The `PortCall`, `BerthState`, `HandlingResource`, `YardCargo`, and `PortMetrics`
values describe the operational visualization layer. Where there is no DS,
canonical-port, or WPI source value, mark the value as simulated in its source
metadata. Keep cargo demand status values aligned with DS (`PENDING`,
`ASSIGNED`, `IN_TRANSIT`, `DELIVERED`, `DELIVERED_LATE`, `CANCELLED`, `FAILED`)
instead of inventing a second demand lifecycle.

The port ID is the stable key for port-level views. A cargo demand's origin or
destination remains a Rycon node ID (`node-19WPI-16080` when that demand is
connected to Los Angeles); the port snapshot must not rewrite it to a display
name. Vessels are associated through `startNodeId` and the current simulation
state, not by copying vessel supply into the port's own identity record.

## WT files inspected

- `WT/waretrack/src/sim/world.ts` defines five warehouses, static inventory,
  docks, yard slots, and scene dimensions.
- `WT/waretrack/src/sim/sim.ts` owns trucks, forklifts, shipments, movement,
  generated traffic, and per-warehouse simulation state.
- `WT/waretrack/src/store.ts` stores the selected warehouse, entity selection,
  fleet tab, and camera commands.
- `WT/waretrack/src/ui/Hud.tsx` renders warehouse KPIs, shipment tracking,
  equipment, inventory, and selection panels.
- `WT/waretrack/src/three/` renders the warehouse and yard scene.
- `Rycorn/DS_System/src/domain/CargoDemand.ts` and `FleetSupply.ts` define the
  DS records; `DemandSupplySystem.ts` composes their snapshot.

## First implementation boundary

Build the port pilot alongside the current WT model, using a new port domain
module and the Los Angeles canonical record. Keep the existing UI's information
density and spatial interaction, but scope it to one port and replace site
labels with port/berth/call labels. Connect DS demand and vessel supply through
an adapter; do not make the WT visual simulator own demand lifecycle or route
planning. Later ports should be added as separate canonical port records using
the same port-level shape, rather than as extra warehouses with unrelated
invented inventory.
