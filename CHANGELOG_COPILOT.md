# Copilot Work Log

## 2026-08-26

- Added an explicit `rootDir` to the server TypeScript configuration so `outDir` works with the current TypeScript compiler.
- Removed unused legacy `React` imports from the client components; the project uses the automatic JSX runtime.
- Added a server-side demo network factory and injected it during simulation initialization so JSON requests can initialize the real engine.
- Exposed `VesselCapability` from the engine barrel at runtime.
- Fixed map markers to accept the flat coordinate format returned by the network API.
- Fixed the WebSocket connection adapter to use Fastify's raw WebSocket object.
- Removed duplicate development processes that were causing port and connection conflicts.
- Added colored vessel movement trails to the client map using simulation event locations.
- Changed movement trails to dashed routes and replaced vessel circles with visible ship avatar markers.
- Added a `0.25x` to `2x` simulation speed slider, wired to `/simulation/speed`; route colors remain unchanged.
- Added frame-by-frame interpolation along each vessel's full route path so ship avatars move continuously after departure instead of jumping at arrival.
- Added a final 1.5-second glide from the avatar's current position into the destination port so arrival never snaps.
- Expanded the live scenario to four ports, twelve directed routes, six vessels, and ten cargoes while keeping each run finite and resettable.
- Integrated the live Admin sidebar with connection, engine, event, vessel, cargo, error, and system metrics.
- Added six event-log categories: Main, Ship Log, Cargo Log, Route Log, Alerts, and All Events.
- Improved map realism with region-focused bounds, an ocean-toned map frame, layered route styling, and CSS ship silhouette markers with wakes.
- Made the event sidebar responsive so narrow screens retain visible map space.
- Updated route lines to use the engine's intermediate route nodes instead of event-location chords, and locked colors to vessel IDs.
- Added small per-vessel position offsets so overlapping ship avatars remain individually visible.
- Made the event log a collapsible sidebar and cleared vessel, cargo, event, and clock state on Reset.

## Validation

- `pnpm test`: 28 test files passed, 54 tests passed.
- `pnpm demo`: completed with 43 events, all cargo delivered, all vessels idle, and 54.42 simulated hours.
- Live API: initialize, step, and status succeeded with 2 vessels and 2 cargoes.
- `pnpm build:client`: passed after the unused imports were removed.
- Browser verification: dashboard renders at `http://localhost:5173/`, shows Connected, and Initialize completes successfully.
- Movement verification: live simulation events produce Leaflet map overlay paths for vessel trails.
- Avatar verification: live Run displays three ship avatars and dashed route paths while the clock advances.
- Speed verification: dashboard exposes the speed slider and the client build passes.
- Motion verification: live browser sampling showed a ship avatar's map coordinates changing during transit, with no page errors.
- Arrival verification: client build passes and the browser animation completes without page errors.
- Expanded-dashboard verification: client build and all 54 engine tests pass; browser shows six vessels, ten cargoes, six categories, and Connected status after Initialize.
- Visual verification: browser renders the Admin panel, six event categories, and a non-zero map viewport at the narrow test size.
- UI verification: client build passes; the event log collapses, three ship avatars render, and reset clears the visible simulation state.
- Land-routing note: the repository currently has no coastline or land-polygon dataset, so true land avoidance requires sea-lane/coastline data in the network layer.
- Editor diagnostics report no errors in the changed server configuration or client files.
- A standalone server typecheck remains blocked by existing engine imports that omit `.js` extensions under `NodeNext`; no new errors were reported in the changed files.