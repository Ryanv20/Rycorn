import { create } from 'zustand'

export type Selection =
  | { type: 'truck'; id: string }
  | { type: 'forklift'; id: string }
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
  selected: Selection
  follow: boolean
  fleetTab: 'docks' | 'forklifts' | 'trucks'
  tick: number
  camCmd: { cmd: CamCommand; n: number } | null
  setActiveWh: (id: string) => void
  select: (s: Selection, follow?: boolean) => void
  setFollow: (f: boolean) => void
  setFleetTab: (t: UIState['fleetTab']) => void
  bump: () => void
  cam: (cmd: CamCommand) => void
}

let camN = 0

export const useUI = create<UIState>((set) => ({
  activeWh: 'all',
  selected: null,
  follow: false,
  fleetTab: 'docks',
  tick: 0,
  camCmd: null,
  setActiveWh: (id) => {
    set({ activeWh: id, selected: null, follow: false })
    set({ camCmd: { cmd: id === 'all' ? { kind: 'overview' } : { kind: 'warehouse', id }, n: ++camN } })
  },
  select: (s, follow = true) => set({ selected: s, follow: s ? follow : false }),
  setFollow: (f) => set({ follow: f }),
  setFleetTab: (t) => set({ fleetTab: t }),
  bump: () => set((st) => ({ tick: st.tick + 1 })),
  cam: (cmd) => set({ camCmd: { cmd, n: ++camN } }),
}))
