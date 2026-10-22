/**
 * Shared scene scale contract.
 *
 * Scene coordinates are local metres. Render scaling is an explicit final
 * transform and must never be mixed into model dimensions or collision math.
 */
export const WORLD_UNITS_PER_METER = 1
export const PORT_RENDER_SCALE = 6.32
export const MODEL_REFERENCE = {
  vesselHull: { length: 34, beam: 5.6, height: 1.89 },
  shipSimulator40FtContainer: { length: 12.192, beam: 2.438, height: 2.591 },
} as const

export type VesselClass = 'general' | 'container' | 'tanker' | 'barge'
export interface Dimensions3 { length: number; beam: number; height: number }
export interface ModelScale3 { x: number; y: number; z: number }
export interface Footprint2 {
  x: number
  z: number
  yaw: number
  length: number
  beam: number
  clearance?: number
}
export interface PlaceableFootprint extends Footprint2 { id: string }
export interface Bounds2 { minX: number; maxX: number; minZ: number; maxZ: number }

export const VESSEL_PROFILES: Record<VesselClass, Dimensions3> = {
  general: { length: 78.2, beam: 12.88, height: 3.97 },
  container: { length: 84, beam: 14.4, height: 4.1 },
  tanker: { length: 83, beam: 14.4, height: 4.2 },
  barge: { length: 86, beam: 16, height: 4.1 },
}

export const ISO_40_FT_CONTAINER: Dimensions3 = {
  length: 12.192,
  beam: 2.438,
  height: 2.591,
}

export const PORT_LAYOUT = {
  quaySeawardEdgeZ: 32.4,
  seaToQuayClearance: 4.4,
  seaEdgeZ: 32.4 - 4.4,
  seaMinZ: -6000,
  seaMinX: -6000,
  seaMaxX: 6000,
} as const

export function vesselClassFor(type = '', capability = ''): VesselClass {
  const value = `${type} ${capability}`.toLowerCase()
  if (value.includes('barge')) return 'barge'
  if (/tanker|oil|liquid|chemical/.test(value)) return 'tanker'
  if (/container/.test(value)) return 'container'
  return 'general'
}

/** Returns per-axis scale factors that fit a model to a target vessel profile. */
export function scaleModelToTarget(source: Dimensions3, target: Dimensions3): ModelScale3 {
  return {
    x: target.beam / source.beam,
    y: target.height / source.height,
    z: target.length / source.length,
  }
}

export function scaleDimensions(dimensions: Dimensions3, factor: number): Dimensions3 {
  return {
    length: dimensions.length * factor,
    beam: dimensions.beam * factor,
    height: dimensions.height * factor,
  }
}

/** Conservative AABB for a yawed rectangular footprint, with safety margin. */
export function footprintBounds(item: Footprint2): Bounds2 {
  const clearance = Math.max(0, item.clearance ?? 0)
  const halfLength = item.length / 2 + clearance
  const halfBeam = item.beam / 2 + clearance
  const c = Math.abs(Math.cos(item.yaw))
  const s = Math.abs(Math.sin(item.yaw))
  const halfX = halfLength * s + halfBeam * c
  const halfZ = halfLength * c + halfBeam * s
  return { minX: item.x - halfX, maxX: item.x + halfX, minZ: item.z - halfZ, maxZ: item.z + halfZ }
}

export function boundsOverlap(a: Bounds2, b: Bounds2): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ
}

export function footprintsOverlap(a: Footprint2, b: Footprint2): boolean {
  return boundsOverlap(footprintBounds(a), footprintBounds(b))
}

export function insidePortSea(x: number, z: number, radius = 0): boolean {
  return x - radius >= PORT_LAYOUT.seaMinX
    && x + radius <= PORT_LAYOUT.seaMaxX
    && z - radius >= PORT_LAYOUT.seaMinZ
    && z + radius <= PORT_LAYOUT.seaEdgeZ
}

/** Finds the nearest deterministic clear point in a local metre frame. */
export function findClearFootprint<T extends Footprint2>(
  candidate: T,
  occupied: readonly Footprint2[],
  step = 8,
  maxRings = 24,
): T {
  const isClear = (point: T) => occupied.every(other => !footprintsOverlap(point, other))
  if (isClear(candidate)) return candidate
  const safeStep = Math.max(1, Math.abs(step))
  for (let ring = 1; ring <= Math.max(0, maxRings); ring += 1) {
    const radius = ring * safeStep
    const samples = Math.max(16, ring * 8)
    for (let sample = 0; sample < samples; sample += 1) {
      const angle = sample / samples * Math.PI * 2
      const point = { ...candidate, x: candidate.x + Math.cos(angle) * radius, z: candidate.z + Math.sin(angle) * radius }
      if (isClear(point)) return point
    }
  }
  // Finite obstacles cannot occupy an infinite ray. Keep searching along +X
  // after the local spiral so even unusually dense scenes never reuse a berth.
  const bounds = occupied.map(footprintBounds)
  const furthestX = bounds.reduce((maximum, bound) => Math.max(maximum, bound.maxX), candidate.x)
  const candidateHalfWidth = footprintBounds(candidate).maxX - candidate.x
  for (let x = furthestX + candidateHalfWidth + safeStep; ; x += safeStep) {
    const point = { ...candidate, x }
    if (isClear(point)) return point
  }
}

export function findFootprintConflicts(items: readonly PlaceableFootprint[]): Array<[string, string]> {
  const conflicts: Array<[string, string]> = []
  for (let index = 0; index < items.length; index += 1) {
    for (let other = index + 1; other < items.length; other += 1) {
      if (footprintsOverlap(items[index], items[other])) conflicts.push([items[index].id, items[other].id])
    }
  }
  return conflicts
}

/** Convert local-metre positions to this scene's renderer coordinate frame. */
export function toRenderUnits(meters: number, renderScale = PORT_RENDER_SCALE): number {
  return meters * WORLD_UNITS_PER_METER * renderScale
}

export function fromRenderUnits(units: number, renderScale = PORT_RENDER_SCALE): number {
  return units / (WORLD_UNITS_PER_METER * renderScale)
}
