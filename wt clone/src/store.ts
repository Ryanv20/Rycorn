import { create } from 'zustand'

export type Selection =
  | { type: 'truck'; id: string }
  | { type: 'forklift'; id: string }
  | { type: 'ship'; id: string }
  | { type: 'slot'; id: string }
  | null

export type CamCommand =
  | { kind: 'warehouse'; id: string }
  | { kind: 'overview' }
  | { kind: 'zoom'; dir: 1 | -1 }
  | { kind: 'rotate'; dir: 1 | -1 }
  | { kind: 'home' }
  | { kind: 'focus'; x: number; z: number }

interface UIState {
  activeWh: string // warehouse id or 'all'
  paused: boolean
  dayNightEnabled: boolean
  layers: { city: boolean; port: boolean; warehouses: boolean; vehicles: boolean; kpis: boolean; infoPanel: boolean; shipmentTracking: boolean; fleetPanel: boolean; cameraControls: boolean }
  selected: Selection
  follow: boolean
  fleetTab: 'docks' | 'forklifts' | 'trucks' | 'transfers'
  tick: number
  camCmd: { cmd: CamCommand; n: number } | null
  setActiveWh: (id: string) => void
  setPaused: (paused: boolean) => void
  setDayNightEnabled: (enabled: boolean) => void
  setLayer: (layer: keyof UIState['layers'], visible: boolean) => void
  setAllLayers: (visible: boolean) => void
  select: (s: Selection, follow?: boolean) => void
  setFollow: (f: boolean) => void
  setFleetTab: (t: UIState['fleetTab']) => void
  bump: () => void
  cam: (cmd: CamCommand) => void
}

let camN = 0

export const useUI = create<UIState>((set) => ({
  activeWh: 'all',
  paused: true,
  dayNightEnabled: true,
  layers: { city: true, port: true, warehouses: true, vehicles: true, kpis: true, infoPanel: true, shipmentTracking: true, fleetPanel: true, cameraControls: true },
  selected: null,
  follow: false,
  fleetTab: 'docks',
  tick: 0,
  camCmd: null,
  setActiveWh: (id) => {
    set({ activeWh: id, selected: null, follow: false })
    set({ camCmd: { cmd: id === 'all' ? { kind: 'overview' } : { kind: 'warehouse', id }, n: ++camN } })
  },
  setPaused: (paused) => set({ paused }),
  setDayNightEnabled: (dayNightEnabled) => set({ dayNightEnabled }),
  setLayer: (layer, visible) => set((state) => ({ layers: { ...state.layers, [layer]: visible } })),
  setAllLayers: (visible) => set({ layers: { city: visible, port: visible, warehouses: visible, vehicles: visible, kpis: visible, infoPanel: visible, shipmentTracking: visible, fleetPanel: visible, cameraControls: visible } }),
  select: (s, follow = true) => set({ selected: s, follow: s ? follow : false }),
  setFollow: (f) => set({ follow: f }),
  setFleetTab: (t) => set({ fleetTab: t }),
  bump: () => set((st) => ({ tick: st.tick + 1 })),
  cam: (cmd) => set({ camCmd: { cmd, n: ++camN } }),
}))
