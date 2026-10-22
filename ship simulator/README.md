# Rycorn Ship Simulator

Captain-bridge operations layer for the shared Rycorn fleet. It lists the active DS/Rycorn vessels with live modeled position, route bearing, and status. Select a vessel to take its helm; throttle and rudder settings update the shared simulation and can extend the ship's arrival forecast. Maritime incident drills reschedule the vessel's engine arrival event, which flows into Rycon delivery timing and DS on-time/late outcomes.

## Run

Run `./Rycorn` from the workspace root. The launcher starts this app with the API and consoles and prints its URL (port 5178 by default; set `RYCORN_SHIP_SIM_PORT` to choose a different one). The **Captain** action on the Rycorn map opens the bridge.

For standalone development from this folder, use `npm install` and `npm run dev`. Vite serves the simulator at `http://localhost:5178` by default and connects to the API at port 3000; set `VITE_RYCORN_API_PORT` if needed.

## Controls

- Drag the on-screen helm to steer with the mouse.
- Use the engine telegraph slider or W/S to set ahead and astern throttle.
- Use A/D or the arrow keys to adjust the rudder.
- Press Space to pause or resume the shared Rycorn simulation; Escape centers the rudder and stops the engine.
- Choose the shared Rycorn clock profile from the top bar.
- Use Incident Drill to apply a modeled disruption to an underway vessel and review the revised ETA and bridge event log.
