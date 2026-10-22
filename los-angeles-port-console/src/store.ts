'use client'

import { create } from 'zustand'

export type PortTab = 'Overview' | 'Vessels' | 'Cargo' | 'Port data' | 'City 4 · WT'

interface PortUiState {
  tab: PortTab
  query: string
  setTab: (tab: PortTab) => void
  setQuery: (query: string) => void
}

export const usePortUi = create<PortUiState>(set => ({
  tab: 'Overview',
  query: '',
  setTab: tab => set({ tab }),
  setQuery: query => set({ query }),
}))
