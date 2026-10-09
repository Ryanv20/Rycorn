# Rycorn

Maritime logistics and trade planning workspace: regional demand and fleet supply, server-built sea routes, empty-vessel repositioning, a continuous multi-region trade loop, a live fleet map, and reporting.

## Start the system

From the repository root:

```bash
./Rycorn
```

The launcher checks that the port catalog and coastline files are present, prepares dependencies from the local pnpm cache, then starts the API/WebSocket server and client together. Open the client URL printed by the launcher, initialize the simulation from the controls, then press **Run**. The launcher selects available ports (3000 and 5173 by default); set `RYCORN_API_PORT` or `RYCORN_CLIENT_PORT` to choose a starting port. For a phone on the same Wi-Fi, use one of the LAN URLs printed by the launcher. You can also start it with `pnpm rycorn`. The DS console is available from **DS System** or at `/DS_system` and has no login prompt. Unrecognized page URLs show a 404 screen with a link back to the map.

## Tests

```bash
pnpm test          # engine
pnpm test:ds       # demand/supply package
pnpm test:server   # API and DS-to-engine integration
```

Run the deterministic engine demo with `pnpm demo`.

## System boundaries

- `DS_System/` owns demand/supply contracts, validation, request lifecycle, and planning snapshots. Pending demand can be edited or withdrawn; Rycon reports assignment, transit, on-time or late delivery, and failures back to DS.
- `packages/engine/` owns compatible routing, movement calculation, vessel/cargo states, vessel repositioning, and the discrete-event queue.
- `packages/server/` builds and land-screens route networks, joins DS records to the engine, runs regional trade cycles, streams state, and assembles reports.
- `packages/client/` contains the map, route atlas, fleet and shipment views, economist-oriented planning workspace, scenario planner, and live report panel.

## Time and distance sources

The engine's `simulationTime` is elapsed modeled hours from `T+0`. Distance `d` is the sum of the selected network edges' `distanceKm`; modeled travel time uses that distance and the vessel's nominal speed profile, seeded weather and congestion sensitivities, port handling, and port-delay settings. The run records delivery against each demand deadline.

`timeMetadata.observedAtUtc` is sampled from the server host clock using `Date.now()` and serialized as UTC. It records when Rycon processed an event/state update; it is not a calendar date assigned to a simulated future event. Compare these clocks in the UI or through `GET /simulation/time-observations`.

## Operational report

Open **REPORT** in the simulation toolbar for a live shipment report. It refreshes automatically and includes demand/supply, region and lane metadata, vessel and cargo states, route/distance, recent trade-cycle summaries, event history, time observations, and errors. Export the full record as JSON, shipment rows as CSV, or use **Print / PDF**.

## Global trade loop

**Next Stop 10** runs a continuous network of reciprocal illustrative lanes across North America, South America, Europe, Africa, the Middle East, South Asia, East and Southeast Asia, and Oceania. Vessels may reposition empty to meet demand at another port. The DS workspace shows port coverage by model region and reports completed cycle volume.

Region membership is a Rycon planning classification derived from the port country in the World Port Index. Scenario lane choices and volumes are human-authored model assumptions. The ±10% cycle adjustment and seeded condition models are sensitivity settings; they are not forecasts, live weather, or observed trade volume. The WPI supplies port identity and location, not a global origin-destination trade matrix. Connect sourced series before interpreting model units as real trade.

Useful read endpoints include `GET /network/regions`, `GET /network/routes`, and `GET /simulation/trade-cycles`.

## Current model limits

- Scenario network construction screens each unique edge against Natural Earth 1:10m land geometry at approximately 2 km intervals. First and last port connector edges up to 100 km are exempt because port coordinates may lie on land. This is a coarse screen, not certified navigational validation; the engine router assumes its supplied network has already been screened.
- The global loop is a synthetic economic network over named WPI ports. It is not a measured global trade matrix, live booking feed, AIS reconstruction, or forecast. Region groupings are approximate planning categories, not official customs or economic blocs.
- Network connector paths make modeled ports reachable for routing and repositioning. They are generalized sea routes; canal restrictions, traffic separation schemes, port closures, and navigational notices are not modeled.
- Movement remains deterministic under its configured seed and simplified. Vessel speeds, weather and congestion sensitivities, handling times, and delays still need calibration from sourced operational data.
- Continuous runs keep recent cycle records and a bounded event/time history so long runs do not grow memory without limit. Shipment detail in operational reports covers retained history.
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
