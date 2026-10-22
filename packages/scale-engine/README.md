# Rycon Scale Engine

Shared scene geometry rules for maritime applications in this workspace.

## Rules

- Describe model dimensions in metres as `length`, `beam`, and `height`.
- Keep local scene coordinates in metres. Apply a renderer scale only at the scene boundary.
- Derive model scale from native dimensions and a vessel profile with `scaleModelToTarget`.
- Use `footprintBounds` and `findClearFootprint` for spacing and collision checks.
- Define port shoreline and berth clearances in `PORT_LAYOUT`; keep animated water outside the quay footprint.
- Keep wakes and other shoreline effects inside `PORT_LAYOUT` with `insidePortSea`.
- For repeated cargo props, scale standard dimensions with `scaleDimensions` rather than copying hand-tuned ratios.

The LA port scene and captain ship simulator both import this package. New 3D assets should declare their native dimensions and vessel class before they are placed in either scene.

`src/assets.ts` is the shared visual inventory consumed by the Rycorn Asset Catalog page. Add each new scene model there with its physical dimensions, source type, finish, tags, and supported color variants. Keep the catalog descriptions aligned with the models actually used by the port and ship scenes.
