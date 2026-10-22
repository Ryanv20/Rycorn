import { buildPath, follow } from './path'
import type { Mover, PathPoint, Vec, Waypoint } from './path'
import {
  WAREHOUSES, WORLD_HALF, CITY_B_OFFSET_Z, CITY_C_OFFSET_Z, LANE_EAST, LANE_WEST, YARD_LANE_Z, DOCKED_Z, FORK_LANE_Z, FORK_DOCK_Z, FRONT_Z,
  SLOT_ROWS, SLOT_COLS, SLOT_STEP, dockX, gapOffset, slotStart, zoneZ,
} from './world'
import type { WarehouseDef, InventoryItem } from './world'

// ───────────────────────────── types

export interface Carrier {
  name: string
  fullName: string
  cab: string
  accent: string
}

export const CARRIERS: Carrier[] = [
  { name: 'AnyMile', fullName: 'AnyMile Freight', cab: '#c93636', accent: '#c93636' },
  { name: 'Nordline', fullName: 'Nordline Logistics', cab: '#f4f6fb', accent: '#13a39a' },
  { name: 'Bluepeak', fullName: 'Bluepeak Haulage', cab: '#a92732', accent: '#d94242' },
  { name: 'Cargoviva', fullName: 'Cargoviva', cab: '#f59e0b', accent: '#f08a0b' },
]

export type TruckState = 'enroute' | 'loading' | 'unloading' | 'ready' | 'departing' | 'transit'
export type IntercityTransferStatus = 'loading' | 'on-road' | 'unloading' | 'complete'

export interface IntercityTransfer {
  id: string
  truckId: string
  fromWhId: string
  toWhId: string
  itemIndex: number
  itemName: string
  quantity: number
  status: IntercityTransferStatus
}

export interface Truck extends Mover {
  id: string
  carrier: Carrier
  state: TruckState
  whId?: string
  dock?: number
  mode: 'load' | 'unload'
  cargo: number
  cap: number
  shipment: string
  customer: string
  city: string
  driver: string
  wheel: number
  readyTimer: number
  assigned?: string
  transferId?: string
  transferPhase?: 'pickup' | 'road' | 'delivery'
  transferFromWhId?: string
  transferFromDock?: number
  transferToWhId?: string
  transferToDock?: number
  transferItemIndex?: number
  transferItemName?: string
  testRoute?: 'pier'
  testDirection?: 'AtoB' | 'BtoA'
  testTurnSide?: 'left' | 'right'
  times: number[] // sim-minutes for tracking steps
  plate: string
}

export type Loc =
  | { type: 'home' }
  | { type: 'dock'; dock: number }
  | { type: 'slot'; slot: Slot }
  | { type: 'door'; dock: number }

type Step =
  | { t: 'move'; to: Loc; started?: boolean }
  | { t: 'wait'; d: number }
  | { t: 'do'; fn: () => void }

export interface Forklift extends Mover {
  id: string
  whId: string
  home: Vec
  loc: Loc
  queue: Step[]
  waitLeft: number
  lift: number
  liftTarget: number
  carrying: null | 'box' | 'blue'
  battery: number
  status: string
  phase: 'idle' | 'working' | 'charging' | 'waiting'
  truckId?: string
  operator: string
  moved: number
}

export interface Slot {
  id: string
  whId: string
  side: -1 | 1
  x: number
  z: number
  filled: boolean
  reserved: boolean
  kind: 'box' | 'blue'
  pin: boolean
  item: number // index into warehouse inventory
  qty: number
  weight: number
  lot: string
  received: string
}

export interface DockState {
  truckId?: string
  reserved: boolean
  open: number // 0..1 shutter
  hold: number // forklifts currently using this door
}

export interface Warehouse extends WarehouseDef {
  dockState: DockState[]
  spawnTimer: number
  inventory: InventoryItem[]
}

// ───────────────────────────── helpers

let seed = 7
const rnd = () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
const range = (a: number, b: number) => a + rnd() * (b - a)

const CUSTOMERS = ['Oakridge Market', 'Halcyon Retail', 'Pinewell Foods', 'Northstar Supply', 'Brightway Stores', 'Kestrel Home']
const CITIES = ['Philadelphia, PA', 'Boston, MA', 'Baltimore, MD', 'Hartford, CT', 'Albany, NY', 'Pittsburgh, PA', 'Providence, RI']
const DRIVERS = ['Alex Hendricks', 'Maria Lopez', 'Sam Okafor', 'Priya Nair', 'Jonas Berg', 'Lena Novak', 'Tomás Ruiz', 'Kenji Mori']
const OPERATORS = ['D. Kim', 'R. Patel', 'S. Mensah', 'L. Garcia', 'T. Walsh', 'A. Rossi']

let truckSeq = 2051
let shipSeq = 78442

// ───────────────────────────── state

export const sim = {
  time: 9 * 60 + 40, // sim minutes
  warehouses: [] as Warehouse[],
  trucks: [] as Truck[],
  forklifts: [] as Forklift[],
  slots: [] as Slot[],
  transitTimer: [2, 5, 4, 7, 3, 8],
  intercityTimer: 1,
  intercityTransfers: [] as IntercityTransfer[],
  version: 0, // bumped when entity lists change
}

export const whById = (id: string) => sim.warehouses.find((w) => w.id === id)!
export const truckById = (id?: string) => sim.trucks.find((t) => t.id === id)
export const forkliftById = (id?: string) => sim.forklifts.find((f) => f.id === id)
export const slotById = (id?: string) => sim.slots.find((s) => s.id === id)

// ───────────────────────────── trucks

function makeTruck(partial: Partial<Truck>): Truck {
  const t: Truck = {
    id: `TRK-${truckSeq++}`,
    carrier: pick(CARRIERS),
    state: 'transit',
    mode: 'load',
    cargo: 0,
    cap: 6,
    shipment: `#SHP-${shipSeq++}`,
    customer: pick(CUSTOMERS),
    city: pick(CITIES),
    driver: pick(DRIVERS),
    wheel: 0,
    readyTimer: 0,
    pos: { x: 0, z: 0 },
    heading: 0,
    path: [],
    speed: 0,
    times: [],
    plate: `${pick(['NJ', 'NY', 'PA'])}-${Math.floor(range(1000, 9999))}`,
    ...partial,
  }
  const now = sim.time
  t.times = [now - range(150, 200), now - range(70, 110), now + range(10, 25), now + range(35, 60), now + range(60, 90)]
  return t
}

const truckSpeed = (p: PathPoint) => (p.rev ? 2.2 : p.z < -6.5 ? 4.8 : 12)

function arrivalWaypoints(w: Warehouse, dock: number): Waypoint[] {
  const d = dockX(w, dock)
  return [
    { x: d + 30, z: zoneZ(w, LANE_WEST) },
    { x: d + 16, z: zoneZ(w, YARD_LANE_Z) },
    { x: d - 7, z: zoneZ(w, YARD_LANE_Z) },
    { x: d - 1.6, z: zoneZ(w, -12), rev: true },
    { x: d, z: zoneZ(w, -15), rev: true },
    { x: d, z: zoneZ(w, DOCKED_Z), rev: true },
  ]
}

function departureWaypoints(w: Warehouse, dock: number): Waypoint[] {
  const d = dockX(w, dock)
  return [
    { x: d, z: zoneZ(w, -11) },
    { x: d - 7, z: zoneZ(w, -4.5) },
    { x: d - 18, z: zoneZ(w, LANE_WEST) },
    { x: -WORLD_HALF - 20, z: zoneZ(w, LANE_WEST) },
  ]
}

const INTERCITY_LINK_X = 320

function intercityWaypoints(from: Warehouse, fromDock: number, to: Warehouse, toDock: number): Waypoint[] {
  const fromX = dockX(from, fromDock)
  const toX = dockX(to, toDock)
  return [
    { x: fromX, z: zoneZ(from, -11) },
    { x: fromX - 7, z: zoneZ(from, -4.5) },
    { x: fromX - 18, z: zoneZ(from, LANE_EAST) },
    { x: INTERCITY_LINK_X, z: zoneZ(from, LANE_EAST) },
    { x: INTERCITY_LINK_X, z: zoneZ(to, LANE_EAST) },
    { x: toX + 30, z: zoneZ(to, LANE_EAST) },
    ...arrivalWaypoints(to, toDock),
  ]
}

let transferSeq = 1

export function dispatchIntercityTransfer() {
  const active = sim.intercityTransfers.filter((x) => x.status !== 'complete').length
  if (active >= 1) return false
  const sources = sim.warehouses.filter((w) => w.dockState.some((d) => !d.reserved))
  if (!sources.length) return false
  const source = pick(sources)
  const fromDock = source.dockState.findIndex((d) => !d.reserved)
  if (fromDock < 0) return false

  const destinations = sim.warehouses
    .filter((w) => w.city !== source.city && w.dockState.some((d) => !d.reserved) &&
      source.inventory.some((item) => w.inventory.some((other) => other.name === item.name)))
    .sort((a, b) => a.stock / a.capacity - b.stock / b.capacity)
  const destination = destinations[0]
  if (!destination) return false
  const toDock = destination.dockState.findIndex((d) => !d.reserved)
  if (toDock < 0) return false

  const sharedItems = source.inventory
    .map((item, index) => ({ item, index, destinationItem: destination.inventory.find((other) => other.name === item.name) }))
    .filter((entry) => entry.destinationItem)
  const chosenItem = sharedItems.sort((a, b) =>
    (b.item.qty - (b.destinationItem?.qty ?? 0)) - (a.item.qty - (a.destinationItem?.qty ?? 0)))[0]
  if (!chosenItem) return false
  const itemIndex = chosenItem.index
  const itemName = chosenItem.item.name
  const transferId = `XFR-${String(transferSeq++).padStart(4, '0')}`
  const truck = makeTruck({
    state: 'loading',
    whId: source.id,
    dock: fromDock,
    mode: 'load',
    cargo: 0,
    cap: 1,
    shipment: transferId,
    customer: destination.name,
    city: destination.name,
    pos: { x: dockX(source, fromDock), z: zoneZ(source, DOCKED_Z) },
    heading: 0,
    finalHeading: 0,
    transferId,
    transferPhase: 'pickup',
    transferFromWhId: source.id,
    transferFromDock: fromDock,
    transferToWhId: destination.id,
    transferToDock: toDock,
    transferItemIndex: itemIndex,
    transferItemName: itemName,
  })
  source.dockState[fromDock] = { truckId: truck.id, reserved: true, open: 1, hold: 0 }
  destination.dockState[toDock] = { truckId: truck.id, reserved: true, open: 0, hold: 0 }
  sim.trucks.push(truck)
  sim.intercityTransfers.unshift({
    id: transferId,
    truckId: truck.id,
    fromWhId: source.id,
    toWhId: destination.id,
    itemIndex,
    itemName,
    quantity: truck.cap,
    status: 'loading',
  })
  sim.intercityTransfers.length = Math.min(sim.intercityTransfers.length, 12)
  sim.version++
  return true
}

function setTransferStatus(t: Truck, status: IntercityTransferStatus) {
  const transfer = sim.intercityTransfers.find((x) => x.id === t.transferId)
  if (transfer) transfer.status = status
}

function filledSlots(w: Warehouse) {
  return sim.slots.filter((s) => s.whId === w.id && s.filled).length
}

function chooseMode(w: Warehouse): 'load' | 'unload' {
  const f = filledSlots(w)
  const total = sim.slots.filter((s) => s.whId === w.id).length
  if (f >= total - 3) return 'load'
  if (f <= 5) return 'unload'
  return rnd() < 0.55 ? 'load' : 'unload'
}

function spawnArrival(w: Warehouse, dock: number, startX: number) {
  const mode = chooseMode(w)
  const t = makeTruck({
    state: 'enroute',
    whId: w.id,
    dock,
    mode,
    cargo: mode === 'load' ? 0 : 6,
    pos: { x: startX, z: zoneZ(w, LANE_WEST) },
    heading: -Math.PI / 2,
    speed: 12,
  })
  t.path = buildPath(t.pos, arrivalWaypoints(w, dock))
  t.finalHeading = 0
  w.dockState[dock].reserved = true
  w.dockState[dock].truckId = t.id
  sim.trucks.push(t)
  sim.version++
  return t
}

function spawnDocked(w: Warehouse, dock: number) {
  const mode = chooseMode(w)
  const t = makeTruck({
    state: mode === 'load' ? 'loading' : 'unloading',
    whId: w.id,
    dock,
    mode,
    cargo: mode === 'load' ? Math.floor(range(0, 4)) : Math.floor(range(2, 6)),
    pos: { x: dockX(w, dock), z: zoneZ(w, DOCKED_Z) },
    heading: 0,
    finalHeading: 0,
  })
  w.dockState[dock] = { truckId: t.id, reserved: true, open: 1, hold: 0 }
  sim.trucks.push(t)
  sim.version++
}

function spawnTransit(lane: number) {
  const east = lane % 2 === 0
  const cityOffset = [0, CITY_B_OFFSET_Z, CITY_C_OFFSET_Z][Math.floor(lane / 2) % 3]
  const z = (east ? LANE_EAST : LANE_WEST) + cityOffset
  const x0 = east ? -WORLD_HALF - 20 : WORLD_HALF + 20
  const t = makeTruck({
    state: 'transit',
    pos: { x: x0, z },
    heading: east ? Math.PI / 2 : -Math.PI / 2,
    speed: 12,
    cargo: Math.floor(range(2, 7)),
  })
  t.path = buildPath(t.pos, [{ x: -x0, z }])
  sim.trucks.push(t)
  sim.version++
}

function stepTruck(t: Truck, dt: number) {
  // City-to-city legs run on the arterial outside the warehouse yard speed limit.
  // The ordinary yard speed rule treats the north/south link as a loading lane,
  // which made a 220 m intercity trip take several minutes to appear complete.
  const done = follow(t, dt, (point) => (t.transferPhase === 'road' ? 20 : truckSpeed(point)), 10, 0.9)
  const reversing = t.path.length > 0 && t.path[0].rev
  t.wheel += ((t.speed * dt) / 0.5) * (reversing ? -1 : 1)

  // One free test vehicle loops along Pier Street between the two city roads.
  if (t.testRoute === 'pier') {
    if (done) {
      // Alternate a right or left turn at City B, return to City A on that
      // street, then rejoin Pier Street for the next intercity leg.
      t.testDirection = 'BtoA'
      t.testTurnSide = t.testTurnSide === 'right' ? 'left' : 'right'
      const branchX = t.testTurnSide === 'right' ? 50 : -150
      const branchLaneX = branchX - 1.5
      const highwayLaneZ = t.testTurnSide === 'right' ? -217 : -223
      const aHighwayLaneZ = t.testTurnSide === 'right' ? -3 : 3
      t.path = buildPath(t.pos, [
        { x: -50, z: -220 },
        { x: t.testTurnSide === 'right' ? -47 : -53, z: highwayLaneZ },
        { x: branchX, z: highwayLaneZ },
        { x: branchX, z: -220 },
        { x: branchLaneX, z: -220 },
        { x: branchLaneX, z: 0 },
        { x: branchX, z: 0 },
        { x: -50, z: aHighwayLaneZ },
        { x: -48.5, z: 0 },
        { x: -48.5, z: LANE_EAST - 220 },
      ])
    }
    return
  }

  if (t.state === 'enroute' && done) {
    const w = whById(t.whId!)
    t.state = t.mode === 'load' ? 'loading' : 'unloading'
    t.times[2] = sim.time
    w.dockState[t.dock!].open = Math.max(w.dockState[t.dock!].open, 0.01)
  } else if (t.state === 'loading' || t.state === 'unloading') {
    const finished = t.mode === 'load' ? t.cargo >= t.cap : t.cargo <= 0
    if (finished && !t.assigned) {
      t.state = 'ready'
      t.readyTimer = 0
    }
  } else if (t.state === 'ready') {
    t.readyTimer += dt
    if (t.readyTimer > 1.6) {
      const w = whById(t.whId!)
      t.state = 'departing'
      t.times[3] = sim.time
      t.finalHeading = undefined
      if (t.transferPhase === 'pickup') {
        const from = whById(t.transferFromWhId!)
        const to = whById(t.transferToWhId!)
        const fromDock = t.transferFromDock!
        t.path = buildPath(t.pos, intercityWaypoints(from, fromDock, to, t.transferToDock!))
        t.whId = to.id
        t.dock = t.transferToDock
        t.mode = 'unload'
        t.state = 'transit'
        t.transferPhase = 'road'
        from.outbound++
        setTransferStatus(t, 'on-road')
      } else {
        t.path = buildPath(t.pos, departureWaypoints(w, t.dock!))
        if (t.mode === 'load') w.outbound++
      }
    }
  } else if (t.state === 'departing') {
    const w = whById(t.whId!)
    const ds = w.dockState[t.dock!]
    if (ds.truckId === t.id && t.pos.z > zoneZ(w, -9)) {
      ds.truckId = undefined
      ds.reserved = false
    }
  }

  if (t.transferPhase === 'road' && t.transferFromWhId && t.transferFromDock !== undefined) {
    const from = whById(t.transferFromWhId)
    const fromDock = from.dockState[t.transferFromDock]
    if (fromDock.truckId === t.id && t.pos.z > zoneZ(from, -9)) {
      fromDock.truckId = undefined
      fromDock.reserved = false
    }
  }

  if (t.state === 'transit' && t.transferPhase === 'road' && done) {
    const destination = whById(t.whId!)
    t.state = 'unloading'
    t.transferPhase = 'delivery'
    t.times[2] = sim.time
    destination.dockState[t.dock!].open = 1
    setTransferStatus(t, 'unloading')
  } else if ((t.state === 'departing' || (t.state === 'transit' && !t.transferPhase)) && done) {
    if (t.transferId) setTransferStatus(t, 'complete')
    sim.trucks.splice(sim.trucks.indexOf(t), 1)
    sim.version++
  }
}

// ───────────────────────────── forklifts

const forkSpeed = (p: PathPoint) => (p.rev ? 1.8 : 3.6)

function slotApproach(s: Slot) {
  return { az: s.z + 2.0, p3: s.z + 3.5 }
}

function exitPath(w: Warehouse, f: Forklift): Waypoint[] {
  const loc = f.loc
  if (loc.type === 'dock' || loc.type === 'door') return [{ x: dockX(w, loc.dock), z: zoneZ(w, FORK_LANE_Z), rev: true }]
  if (loc.type === 'slot') {
    const s = loc.slot
    const g = w.cx + s.side * gapOffset(w)
    const { p3 } = slotApproach(s)
    return [{ x: s.x, z: p3, rev: true }, { x: g, z: p3 }, { x: g, z: zoneZ(w, FORK_LANE_Z) }]
  }
  return []
}

function entryPath(w: Warehouse, f: Forklift, to: Loc): Waypoint[] {
  if (to.type === 'dock') {
    const d = dockX(w, to.dock)
    return [{ x: d, z: zoneZ(w, FORK_LANE_Z) }, { x: d, z: zoneZ(w, FORK_LANE_Z + 0.9) }, { x: d, z: zoneZ(w, FORK_DOCK_Z) }]
  }
  if (to.type === 'door') {
    const d = dockX(w, to.dock)
    return [{ x: d, z: zoneZ(w, FORK_LANE_Z) }, { x: d, z: zoneZ(w, FORK_LANE_Z - 0.6) }, { x: d, z: zoneZ(w, FRONT_Z - 1.6) }]
  }
  if (to.type === 'slot') {
    const s = to.slot
    const g = w.cx + s.side * gapOffset(w)
    const { az, p3 } = slotApproach(s)
    return [{ x: g, z: zoneZ(w, FORK_LANE_Z) }, { x: g, z: p3 }, { x: s.x, z: p3 }, { x: s.x, z: p3 - 0.6 }, { x: s.x, z: az }]
  }
  return [{ x: f.home.x, z: zoneZ(w, FORK_LANE_Z) }]
}

const go = (to: Loc): Step => ({ t: 'move', to })

function needsWork(t: Truck) {
  if (t.state !== 'loading' && t.state !== 'unloading') return false
  return t.mode === 'load' ? t.cargo < t.cap : t.cargo > 0
}

function nearestSlot(w: Warehouse, x: number, filled: boolean) {
  const cands = sim.slots.filter((s) => s.whId === w.id && s.filled === filled && !s.reserved)
  cands.sort((a, b) => Math.abs(a.x - x) + Math.abs(a.z + 26) * 0.3 - (Math.abs(b.x - x) + Math.abs(b.z + 26) * 0.3))
  return cands[0]
}

const liftFor = (l: Loc) => (l.type === 'dock' ? 1.1 : 0.12)

/** Queue a pallet transfer between two locations. Doors are held open while in use. */
function transfer(f: Forklift, src: Loc, dst: Loc, onPick: () => void, onDrop: () => void) {
  const w = whById(f.whId)
  const doors = [src, dst].filter((l): l is { type: 'door'; dock: number } => l.type === 'door')
  doors.forEach((d) => w.dockState[d.dock].hold++)
  f.queue.push(
    { t: 'do', fn: () => (f.liftTarget = liftFor(src)) },
    go(src),
    { t: 'wait', d: 0.35 },
    { t: 'do', fn: () => { onPick(); f.liftTarget = 0.45 } },
    { t: 'wait', d: 0.4 },
    go(dst),
    { t: 'do', fn: () => (f.liftTarget = liftFor(dst)) },
    { t: 'wait', d: 0.55 },
    { t: 'do', fn: () => { onDrop(); f.carrying = null; f.liftTarget = 0.12 } },
    { t: 'wait', d: 0.3 },
    { t: 'do', fn: () => doors.forEach((d) => (w.dockState[d.dock].hold = Math.max(0, w.dockState[d.dock].hold - 1))) },
  )
}

const totalSlots = (w: Warehouse) => sim.slots.filter((s) => s.whId === w.id).length
const fillRatio = (w: Warehouse) => filledSlots(w) / totalSlots(w)

function pickSlot(f: Forklift, s: Slot) {
  s.filled = false
  s.reserved = false
  s.pin = false
  f.carrying = s.kind
}

function dropSlot(f: Forklift, s: Slot) {
  s.filled = true
  s.reserved = false
  s.kind = f.carrying ?? 'box'
  s.pin = rnd() < 0.15
}

function planForklift(f: Forklift) {
  const w = whById(f.whId)
  let t = truckById(f.truckId)
  if (t && !needsWork(t)) {
    t.assigned = undefined
    f.truckId = undefined
    t = undefined
  }
  if (!t && f.battery > 22) {
    t = sim.trucks.find((x) => x.whId === w.id && !x.assigned && needsWork(x))
    if (t) {
      t.assigned = f.id
      f.truckId = t.id
    }
  }

  if (t) {
    const truck = t
    const dock = truck.dock!
    const d = dockX(w, dock)
    const bay = `Bay ${dock + 1}`
    f.phase = 'working'
    if (truck.mode === 'load') {
      const s = fillRatio(w) > 0.25 && rnd() < 0.75 ? nearestSlot(w, d, true) : undefined
      f.status = `Loading ${truck.id} at ${bay}`
      if (s) s.reserved = true
      transfer(
        f,
        s ? { type: 'slot', slot: s } : { type: 'door', dock },
        { type: 'dock', dock },
        () => (s ? pickSlot(f, s) : (f.carrying = rnd() < 0.3 ? 'blue' : 'box')),
        () => {
          truck.cargo++
          w.stock = Math.max(0, w.stock - 1)
          jitterInventory(w, -1, truck.transferPhase ? truck.transferItemName : undefined)
        },
      )
    } else {
      const s = fillRatio(w) < 0.7 ? nearestSlot(w, d, false) : undefined
      f.status = `Unloading ${truck.id} at ${bay}`
      if (s) s.reserved = true
      transfer(
        f,
        { type: 'dock', dock },
        s ? { type: 'slot', slot: s } : { type: 'door', dock },
        () => { truck.cargo--; f.carrying = rnd() < 0.35 ? 'blue' : 'box' },
        () => {
          if (s) dropSlot(f, s)
          w.stock = Math.min(w.capacity, w.stock + 1)
          w.putaways++
          jitterInventory(w, 1, truck.transferPhase ? truck.transferItemName : undefined)
        },
      )
    }
    return
  }

  // yard housekeeping keeps staging lanes from filling up or running dry
  const ratio = fillRatio(w)
  if (f.battery > 40 && (ratio > 0.8 || ratio < 0.3) && rnd() < 0.5) {
    const freeDock = w.dockState.findIndex((ds) => !ds.reserved)
    const dock = freeDock >= 0 ? freeDock : Math.floor(rnd() * w.docks)
    const d = dockX(w, dock)
    f.phase = 'working'
    if (ratio > 0.8) {
      const s = nearestSlot(w, d, true)
      if (s) {
        s.reserved = true
        f.status = 'Put-away to storage'
        transfer(f, { type: 'slot', slot: s }, { type: 'door', dock }, () => pickSlot(f, s), () => undefined)
        return
      }
    } else {
      const s = nearestSlot(w, d, false)
      if (s) {
        s.reserved = true
        f.status = 'Replenishing yard'
        transfer(f, { type: 'door', dock }, { type: 'slot', slot: s }, () => (f.carrying = rnd() < 0.3 ? 'blue' : 'box'), () => dropSlot(f, s))
        return
      }
    }
  }

  if (f.loc.type !== 'home') {
    f.queue.push(go({ type: 'home' }))
    f.status = 'Returning to bay'
    f.phase = 'working'
    return
  }
  if (f.battery < 95 && (f.phase === 'charging' || f.battery < 40)) {
    f.phase = 'charging'
    f.status = 'Charging at bay'
  } else {
    f.phase = 'idle'
    f.status = 'Idle at bay'
  }
  f.queue.push({ t: 'wait', d: 1.2 })
}

function jitterInventory(w: Warehouse, dir: number, name?: string) {
  const item = name ? w.inventory.find((i) => i.name === name) ?? pick(w.inventory) : pick(w.inventory)
  item.qty = Math.max(0, item.qty + dir * Math.floor(range(4, 40)))
}

function stepForklift(f: Forklift, dt: number) {
  f.lift += (f.liftTarget - f.lift) * (1 - Math.exp(-5 * dt))
  if (f.phase === 'charging') f.battery = Math.min(100, f.battery + dt * 2.5)

  // run queue
  let guard = 0
  while (f.queue.length && guard++ < 8) {
    const step = f.queue[0]
    if (step.t === 'do') {
      step.fn()
      f.queue.shift()
      continue
    }
    if (step.t === 'wait') {
      if (f.waitLeft <= 0) f.waitLeft = step.d
      f.waitLeft -= dt
      if (f.waitLeft <= 0) f.queue.shift()
      break
    }
    // move
    if (!step.started) {
      step.started = true
      const w = whById(f.whId)
      f.path = buildPath(f.pos, [...exitPath(w, f), ...entryPath(w, f, step.to)])
      f.finalHeading = undefined
      if (!f.path.length) {
        f.loc = step.to
        f.queue.shift()
        continue
      }
    }
    const before = { ...f.pos }
    const done = follow(f, dt, forkSpeed, 9, 1.4)
    f.moved = Math.hypot(f.pos.x - before.x, f.pos.z - before.z)
    f.battery = Math.max(3, f.battery - f.moved * 0.035)
    if (done || !f.path.length) {
      f.loc = step.to
      if (step.to.type === 'home') f.finalHeading = Math.PI
      f.queue.shift()
    }
    break
  }
  if (!f.queue.length) {
    f.moved = 0
    f.speed = 0
    planForklift(f)
  }
}

// ───────────────────────────── warehouses

function stepWarehouse(w: Warehouse, dt: number) {
  for (let i = 0; i < w.dockState.length; i++) {
    const ds = w.dockState[i]
    const t = truckById(ds.truckId)
    const atDock = !!t && t.whId === w.id && t.dock === i && (t.state === 'loading' || t.state === 'unloading' || t.state === 'ready')
    ds.open += ((atDock || ds.hold > 0 ? 1 : 0) - ds.open) * (1 - Math.exp(-2.5 * dt))
  }
  w.spawnTimer -= dt
  if (w.spawnTimer <= 0) {
    w.spawnTimer = range(6, 16)
    const free = w.dockState.findIndex((d) => !d.reserved)
    if (free >= 0) spawnArrival(w, free, WORLD_HALF + 20)
  }
}

export function stepSim(dtRaw: number) {
  const dt = Math.min(dtRaw, 0.05)
  sim.time += dt * 0.5
  for (const w of sim.warehouses) stepWarehouse(w, dt)
  for (const t of [...sim.trucks]) stepTruck(t, dt)
  for (const f of sim.forklifts) stepForklift(f, dt)
  for (let i = 0; i < sim.transitTimer.length; i++) {
    sim.transitTimer[i] -= dt
    if (sim.transitTimer[i] <= 0) {
      sim.transitTimer[i] = range(7, 16)
      spawnTransit(i)
    }
  }
  sim.intercityTimer -= dt
  if (sim.intercityTimer <= 0) {
    dispatchIntercityTransfer()
    // Keep retrying quickly until a source and destination across the network are available.
    sim.intercityTimer = range(2, 3)
  }
}

// ───────────────────────────── init

const LOTS = () => `${Math.floor(range(10000, 99999))}-${pick(['A', 'B', 'C', 'P1', 'P2', 'P3'])}${Math.floor(range(1, 9))}`
const DATES = ['Apr 16, 16:29', 'Apr 18, 08:12', 'Apr 19, 11:45', 'Apr 20, 07:03', 'Apr 21, 14:30']

export function initSim() {
  if (sim.warehouses.length) return
  sim.warehouses = WAREHOUSES.map((def) => ({
    ...def,
    inventory: def.inventory.map((i) => ({ ...i })),
    dockState: Array.from({ length: def.docks }, () => ({ reserved: false, open: 0, hold: 0 })),
    spawnTimer: range(3, 10),
  }))
  let fl = 1
  for (const w of sim.warehouses) {
    // staging slots
    for (const side of [-1, 1] as const) {
      SLOT_ROWS.forEach((z, r) => {
        for (let c = 0; c < SLOT_COLS; c++) {
          const filled = rnd() < 0.72
          sim.slots.push({
            id: `${w.id}-${side < 0 ? 'A' : 'B'}${r}${c}`,
            whId: w.id,
            side,
            x: w.cx + side * (slotStart(w) + c * SLOT_STEP),
            z: zoneZ(w, z),
            filled,
            reserved: false,
            kind: rnd() < 0.3 ? 'blue' : 'box',
            pin: filled && rnd() < 0.18,
            item: Math.floor(rnd() * w.inventory.length),
            qty: Math.floor(range(24, 120)),
            weight: Math.floor(range(40, 380)),
            lot: LOTS(),
            received: pick(DATES),
          })
        }
      })
    }
    // forklifts parked along the front lane
    for (let k = 0; k < w.forklifts; k++) {
      const side = k % 2 === 0 ? -1 : 1
      const hx = w.cx + side * (gapOffset(w) + 3 + Math.floor(k / 2) * 3.2)
      sim.forklifts.push({
        id: `FL-${String(fl++).padStart(2, '0')}`,
        whId: w.id,
        home: { x: hx, z: zoneZ(w, FORK_LANE_Z) },
        loc: { type: 'home' },
        pos: { x: hx, z: zoneZ(w, FORK_LANE_Z) },
        heading: Math.PI,
        finalHeading: Math.PI,
        path: [],
        speed: 0,
        queue: [],
        waitLeft: 0,
        lift: 0.12,
        liftTarget: 0.12,
        carrying: null,
        battery: Math.floor(range(45, 98)),
        status: 'Idle at bay',
        phase: 'idle',
        operator: pick(OPERATORS),
        moved: 0,
      })
    }
    // start with some docks busy and one truck inbound
    for (let d = 0; d < w.docks; d++) if (d < w.docks - 1 || rnd() < 0.3) spawnDocked(w, d)
    const free = w.dockState.findIndex((d) => !d.reserved)
    if (free >= 0) spawnArrival(w, free, Math.min(WORLD_HALF, dockX(w, free) + range(50, 110)))
  }
  // some highway traffic already moving
  for (let i = 0; i < 18; i++) {
    const lane = i % 6
    const east = lane % 2 === 0
    spawnTransit(lane)
    const t = sim.trucks[sim.trucks.length - 1]
    const x = range(-WORLD_HALF, WORLD_HALF)
    t.pos.x = x
    t.path = buildPath(t.pos, [{ x: east ? WORLD_HALF + 20 : -WORLD_HALF - 20, z: t.pos.z }])
  }
  const pierTestTruck = makeTruck({
    state: 'transit',
    pos: { x: -48.5, z: LANE_EAST },
    heading: Math.PI,
    speed: 12,
    cargo: 2,
    testRoute: 'pier',
    testDirection: 'AtoB',
  })
  pierTestTruck.path = buildPath(pierTestTruck.pos, [{ x: -48.5, z: LANE_EAST - 220 }])
  sim.trucks.push(pierTestTruck)
}
