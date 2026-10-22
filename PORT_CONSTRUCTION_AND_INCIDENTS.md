# Shared port construction and overlap incidents

## Physical overlap rule

Whenever two physical simulation elements merge or overlap, name the pair and
record it as an incident. Do not silently leave colliding geometry in a port.
The Los Angeles scene currently reports vessel collisions with vessels, the
quays, container stacks, warehouses, liquid bulk tanks, and ship-to-shore crane
legs. Its glass incident panel shows active pairs. When an underway vessel is
involved, the console submits a named maritime incident to Rycon and applies a
0.5 simulation-hour arrival delay. The server incident endpoint only accepts
underway vessels, so docked overlap alerts remain local until the DS contract
supports incidents for moored vessels.

When adding another physical asset category, add its scene-space footprint to
the Los Angeles overlap monitor so contacts with that asset are named too.
Intentional contacts such as a ship resting against a fender should be modeled
as a documented berth relationship and excluded from collision alerts only at
that specific contact surface.

## Universal construct block format

Both port Construct Viewers use a 10 m grid. Copied selections describe
rectangular-prism footprints in meters and can be carried between the two
constructors. The local coordinates are measured from each port's own grid
origin, so preserve the metric size and reposition the block when using it in
the other port.

```json
{
  "source": "Rycorn Universal Port Construct Viewer",
  "schemaVersion": 1,
  "gridCellSizeMeters": 10,
  "coordinateFrame": "local-port-grid; x east, z south; one scene unit equals one meter",
  "totalGridCells": 6,
  "selections": [
    {
      "id": 1,
      "label": "C1–C3 · R1–R2 · 30 × 20 M",
      "columns": [1, 3],
      "rows": [1, 2],
      "centerSceneUnits": [0, 0],
      "sizeMeters": [30, 20],
      "block": { "type": "rectangular-prism", "sizeMeters": [30, 0.2, 20] },
      "gridCells": 6
    }
  ]
}
```

Both console READMEs point here. Remember: any new physical overlap must be
reported as a named incident, and construct blocks must keep their meter scale
across the Lekki and Los Angeles ports.
