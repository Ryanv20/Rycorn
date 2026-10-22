# Rycorn time model

Rycorn uses **elapsed simulation time**, not a simulated calendar date. The engine starts at `T+0 h`; `T+12 h` means twelve modeled hours have elapsed since that run started. It does not mean 12:00 on a real-world clock.

## The authoritative clock

The engine event queue owns simulation time. When it processes an event, the engine advances to that event's `simulationTime` in hours. The server exposes the current value as `simulationTimeHours` in `/admin/status` and as `simulationTime` in each live `STATE_UPDATE`. Port displays use the engine state value; they do not infer time from the newest event they happen to have received.

The clock resets to `T+0 h` when the simulation is initialized or reset. Pausing stops event processing and therefore stops simulation time. Changing the clock profile changes how quickly modeled hours pass in wall time; it does not rewrite event times or deadlines.

## Clock profiles

| Profile | Modeled time per wall second | Equivalent pace |
| --- | ---: | --- |
| `REAL_TIME` | 1/3600 h | 1 modeled hour per real hour |
| `MINUTE_PER_SECOND` | 1/60 h | 1 modeled minute per real second |
| `HOUR_PER_SECOND` | 1 h | 1 modeled hour per real second |
| `SIX_HOURS_PER_SECOND` | 6 h | 6 modeled hours per real second |
| `DAY_PER_MINUTE` | 0.4 h | 24 modeled hours per real minute |
| `FAST_REVIEW` | 24 h | 1 modeled day per real second |
| `WEEK_PER_SECOND` | 168 h | 1 modeled week per real second |

The clock profile controls the server's event processing rate. The Port of Los Angeles scene uses the same profile to smoothly animate a ship between its engine-reported voyage start and expected arrival times. It stops that interpolation when the engine is paused and follows the engine again when new authoritative state arrives. Harbor lighting follows elapsed simulation hours modulo 24; its day and night cycle is a visual rhythm, not a claim about the real local time or date in Los Angeles.

The Lekki page and Los Angeles console can select `WEEK_PER_SECOND` from their simulation speed controls. This changes engine time and ship progress. Each port also has a separate lighting freeze control: freezing holds the current harbor lighting while the engine clock and ship movement continue normally.

## Modeled time and observation time

These are separate clocks:

- `simulationTimeHours` is modeled elapsed time from `T+0 h`, used for voyages, deadlines, and event ordering.
- `observedAtUtc` is the server's real UTC timestamp for when it processed or reported an update. It helps identify when the software observed an event; it is not the event's simulated calendar date.

Rycorn does not currently assign a real-world date and time to `T+0`. Adding a calendar anchor later would be a separate display and scheduling choice; it must not change elapsed-hour route durations or deadlines.

## Cargo display units

Scenario quantities are model units, not verified container counts or measured tonnage. The Los Angeles harbor scene represents a loaded small container vessel with **two visible containers** as a fixed visual convention. That artwork does not convert a demand's model quantity into a physical number of containers.
