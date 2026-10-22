// Static world layout: warehouses sit north of a single east–west highway.
// Coordinates: +x east, +z south (toward the default camera).

export const WORLD_HALF = 300
export const ROAD_HALF = 6
export const LANE_EAST = 3 // eastbound lane (moving +x)
export const LANE_WEST = -3 // westbound lane (moving -x)

export const FRONT_Z = -28 // building front face
export const BUILDING_DEPTH = 30
export const DOCK_SPACING = 9
export const TRUCK_LEN = 11
export const DOCK_REAR_Z = -23 // trailer rear when docked (leaves a forklift apron)
export const DOCKED_Z = DOCK_REAR_Z + TRUCK_LEN / 2
export const YARD_LANE_Z = -9
export const FORK_LANE_Z = -26.3
export const FORK_DOCK_Z = -24
export const SLOT_ROWS = [-21.5, -15.5]
export const SLOT_COLS = 4
export const SLOT_STEP = 2.4
export const CITY_B_OFFSET_Z = -220
export const CITY_C_OFFSET_Z = -440
export const CITY_D_OFFSET_Z = -660
export const PORT_1_OFFSET_Z = 0
export const PORT_2_OFFSET_Z = CITY_B_OFFSET_Z
export const PORT_MAIN_OFFSET_Z = CITY_C_OFFSET_Z
export const zoneZ = (w: Pick<WarehouseDef, 'zOffset'>, z: number) => z + (w.zOffset ?? 0)

export type WarehouseStyle = 'blue' | 'white' | 'cold'
export type ItemIcon = 'box' | 'blue' | 'helmet' | 'tape' | 'chair' | 'panel' | 'gloves' | 'peas' | 'water'

export interface InventoryItem {
  name: string
  qty: number
  low: number
  icon: ItemIcon
}

export interface WarehouseDef {
  id: string
  code: string
  city: 'A' | 'B' | 'C' | 'D' | 'P1' | 'P2' | 'P3' | 'P4'
  attachedCity?: 'A' | 'B' | 'C' | 'D'
  zOffset: number
  name: string
  kind: string
  address: string
  cx: number
  docks: number
  style: WarehouseStyle
  capacity: number
  stock: number
  forklifts: number
  onTime: number
  outbound: number
  putaways: number
  inventory: InventoryItem[]
}

const CITY_A_WAREHOUSES: WarehouseDef[] = [
  {
    id: 'WH-01', code: 'WH-01', city: 'A', zOffset: 0, name: 'Riverside Hub', kind: 'Depot',
    address: '12 Riverside Dr, Newark NJ', cx: -200, docks: 2, style: 'blue',
    capacity: 1800, stock: 1412, forklifts: 2, onTime: 96.6, outbound: 23, putaways: 15,
    inventory: [
      { name: 'Cardboard Box (M)', qty: 1906, low: 300, icon: 'box' },
      { name: 'Plastic Container', qty: 297, low: 120, icon: 'blue' },
      { name: 'Safety Helmet', qty: 212, low: 250, icon: 'helmet' },
      { name: 'Packing Tape', qty: 4448, low: 500, icon: 'tape' },
    ],
  },
  {
    id: 'WH-02', code: 'WH-02', city: 'A', zOffset: 0, name: 'Northgate DC', kind: 'Distribution Center',
    address: '480 Northgate Blvd, Newark NJ', cx: -100, docks: 4, style: 'white',
    capacity: 4200, stock: 3310, forklifts: 4, onTime: 98.2, outbound: 21, putaways: 35,
    inventory: [
      { name: 'LED Panel 60×60', qty: 1787, low: 300, icon: 'panel' },
      { name: 'Office Chair', qty: 174, low: 60, icon: 'chair' },
      { name: 'Cardboard Box (M)', qty: 993, low: 1000, icon: 'box' },
      { name: 'Nitrile Gloves', qty: 5793, low: 800, icon: 'gloves' },
    ],
  },
  {
    id: 'WH-03', code: 'WH-03', city: 'A', zOffset: 0, name: 'Eastport Cold Chain', kind: 'Cold Store',
    address: '7 Harbor Way, Elizabeth NJ', cx: 0, docks: 3, style: 'cold',
    capacity: 1400, stock: 990, forklifts: 3, onTime: 96.0, outbound: 31, putaways: 20,
    inventory: [
      { name: 'Frozen Peas 10 kg', qty: 334, low: 100, icon: 'peas' },
      { name: 'Spring Water 24-pack', qty: 164, low: 80, icon: 'water' },
      { name: 'Nitrile Gloves', qty: 495, low: 600, icon: 'gloves' },
      { name: 'Plastic Container', qty: 297, low: 120, icon: 'blue' },
    ],
  },
  {
    id: 'WH-04', code: 'WH-04', city: 'A', zOffset: 0, name: 'Southfield Cross-Dock', kind: 'Cross-Dock',
    address: '2280 Southfield Ave, Linden NJ', cx: 100, docks: 4, style: 'blue',
    capacity: 1000, stock: 610, forklifts: 4, onTime: 96.2, outbound: 29, putaways: 20,
    inventory: [
      { name: 'Spring Water 24-pack', qty: 28, low: 40, icon: 'water' },
      { name: 'Packing Tape', qty: 1822, low: 500, icon: 'tape' },
      { name: 'LED Panel 60×60', qty: 73, low: 100, icon: 'panel' },
      { name: 'Safety Helmet', qty: 320, low: 150, icon: 'helmet' },
    ],
  },
  {
    id: 'WH-05', code: 'WH-05', city: 'A', zOffset: 0, name: 'Westgate Robotics Hub', kind: 'Automated DC',
    address: '300 Westgate Rd, Kearny NJ', cx: 200, docks: 3, style: 'white',
    capacity: 2400, stock: 1730, forklifts: 3, onTime: 95.9, outbound: 33, putaways: 25,
    inventory: [
      { name: 'LED Panel 60×60', qty: 534, low: 200, icon: 'panel' },
      { name: 'Cardboard Box (M)', qty: 1817, low: 400, icon: 'box' },
      { name: 'Nitrile Gloves', qty: 885, low: 1000, icon: 'gloves' },
      { name: 'Safety Helmet', qty: 806, low: 150, icon: 'helmet' },
    ],
  },
]

const CITY_C_WAREHOUSES: WarehouseDef[] = CITY_A_WAREHOUSES.map((w) => ({
  ...w,
  id: `C-${w.id}`,
  code: `C-${w.code}`,
  city: 'C',
  zOffset: CITY_C_OFFSET_Z,
  name: `${w.name} C`,
  address: `City C · ${w.address}`,
  inventory: w.inventory.map((item) => ({ ...item })),
}))

const CITY_D_WAREHOUSES: WarehouseDef[] = [{
  ...CITY_A_WAREHOUSES[0],
  id: 'D-WH-01',
  code: 'CITY4-01',
  city: 'D' as const,
  zOffset: CITY_D_OFFSET_Z,
  name: 'City 4 · LA DS / Waretrack Cross-Dock',
  kind: 'DS / Waretrack Cross-Dock',
  address: 'City 4 · Los Angeles port handoff',
  cx: 100,
  docks: 4,
  stock: 0,
  capacity: 2000,
  forklifts: 2,
  inventory: [],
}]

const makePortWarehouse = (city: 'P1' | 'P2' | 'P3' | 'P4', attachedCity: 'A' | 'B' | 'C' | 'D', offset: number, label: string): WarehouseDef => {
  const source = CITY_A_WAREHOUSES[0]
  return {
    ...source,
    id: `${city}-TERMINAL`,
    code: `${city}-01`,
    city,
    attachedCity,
    zOffset: offset,
    name: `${label} Terminal Operations`,
    kind: 'Port Terminal',
    address: `${label} Harbor · attached to City ${attachedCity}`,
    cx: 250,
    docks: 4,
    capacity: 5200,
    stock: 3710,
    forklifts: 4,
    inventory: source.inventory.map((item) => ({ ...item })),
  }
}

export const WAREHOUSES: WarehouseDef[] = [
  ...CITY_A_WAREHOUSES,
  ...CITY_A_WAREHOUSES.map((w) => ({
    ...w,
    id: `B-${w.id}`,
    code: `B-${w.code}`,
    city: 'B' as const,
    zOffset: CITY_B_OFFSET_Z,
    name: `${w.name} B`,
    address: `City B · ${w.address}`,
    inventory: w.inventory.map((item) => ({ ...item })),
  })),
  ...CITY_C_WAREHOUSES,
  ...CITY_D_WAREHOUSES,
  makePortWarehouse('P1', 'A', PORT_1_OFFSET_Z, 'Port District 1'),
  makePortWarehouse('P2', 'B', PORT_2_OFFSET_Z, 'Port District 2'),
  makePortWarehouse('P3', 'C', PORT_MAIN_OFFSET_Z, 'Lekki Port'),
  makePortWarehouse('P4', 'D', CITY_D_OFFSET_Z, 'Los Angeles · City 4 DS / Waretrack Handoff'),
]

export const dockSpan = (w: WarehouseDef) => ((w.docks - 1) / 2) * DOCK_SPACING
export const dockX = (w: WarehouseDef, i: number) => w.cx + (i - (w.docks - 1) / 2) * DOCK_SPACING
/** x offset of the forklift aisle between the docks and the staging slots */
export const gapOffset = (w: WarehouseDef) => dockSpan(w) + 3.2
export const slotStart = (w: WarehouseDef) => dockSpan(w) + 5.6
export const buildingWidth = (w: WarehouseDef) =>
  2 * (slotStart(w) + (SLOT_COLS - 1) * SLOT_STEP + 2.6)
export const buildingCenterZ = FRONT_Z - BUILDING_DEPTH / 2
export const yardHalfWidth = (w: WarehouseDef) => buildingWidth(w) / 2 + 2
