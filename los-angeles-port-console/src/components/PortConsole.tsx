'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Anchor, ArrowUpRight, Bell, Boxes, ChevronDown, CircleHelp, Clock3, Container, Eye, Gauge, LayoutDashboard, Map as MapIcon, Pause, Play, Radio, Search, Ship, Sun, Waves, X } from 'lucide-react'
import PortYard, { type PortIncident, type YardDemand, type YardVessel } from './PortYard'
import { usePortUi, type PortTab } from '@/store'

const PORT_ID = '19WPI-16080'
const PORT_NAME = 'Port of Los Angeles'
const PORT_NODE = `node-${PORT_ID}`
const LEKKI_CITY_4_URL = (() => {
  const target = new URL(process.env.NEXT_PUBLIC_RYCORN_LEKKI_CONSOLE_ORIGIN ?? 'http://localhost:5174')
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(target.hostname)) target.hostname = window.location.hostname
  target.searchParams.set('city', '4')
  return target.toString()
})()
const configuredApiOrigin = process.env.NEXT_PUBLIC_RYCORN_API_ORIGIN ?? 'http://localhost:3000'
const API = (() => {
  const origin = new URL(configuredApiOrigin)
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(origin.hostname)) {
    origin.hostname = window.location.hostname
  }
  return origin.origin
})()

// Keep the browser DTO names aligned with the server's canonical port and DS contracts.
type CanonicalPortRecord = { portId: string; sourceId: string; name: string; country: string; latitude: number; longitude: number; harborType: string; harborSize: string; maximumVesselSize: string; source: string; sourceVersion: string }
type CargoDemand = { requestId: string; origin: string; destination: string; quantity: number; cargoType: string; status: string; deadline?: number }
type VesselSupply = { id: string; capability: string; startNodeId: string; vesselType?: string; deadweightTonnes?: number }
type VesselState = { vesselId: string; status: string; currentNodeId: string; assignedCargoIds?: string[]; currentRoute?: { path?: string[]; totalDistanceKm?: number }; currentVoyageStartedAt?: number; expectedArrivalAt?: number }
type CargoState = { cargoId: string; originNodeId: string; destinationNodeId: string; quantity: number; cargoType?: string; status: string; assignedVesselId?: string; deadline?: number }
type EventRecord = { eventId: string; simulationTime: number; eventType: string; entityId: string; locationNodeId: string; metadata?: Record<string, unknown> }
type NetworkNode = { id: string; latitude: number; longitude: number; name?: string }
type SystemStatus = { engineInitialized: boolean; engineRunning: boolean; totalEventsProcessed: number; clockProfileId: string; continuousMode: boolean; simulationTimeHours: number; simulationTimeSource: 'engine-event-queue' }

type DashboardData = {
  port: CanonicalPortRecord | null
  demands: CargoDemand[]
  supply: VesselSupply[]
  nodes: NetworkNode[]
  vessels: VesselState[]
  cargoes: CargoState[]
  events: EventRecord[]
  system: SystemStatus | null
}

type OverlayKey = 'heading' | 'metricVessels' | 'metricDemands' | 'metricCargo' | 'metricDepth' | 'demandPanel' | 'simulationBadge' | 'sceneCaption'
const overlayOptions: Array<{ key: OverlayKey; label: string }> = [
  { key: 'heading', label: 'Port heading' },
  { key: 'metricVessels', label: 'Vessels metric' },
  { key: 'metricDemands', label: 'Demand metric' },
  { key: 'metricCargo', label: 'Cargo metric' },
  { key: 'metricDepth', label: 'Port size metric' },
  { key: 'demandPanel', label: 'Cargo movement panel' },
  { key: 'simulationBadge', label: 'Simulation badge' },
  { key: 'sceneCaption', label: 'Scene caption' },
]
const initialOverlayState: Record<OverlayKey, boolean> = {
  heading: true,
  metricVessels: true,
  metricDemands: true,
  metricCargo: true,
  metricDepth: true,
  demandPanel: true,
  simulationBadge: false,
  sceneCaption: false,
}

const EMPTY: DashboardData = { port: null, demands: [], supply: [], nodes: [], vessels: [], cargoes: [], events: [], system: null }
const PORT_DATA_CACHE_KEY = 'rycorn:la-port-dashboard:v1'
function readPortDataCache(): DashboardData {
  if (typeof window === 'undefined') return EMPTY
  try {
    const cached = JSON.parse(window.localStorage.getItem(PORT_DATA_CACHE_KEY) ?? 'null') as Partial<DashboardData> | null
    if (!cached || !Array.isArray(cached.supply) || !Array.isArray(cached.nodes)) return EMPTY
    return {
      ...EMPTY,
      ...cached,
      demands: Array.isArray(cached.demands) ? cached.demands : [],
      vessels: Array.isArray(cached.vessels) ? cached.vessels : [],
      cargoes: Array.isArray(cached.cargoes) ? cached.cargoes : [],
      events: Array.isArray(cached.events) ? cached.events.slice(-100) : [],
    }
  } catch {
    return EMPTY
  }
}
const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const shortNode = (nodeId: string, port?: CanonicalPortRecord | null) => nodeId === PORT_NODE ? PORT_NAME : nodeId.replace(/^node-/, '')
const stamp = (hours: number) => `T+${hours.toFixed(1)}h`

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response.json() as Promise<T>
}

export default function PortConsole() {
  const { tab, query, setTab, setQuery } = usePortUi()
  const [data, setData] = useState<DashboardData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [clockBusy, setClockBusy] = useState(false)
  const [actionMessage, setActionMessage] = useState('')
  const [focusMode, setFocusMode] = useState(false)
  const [simulationMenuOpen, setSimulationMenuOpen] = useState(false)
  const [dayNightFrozen, setDayNightFrozen] = useState(true)
  const [overlayManagerOpen, setOverlayManagerOpen] = useState(false)
  const [overlays, setOverlays] = useState<Record<OverlayKey, boolean>>(initialOverlayState)
  const submittedIncidents = useRef(new Set<string>())

  const dismissOverlay = (key: OverlayKey) => setOverlays(current => ({ ...current, [key]: false }))
  const toggleOverlay = (key: OverlayKey) => setOverlays(current => ({ ...current, [key]: !current[key] }))
  const restoreOverlays = () => setOverlays(initialOverlayState)

  useEffect(() => {
    setData(readPortDataCache())
  }, [])

  useEffect(() => {
    if (!data.port && data.supply.length === 0 && data.demands.length === 0) return
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(PORT_DATA_CACHE_KEY, JSON.stringify({ ...data, events: data.events.slice(-100) }))
      } catch {
        // Keep the dashboard usable if browser storage is unavailable or full.
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [data])

  const refresh = useCallback(async () => {
    try {
      const [ports, demandResult, supplyResult, system, nodes] = await Promise.all([
        getJson<CanonicalPortRecord[]>('/network/ports'),
        getJson<{ demands: CargoDemand[] }>('/ds/demands'),
        getJson<{ vessels: VesselSupply[] }>('/ds/supply'),
        getJson<SystemStatus>('/admin/status').catch(() => null),
        getJson<NetworkNode[]>('/network/nodes').catch(() => []),
      ])
      const [stateResult, events] = system?.engineInitialized
        ? await Promise.all([
          getJson<{ vessels: VesselState[]; cargoes: CargoState[] }>('/simulation/status'),
          getJson<EventRecord[]>('/simulation/events'),
        ])
        : [{ vessels: [], cargoes: [] }, []] as [{ vessels: VesselState[]; cargoes: CargoState[] }, EventRecord[]]
      setData({
        port: ports.find(port => port.portId === PORT_ID) ?? null,
        demands: demandResult.demands,
        supply: supplyResult.vessels,
        nodes,
        vessels: stateResult.vessels,
        cargoes: stateResult.cargoes,
        events,
        system,
      })
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not connect to the Rycon API')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 4000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const port = data.port
  const vesselById = useMemo(() => new Map(data.vessels.map(vessel => [vessel.vesselId, vessel])), [data.vessels])
  const cargoById = useMemo(() => new Map(data.cargoes.map(cargo => [cargo.cargoId, cargo])), [data.cargoes])
  const relatedDemands = useMemo(() => data.demands.filter(demand => demand.origin === PORT_NODE || demand.destination === PORT_NODE), [data.demands])
  const portVessels = useMemo(() => data.supply.map(supply => ({ supply, state: vesselById.get(supply.id) }))
    .filter(({ supply, state }) => state?.currentNodeId === PORT_NODE || state?.currentRoute?.path?.includes(PORT_NODE) || (!state && supply.startNodeId === PORT_NODE)), [data.supply, vesselById])
  const yardVessels: YardVessel[] = data.supply.map(supply => {
    const state = vesselById.get(supply.id)
    return {
    id: supply.id,
    type: supply.vesselType,
    capability: supply.capability,
    deadweightTonnes: supply.deadweightTonnes,
    status: state?.status ?? 'SUPPLY',
    currentNodeId: state?.currentNodeId ?? supply.startNodeId,
    startsAtPort: state ? state.currentNodeId === PORT_NODE : supply.startNodeId === PORT_NODE,
    routeTouchesPort: Boolean(state?.currentRoute?.path?.includes(PORT_NODE)),
    currentRoutePath: state?.currentRoute?.path ?? [],
    currentRouteDistanceKm: state?.currentRoute?.totalDistanceKm,
    currentVoyageStartedAt: state?.currentVoyageStartedAt,
    expectedArrivalAt: state?.expectedArrivalAt,
    assignedCargoIds: state?.assignedCargoIds ?? [],
    }
  })
  const yardDemands: YardDemand[] = relatedDemands.map(demand => ({
    id: demand.requestId,
    cargoType: demand.cargoType,
    quantity: demand.quantity,
    status: cargoById.get(demand.requestId)?.status ?? demand.status,
  }))
  const inPortCount = data.system?.engineInitialized
    ? data.vessels.filter(vessel => vessel.currentNodeId === PORT_NODE).length
    : portVessels.filter(({ supply }) => supply.startNodeId === PORT_NODE).length
  const openModelUnits = relatedDemands.filter(demand => !['DELIVERED', 'DELIVERED_LATE', 'CANCELLED', 'FAILED'].includes(demand.status))
    .reduce((sum, demand) => sum + demand.quantity, 0)
  const arrivals = data.events.filter(event => event.locationNodeId === PORT_NODE && ['ARRIVED', 'REPOSITION_ARRIVED'].includes(event.eventType)).slice(-5).reverse()
  const visibleDemands = relatedDemands.filter(demand => `${demand.requestId} ${demand.cargoType} ${demand.status} ${demand.origin} ${demand.destination}`.toLowerCase().includes(query.toLowerCase()))
  const engineReady = Boolean(data.system?.engineInitialized)

  const reportSceneIncident = useCallback(async (incident: PortIncident) => {
    if (!incident.vesselId || !engineReady || submittedIncidents.current.has(incident.id)) return
    submittedIncidents.current.add(incident.id)
    try {
      const response = await fetch(`${API}/simulation/incident`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vesselId: incident.vesselId, incident: `Physical overlap: ${incident.title}`, delayHours: 0.5 }),
      })
      if (!response.ok) throw new Error(`Rycon returned ${response.status}`)
      setActionMessage(`${incident.title} recorded as a Rycon maritime incident · arrival delayed 0.5 h`)
      await refresh()
    } catch (cause) {
      setActionMessage(`${incident.title} detected in the port view; Rycon could not record it (${cause instanceof Error ? cause.message : 'API error'})`)
    }
  }, [engineReady, refresh])

  const controlEngine = async (action: 'run' | 'pause') => {
    setActionBusy(true)
    setActionMessage('')
    try {
      if (action === 'run' && !engineReady) {
        const init = await fetch(`${API}/simulation/initialize`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
        if (!init.ok) throw new Error(`Engine initialization failed (${init.status})`)
      }
      const response = await fetch(`${API}/simulation/${action}`, { method: 'POST' })
      if (!response.ok) throw new Error(`Engine ${action} failed (${response.status})`)
      setActionMessage(action === 'run' ? 'Rycon engine running' : 'Rycon engine paused')
      await refresh()
    } catch (cause) {
      setActionMessage(cause instanceof Error ? cause.message : 'Engine action failed')
    } finally {
      setActionBusy(false)
    }
  }

  const changeClockProfile = async (profileId: string) => {
    setClockBusy(true)
    setActionMessage('')
    try {
      const response = await fetch(`${API}/simulation/clock-profile`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profileId }) })
      if (!response.ok) throw new Error(`Simulation speed change failed (${response.status})`)
      await refresh()
    } catch (cause) {
      setActionMessage(cause instanceof Error ? cause.message : 'Could not change simulation speed')
    } finally {
      setClockBusy(false)
    }
  }

  const tabs: PortTab[] = ['Overview', 'Vessels', 'Cargo', 'Port data', 'City 4 · WT']
  const nav = (label: PortTab) => { setTab(label); setQuery('') }

  const simulationTimeHours = data.system?.simulationTimeHours ?? 0

  return <div className={`app-shell${focusMode ? ' map-focus' : ''}`}>
    <aside className="sidebar">
      <a className="brand" href="#top"><span className="brand-mark"><Waves size={20}/></span><span>rycorn<span className="brand-dot">.</span><small>PORT SYSTEM</small></span></a>
      <div className="port-switch"><span className="port-icon"><Anchor size={16}/></span><span><small>ACTIVE PORT</small><b>{PORT_NAME}</b></span><ChevronDown size={15}/></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>
        <button className={`nav-item ${tab === 'Overview' ? 'active' : ''}`} onClick={() => nav('Overview')}><LayoutDashboard size={17}/> Overview {tab === 'Overview' && <span className="nav-active-dot"/>}</button>
        <button className={`nav-item ${tab === 'Vessels' ? 'active' : ''}`} onClick={() => nav('Vessels')}><Ship size={17}/> Vessel calls <span className="nav-count">{portVessels.length}</span></button>
        <button className={`nav-item ${tab === 'Cargo' ? 'active' : ''}`} onClick={() => nav('Cargo')}><Boxes size={17}/> Cargo demand <span className="nav-count">{relatedDemands.length}</span></button>
        <button className={`nav-item ${tab === 'Port data' ? 'active' : ''}`} onClick={() => nav('Port data')}><MapIcon size={17}/> Port reference</button>
      </nav>
      <div className="nav-label tools-label">RYCON ENGINE</div>
      <div className="engine-box"><span className={`engine-light ${data.system?.engineRunning ? 'running' : ''}`}/><div><b>{data.system?.engineRunning ? 'Simulation running' : engineReady ? 'Simulation paused' : 'Engine ready'}</b><small>{data.system?.clockProfileId ?? 'Waiting for engine'}</small></div></div>
      <div className="sidebar-bottom"><div className="source-card"><Radio size={15}/><div><small>PORT REFERENCE</small><b>WPI · {port?.sourceVersion?.replace('NGA Pub 150, ', '') ?? 'NGA Pub 150'}</b><span>Static source data · not live conditions</span></div></div><button className="help-link"><CircleHelp size={16}/> Rycon simulation API <span>↗</span></button><div className="profile"><div className="avatar">RY</div><div><b>Rycorn</b><small>Maritime operations</small></div><Activity size={17}/></div></div>
    </aside>

    <main id="top" className="main-content">
      <header className="topbar">
        <div className="breadcrumbs"><span className="top-brand"><Waves size={17}/><b>RYCORN<span> · PORT CONSOLE</span></b></span><span className="top-separator"/><Anchor size={14}/><b>{PORT_NAME}</b><span>/</span><span>{tab}</span></div>
        <label className="top-search"><Search size={15}/><input placeholder="Search vessels and cargo" aria-label="Search port data" value={query} onChange={event => setQuery(event.target.value)}/><kbd>/</kbd></label>
        <div className="top-actions">
          <div className="simulation-menu-wrap">
            <button className="engine-action simulation-menu-toggle" onClick={() => setSimulationMenuOpen(open => !open)} aria-expanded={simulationMenuOpen}><Activity size={14}/>Simulation<ChevronDown size={12}/></button>
            {simulationMenuOpen && <div className="simulation-menu">
              <div className={`system-status ${error ? 'offline' : ''}`}><i/>{error ? 'Rycon API offline' : loading ? 'Connecting to Rycon API' : 'Rycon API connected'}</div>
              <label className="clock-control"><Clock3 size={13}/><select aria-label="Simulation speed" value={data.system?.clockProfileId ?? 'HOUR_PER_SECOND'} disabled={clockBusy} onChange={event => void changeClockProfile(event.target.value)}><option value="HOUR_PER_SECOND">1 hour / sec</option><option value="SIX_HOURS_PER_SECOND">6 hours / sec</option><option value="FAST_REVIEW">1 day / sec</option><option value="WEEK_PER_SECOND">1 week / sec</option></select></label>
              <button className="engine-action" aria-pressed={dayNightFrozen} onClick={() => setDayNightFrozen(value => !value)}><Sun size={13}/>{dayNightFrozen ? 'Resume lighting cycle' : 'Freeze lighting'}</button>
              <button className="engine-action" disabled={actionBusy || Boolean(data.system?.engineRunning)} onClick={() => void controlEngine('run')}><Play size={13}/>{actionBusy ? 'Working' : 'Run simulation'}</button>
              <button className="engine-action pause-action" disabled={actionBusy || !data.system?.engineRunning} onClick={() => void controlEngine('pause')}><Pause size={13}/>Pause simulation</button>
            </div>}
          </div>
          <button className="icon-button notification" aria-label="Refresh port data" title="Refresh port data" onClick={() => void refresh()}><Bell size={17}/></button>
        </div>
      </header>
      <div className="page-wrap">
        {overlays.heading && <section className="page-heading"><button className="overlay-dismiss" aria-label="Dismiss port heading" title="Dismiss port heading" onClick={() => dismissOverlay('heading')}><X size={12}/></button><div><div className="eyebrow"><span/> LOS ANGELES, UNITED STATES · {port?.portId ?? PORT_ID} <span className="eyebrow-line"/> WPI PORT REFERENCE</div><h1>{PORT_NAME} operations<span>.</span></h1><p>Live Rycorn demand, vessel supply, and simulation state for Los Angeles.</p></div><div className="port-coordinate"><Anchor size={14}/>{port ? `${port.latitude.toFixed(3)}, ${port.longitude.toFixed(3)}` : '33.750, -118.250'}</div></section>}
        {actionMessage && <div className="action-message"><button className="overlay-dismiss" aria-label="Dismiss engine message" onClick={() => setActionMessage('')}><X size={12}/></button>{actionMessage}</div>}
        {error && <div className="api-error"><button className="overlay-dismiss" aria-label="Dismiss API message" onClick={() => setError('')}><X size={12}/></button><b>Rycon API unavailable.</b> Start the Rycon server to load live engine and DS data. <span>{error}</span></div>}
        <div className="tab-row">{tabs.map(item => <button key={item} className={tab === item ? 'tab selected' : 'tab'} onClick={() => nav(item)}>{item}{item === 'Cargo' && <i>{relatedDemands.length}</i>}</button>)}<div className="tab-rule"/><span className="refresh-label"><span className="live-dot"/> REFRESHES EVERY 4 SEC</span></div>

        {tab === 'Overview' && <>
          <section className="metrics-grid">
            {overlays.metricVessels && <Metric icon={<Ship size={16}/>} label="VESSELS AT PORT" value={nf.format(inPortCount)} note={`${nf.format(data.supply.length)} vessels in Rycon supply`} tone="blue" onDismiss={() => dismissOverlay('metricVessels')} />}
            {overlays.metricDemands && <Metric icon={<Boxes size={16}/>} label="RELATED DEMANDS" value={nf.format(relatedDemands.length)} note="DS requests with Los Angeles as an endpoint" tone="green" onDismiss={() => dismissOverlay('metricDemands')} />}
            {overlays.metricCargo && <Metric icon={<Container size={16}/>} label="OPEN MODEL UNITS" value={nf.format(openModelUnits)} note="Open demand quantity · model units" tone="orange" onDismiss={() => dismissOverlay('metricCargo')} />}
            {overlays.metricDepth && <Metric icon={<Gauge size={16}/>} label="PORT SIZE" value={port ? `${port.harborSize}` : '—'} note={port?.harborType ?? 'WPI reference'} tone="violet" onDismiss={() => dismissOverlay('metricDepth')} />}
          </section>
          <section className="visual-section"><div className="section-heading"><div><span className="section-kicker">LOS ANGELES HARBOR · LIVE RYCORN VESSELS + PORT ASSETS</span><h2>{PORT_NAME}<span>.</span></h2></div><button className="text-action" onClick={() => nav('Port data')}>Port reference <ArrowUpRight size={15}/></button></div><div className="yard-scene"><PortYard vessels={yardVessels} demands={yardDemands} nodes={data.nodes} port={port} simulationTimeHours={simulationTimeHours} simulationRunning={Boolean(data.system?.engineRunning)} clockProfileId={data.system?.clockProfileId ?? 'HOUR_PER_SECOND'} dayNightFrozen={dayNightFrozen} onToggleOverlays={() => setOverlayManagerOpen(open => !open)} onFocusScene={() => setFocusMode(true)} onIncidentDetected={reportSceneIncident}/>{overlays.simulationBadge && <div className="scene-label"><span className="live-dot"/> RYCORN SIMULATION <strong>{data.system?.engineRunning ? 'RUNNING' : engineReady ? 'PAUSED' : 'READY'}</strong><button className="overlay-dismiss" aria-label="Dismiss simulation badge" onClick={() => dismissOverlay('simulationBadge')}><X size={11}/></button></div>}{overlays.sceneCaption && <div className="scene-caption"><span>{port?.portId ?? PORT_ID}</span><b>Live Rycorn vessels and cargo · locally modeled Los Angeles harbor operations</b><button className="overlay-dismiss" aria-label="Dismiss scene caption" onClick={() => dismissOverlay('sceneCaption')}><X size={11}/></button></div>}</div></section>
          {overlays.demandPanel && <section className="lower-grid one-panel"><div className="shipments-panel"><OverlayDismiss label="cargo movement panel" onDismiss={() => dismissOverlay('demandPanel')} /><div className="panel-heading"><div><span className="section-kicker">RYCON DS · LOS ANGELES MOVEMENTS</span><h3>Cargo demand and shipment tracking</h3></div><button className="view-all" onClick={() => nav('Cargo')}>View all <ArrowUpRight size={14}/></button></div><SearchBar value={query} onChange={setQuery}/><DemandTable demands={visibleDemands.slice(0, 5)} port={port} cargoById={cargoById}/></div></section>}
          </section>}
        </>}

        {tab === 'Vessels' && <DataPage kicker="RYCON ENGINE · VESSEL STATE" title="Vessels at Port of Los Angeles" subtitle="State from the Rycon simulation, matched to DS fleet supply." query={query} setQuery={setQuery}><VesselTable rows={portVessels} port={port}/></DataPage>}
        {tab === 'Cargo' && <DataPage kicker="RYCORN DS · CARGO DEMAND" title="Demand connected to Port of Los Angeles" subtitle="Cargo records where Port of Los Angeles is the origin or destination." query={query} setQuery={setQuery}><DemandTable demands={visibleDemands} port={port} cargoById={cargoById}/></DataPage>}
        {tab === 'Port data' && <PortDataPage port={port}/>}
        {tab === 'City 4 · WT' && <section className="city4-handoff"><div><span className="section-kicker">DS / WARETRACK CROSS-SECTION</span><h1>City 4 · Los Angeles handoff</h1><p>Rycon DS requests for the Port of Los Angeles appear here by request and status. Open the matching City 4 yard in Waretrack to view its trucks, docks, and warehouse assets.</p></div><button className="engine-action" onClick={() => window.open(LEKKI_CITY_4_URL, '_blank', 'noopener,noreferrer')}>Open City 4 in Waretrack <ArrowUpRight size={14}/></button><div className="city4-demand-list">{relatedDemands.map(demand => <article key={demand.requestId}><b>{demand.requestId}</b><span>{demand.origin === PORT_NODE ? 'Outbound from LA' : 'Inbound to LA'} · {demand.cargoType}</span><strong>{cargoById.get(demand.requestId)?.status ?? demand.status}</strong><small>{demand.quantity.toLocaleString()} model units</small></article>)}{relatedDemands.length === 0 && <p>No Rycorn DS requests currently touch Los Angeles. The City 4 yard remains available for the test route.</p>}</div><small className="city4-note">City 4 is the visual handoff point. Rycorn DS and engine state remain authoritative; Waretrack supplies the local truck and warehouse visualization.</small></section>}
        <footer className="page-footer"><span>Rycorn Port Console · Port of Los Angeles</span><span><span className="live-dot"/> {error ? 'Waiting for API' : 'Data refreshed from Rycon API'}</span><span>Observed source facts and modeled state stay distinct</span></footer>
      </div>
    </main>
    {overlayManagerOpen && <aside className="overlay-manager"><div className="overlay-manager-heading"><b>MAP OVERLAYS</b><button aria-label="Close overlay controls" onClick={() => setOverlayManagerOpen(false)}><X size={15}/></button></div><div className="overlay-manager-list">{overlayOptions.map(({ key, label }) => <label key={key}><input type="checkbox" checked={overlays[key]} onChange={() => toggleOverlay(key)} />{label}</label>)}</div><button className="overlay-restore-all" onClick={restoreOverlays}>Restore all</button></aside>}
    {focusMode && <button className="map-overlay-restore" onClick={() => { setFocusMode(false); setOverlayManagerOpen(true) }}><Eye size={15}/>Map overlays</button>}
  </div>
}

function OverlayDismiss({ label, onDismiss }: { label: string; onDismiss: () => void }) {
  return <button className="overlay-dismiss" aria-label={`Dismiss ${label}`} title={`Dismiss ${label}`} onClick={onDismiss}><X size={12}/></button>
}

function Metric({ icon, label, value, note, tone, onDismiss }: { icon: React.ReactNode; label: string; value: string; note: string; tone: string; onDismiss: () => void }) {
  return <article className="metric-card"><OverlayDismiss label={`${label.toLowerCase()} metric`} onDismiss={onDismiss}/><div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}>{icon}</span></div><div className="metric-value">{value}</div><div className="metric-foot">{note}</div></article>
}

function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="table-toolbar"><span>Port-related records supplied by Rycon DS and the engine</span><label className="search-field"><Search size={14}/><input aria-label="Search port records" placeholder="Search records" value={value} onChange={event => onChange(event.target.value)}/></label></div>
}

function DemandTable({ demands, port, cargoById }: { demands: CargoDemand[]; port: CanonicalPortRecord | null; cargoById: Map<string, CargoState> }) {
  if (!demands.length) return <div className="empty-state">No Port of Los Angeles demand records in the current Rycon data.</div>
  return <div className="shipment-table"><div className="table-head"><span>REQUEST</span><span>ROUTE / CARGO</span><span>QUANTITY</span><span>STATUS</span><span>DEADLINE</span></div>{demands.map(demand => {
    const engineCargo = cargoById.get(demand.requestId)
    const status = engineCargo?.status ?? demand.status
    return <div className="shipment-row" key={demand.requestId}><div><b>{demand.requestId}</b><small>Rycon DS</small></div><div><b>{shortNode(demand.origin, port)} → {shortNode(demand.destination, port)}</b><small>{engineCargo?.cargoType ?? demand.cargoType ?? 'GENERAL'}</small></div><div>{nf.format(demand.quantity)} <small>model units</small></div><div><span className={`status-pill ${statusTone(status)}`}>{status.replaceAll('_', ' ')}</span></div><div className="time-cell">{demand.deadline === undefined ? '—' : `${nf.format(demand.deadline)} h`}</div></div>
  })}</div>
}

function VesselTable({ rows, port }: { rows: Array<{ supply: VesselSupply; state?: VesselState }>; port: CanonicalPortRecord | null }) {
  if (!rows.length) return <div className="empty-state">No vessel is currently recorded at Port of Los Angeles. Vessel supply remains visible in the system's network view.</div>
  return <div className="shipment-table"><div className="table-head"><span>VESSEL</span><span>TYPE / CAPABILITY</span><span>LOCATION</span><span>STATE</span><span>CARGO</span></div>{rows.map(({ supply, state }) => <div className="shipment-row" key={supply.id}><div><b>{supply.id}</b><small>{nf.format(supply.deadweightTonnes ?? 0)} t deadweight</small></div><div><b>{supply.vesselType ?? 'Vessel'}</b><small>Capability {supply.capability}</small></div><div>{shortNode(state?.currentNodeId ?? supply.startNodeId, port)}</div><div><span className={`status-pill ${statusTone(state?.status ?? 'IDLE')}`}>{(state?.status ?? 'SUPPLY').replaceAll('_', ' ')}</span></div><div>{state?.assignedCargoIds?.join(', ') || '—'}</div></div>)}</div>
}

function DataPage({ kicker, title, subtitle, query, setQuery, children }: { kicker: string; title: string; subtitle: string; query: string; setQuery: (value: string) => void; children: React.ReactNode }) {
  return <section className="data-page"><div className="section-heading"><div><span className="section-kicker">{kicker}</span><h2>{title}<span>.</span></h2><p>{subtitle}</p></div></div><div className="shipments-panel"><SearchBar value={query} onChange={setQuery}/>{children}</div></section>
}

function PortDataPage({ port }: { port: CanonicalPortRecord | null }) {
  const facts = [
    ['Port name', `${PORT_NAME} (WPI: ${port?.name ?? 'Los Angeles'})`], ['Port identifier', port?.portId ?? PORT_ID], ['WPI source identifier', port?.sourceId ?? '16080'], ['Country', port?.country ?? 'United States'],
    ['Harbor', `${port?.harborSize ?? 'Large'} · ${port?.harborType ?? 'Coastal (Breakwater)'}`], ['Coordinates', port ? `${port.latitude}, ${port.longitude}` : '33.75, -118.25'],
    ['Maximum vessel size', port?.maximumVesselSize || 'Not reported in this WPI record'],
  ]
  return <section className="data-page port-data-page"><div className="section-heading"><div><span className="section-kicker">STATIC REFERENCE · NGA WORLD PORT INDEX</span><h2>Port of Los Angeles characteristics<span>.</span></h2><p>WPI reference attributes are distinct from Rycon's modeled operating state.</p></div></div><div className="facts-grid">{facts.map(([label, value]) => <article className="fact-card" key={label}><small>{label}</small><b>{value}</b></article>)}</div><div className="source-note"><Waves size={17}/><div><b>Source boundary</b><span>WPI provides port identity, location, and harbor classification. Rycon supplies modeled demand, vessel state, routes, and simulation events.</span><small>{port?.sourceVersion ?? 'NGA Pub 150 · WPI record 16080'}</small></div></div></section>
}

function Arrival({ event, port }: { event: EventRecord; port: CanonicalPortRecord | null }) {
  return <div className="arrival"><div className="arrival-time"><b>{stamp(event.simulationTime)}</b><span>SIM TIME</span></div><div className="arrival-line"><i/></div><div className="arrival-copy"><div><Ship size={15}/><b>{event.entityId}</b><span className="eta-badge">{event.eventType.replace('_', ' ')}</span></div><p>{shortNode(event.locationNodeId, port)} <span>·</span> {String(event.metadata?.cargoIds ?? 'Rycon event')}</p><small>Event {event.eventId}</small></div></div>
}

function statusTone(status: string) {
  if (['DELIVERED', 'DELIVERED_LATE', 'ARRIVED', 'IDLE', 'UNLOADING'].includes(status)) return 'green'
  if (['IN_TRANSIT', 'SAILING', 'REPOSITIONING', 'ASSIGNED', 'LOADING'].includes(status)) return 'blue'
  if (['FAILED', 'CANCELLED'].includes(status)) return 'red'
  return 'amber'
}
