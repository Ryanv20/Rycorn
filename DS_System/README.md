# Rycorn DS System

`DS_System` means Demand and Supply System. It represents the outside business
world that tells Rycon what needs to move and what transport is available.

## Responsibilities

- Accept cargo demand from an order, booking, factory, or generated scenario.
- Describe available vessel supply from a fleet owner or fleet service.
- Validate and expose neutral contracts that another system can consume.
- Return a demand/supply snapshot without knowing how simulation works.
- Track pending, assigned, in-transit, on-time or late delivery, cancelled, and failed demand states.
- Preserve optional origin/destination region and trade-lane labels for economic planning views.

## Boundaries

```text
DS_System -> contracts -> Simulation Engine
Simulation Engine -> events/results -> Server
Server -> API/WebSocket -> Client
```

`DS_System` must not import from the engine, domain implementation, server, or
client. The static providers are test adapters; future providers can read from
an API, database, message queue, or file without changing the contracts.

The package does not decide routes, assign vessels, run the simulation, or
render a dashboard.

The server supplies region labels from canonical port countries and adds a
coastline-screened route before handing new demand to an initialized engine.
The browser presents quantities as **model units**; the illustrative scenario
generator does not claim those quantities are tonnage, trade value, or observed
bookings. Fleet records can be added to the active simulation by the server.

Demand fields may be edited or cancelled while their status is `PENDING`.
Execution statuses are written back by the server from Rycon simulation events.
The engine compares modeled delivery time with each demand deadline and records lateness in the operational report. Trade-cycle summaries count on-time, late, failed, and still-open movements.

The operator console is served by the application server. The local development
API has no login gate and binds to `127.0.0.1`; do not expose it outside the
local machine without adding an appropriate access-control layer.
