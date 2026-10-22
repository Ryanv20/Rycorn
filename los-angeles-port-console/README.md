# Rycorn Port Console · Los Angeles

Standalone Next.js port console built from the Waretrack interaction pattern.
The pilot represents the Port of Los Angeles (`19WPI-16080`) and reads
canonical port facts, cargo demand, fleet supply, simulation state, and events
from the Rycon API. It does not create a separate simulation engine.

From `Rycorn/`, start the complete system:

```bash
./Rycorn
```

The launcher prints the console URL and API URL after selecting available ports.
For manual development, run `pnpm dev:server` and `pnpm dev:la-console` in separate
terminals. The **Run engine** control initializes Rycorn's selected DS scenario
if needed, then starts the existing engine. **Pause** pauses that same engine.

The console represents the WPI Port of Los Angeles (`19WPI-16080`). Its live
vessel, cargo, and time state comes from Rycorn; the harbor geometry and two
container slots on small container vessels are visual models, not measured port
or cargo-capacity data. See [`../time.md`](../time.md) for the shared time model.

The 3D yard is a stylized interaction surface, not a measured port layout.
World Port Index facts are labeled as static reference data. Rycon demand
quantities remain model units, and only vessel, cargo, and event state returned
by the API is presented as live simulation state.
The decorative demand-labeled cargo piles were removed from the 3D yard; live
cargo and demand records remain in the data panels. Container-stack density is
reduced to keep the quay and yard readable at the expanded harbor scale.

## Physical overlap incidents

The harbor scene checks each rendered vessel against other rendered vessels and
the named quay, container-yard, warehouse, tank, and crane footprints. An
intersection is shown as an **Active Physical Overlap Incident** with both
entities named. For an underway vessel, a newly detected overlap is also sent to
Rycon as a maritime incident and adds a 0.5 simulation-hour arrival delay.
Docked-vessel visual alerts are named locally; the current Rycon incident API
only accepts vessels that are underway. Ground and water surfaces are not
collision targets. Keep this rule in mind when adding or moving scene assets:
any physical merge or overlap should be reported as an incident, not silently
rendered.

## Shared port construction grid

Lekki and Los Angeles use the same 10 m selection grid and portable JSON block
shape. Copy JSON in Construct Viewer to use a selected rectangular-prism
footprint in either port. Coordinates are local to each port's grid origin;
`sizeMeters` and the block dimensions are the scale to preserve when moving a
construct between scenes. See [`../PORT_CONSTRUCTION_AND_INCIDENTS.md`](../PORT_CONSTRUCTION_AND_INCIDENTS.md).
