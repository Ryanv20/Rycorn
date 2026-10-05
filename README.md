# Rycorn

Maritime logistics simulation workspace: demand/supply operations, vessel routing, discrete-event execution, a live fleet map, and operational reporting.

## Start the system

From the repository root:

```bash
./Rycorn
```

The launcher checks that the port catalog and coastline files are present, prepares dependencies from the local pnpm cache, then starts the API/WebSocket server and client together. Open [http://localhost:5173](http://localhost:5173), initialize the simulation from the controls, then press **Run**. For a phone on the same Wi-Fi, use one of the LAN URLs printed by the launcher. You can also start it with `pnpm rycorn`. The DS console is available from **DS System** or at `/DS_system` and has no login prompt. Unrecognized page URLs show a 404 screen with a link back to the map.

## Tests

```bash
pnpm test          # engine
pnpm test:ds       # demand/supply package
pnpm test:server   # API and DS-to-engine integration
```

Run the deterministic engine demo with `pnpm demo`.

## System boundaries

- `DS_System/` owns demand/supply contracts, validation, and request lifecycle. Pending demand can be edited or cancelled; Rycon reports assignment, transit, delivery, and failures back to DS.
- `packages/engine/` owns maritime graph routing, movement calculation, vessel/cargo states, and the event queue.
- `packages/server/` adapts DS records to the engine, streams state/events, and builds operational reports.
- `packages/client/` contains the Map, Fleet, Shipments, and Activity views, DS console, and live report panel.

## Time and distance sources

The engine's `simulationTime` is elapsed modeled hours from `T+0`. Distance `d` is the sum of the selected network edges' `distanceKm`; modeled travel time `T` uses that distance and the vessel's nominal speed profile, plus configured handling and delay durations.

`timeMetadata.observedAtUtc` is sampled from the server host clock using `Date.now()` and serialized as UTC. It records when Rycon processed an event/state update; it is not a calendar date assigned to a simulated future event. Compare these clocks in the UI or through `GET /simulation/time-observations`.

## Operational report

Open **REPORT** in the simulation toolbar for a live shipment report. It refreshes automatically and includes demand/supply, vessel and cargo states, route/distance, event history, time observations, and errors. Export the full record as JSON, shipment rows as CSV, or use **Print / PDF**.

## Current model limits

- Routing checks graph connectivity and vessel capability, not whether a route crosses land. The repository currently has Natural Earth provenance documentation but no coastline geometry dataset to validate against.
- Movement remains deterministic and simplified. Vessel speeds, handling times, and delay values still need calibration from sourced operational data.
- Wall-clock observations are deliberately separate from simulation scheduling. A modeled calendar anchor can be added later without changing this distinction.
- Map zoom, marker scale, and label density are presentation settings; they do not change physical distances or simulation time.

## Workspace

```text
DS_System/         demand/supply contracts, store, and tests
packages/engine/   network, routing, movement, and simulation engine
packages/server/   API, WebSocket stream, and report assembly
packages/client/   responsive maritime operations interface
data/raw/          immutable inputs and provenance notes
```
