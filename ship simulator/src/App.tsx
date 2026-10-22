import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { BridgeScene, type SceneVessel, type ViewMode, type WeatherMode } from './scene'

type ShipState = {
  speed: number
  heading: number
  rudder: number
  throttle: number
  position: number
  x: number
  z: number
  paused: boolean
  engine: number
  depth: number
  walkX: number
  walkZ: number
}

type FleetVessel = {
  vesselId: string
  vesselType: string
  capability: string | number
  status: string
  locationName: string
  destinationName: string
  latitude: number
  longitude: number
  bearing: number
  routeCoordinates: Array<{ latitude: number; longitude: number }>
  expectedArrivalAt: number | null
  assignedCargoIds: string[]
  assignedCargoes?: Array<{ cargoId: string; deadline?: number; destinationNodeId: string }>
}

const statusTone = (status: string) => status === 'SAILING' || status === 'REPOSITIONING' ? 'moving'
  : status === 'LOADING' || status === 'UNLOADING' || status === 'ARRIVED' ? 'working'
    : status === 'IDLE' ? 'stopped' : 'other'

function compactVesselId(id: string) {
  const rycMer = id.match(/^RYC-MER-(\d+)/i)
  if (rycMer) {
    const serial = rycMer[1].replace(/^0+/, '') || '0'
    return `M${serial.length > 3 ? serial[0] : serial}`
  }
  const match = id.match(/^([A-Z])[A-Z-]*?(\d)/i)
  return match ? `${match[1].toUpperCase()}${match[2]}` : id.slice(0, 2).toUpperCase()
}

type CaptainEvent = { eventId: string; entityId: string; eventType: string; simulationTime: number; summary: string; metadata: Record<string, unknown> }
type CaptainControl = { vesselId: string; rudder: number; throttle: number }
type ClockProfile = { id: string; label: string; description: string; simulatedHoursPerWallSecond: number }

const apiOrigin = new URL(window.location.href)
apiOrigin.port = import.meta.env.VITE_RYCORN_API_PORT || '3000'
apiOrigin.pathname = ''
apiOrigin.search = ''
apiOrigin.hash = ''
const API = apiOrigin.origin
const WS = `${apiOrigin.protocol === 'https:' ? 'wss:' : 'ws:'}//${apiOrigin.host}/ws`
const CLIENT_PORT = import.meta.env.VITE_RYCORN_CLIENT_PORT || '5173'

function modeledTime(hours: number) {
  const days = Math.floor(hours / 24)
  const dayHours = Math.floor(hours % 24)
  const minutes = Math.floor((hours * 60) % 60)
  return `T+${days}d ${String(dayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

const initialShip: ShipState = {
  speed: 0,
  heading: 0,
  rudder: 0,
  throttle: 0,
  position: 0,
  x: 0,
  z: 0,
  paused: false,
  engine: 0,
  depth: 18.4,
  walkX: 0,
  walkZ: 0,
}

function Compass({ heading }: { heading: number }) {
  const ticks = Array.from({ length: 24 }, (_, i) => i * 15)
  const cardinal = (deg: number) => ({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[deg] ?? '')
  return <div className="compass-dial" aria-label={`Heading ${Math.round(heading)} degrees`}>
    <div className="compass-rose" style={{ transform: `rotate(${-heading}deg)` }}>
      {ticks.map((deg) => <span key={deg} className={`compass-tick ${deg % 45 === 0 ? 'major' : ''}`} style={{ transform: `rotate(${deg}deg) translateY(-59px)` }}>{cardinal(deg) || (deg % 30 === 0 ? String(deg).padStart(3, '0') : '')}</span>)}
    </div>
    <i className="compass-pointer" />
    <b>{String(Math.round(heading) % 360).padStart(3, '0')}°</b>
  </div>
}

function Helm({ rudder, onChange }: { rudder: number; onChange: (value: number) => void }) {
  const drag = useRef<number | null>(null)
  const update = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (drag.current === null) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const centerX = bounds.left + bounds.width / 2
    const centerY = bounds.top + bounds.height / 2
    const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180 / Math.PI + 90
    onChange(Math.max(-35, Math.min(35, angle)))
  }, [onChange])
  return <button className="helm" aria-label="Drag to steer the ship" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = event.pointerId; update(event) }} onPointerMove={update} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
    <span className="helm-rotor" style={{ transform: `rotate(${rudder * 2.3}deg)` }}>
      <i className="helm-spoke one" /><i className="helm-spoke two" /><i className="helm-spoke three" /><i className="helm-spoke four" />
      <b />
    </span>
    <span className="helm-caption">DRAG WHEEL TO STEER</span>
  </button>
}

export default function App() {
  const ship = useRef<ShipState>({ ...initialShip })
  const [view, setView] = useState({ ...initialShip })
  const [showHelp, setShowHelp] = useState(false)
  const [fleet, setFleet] = useState<FleetVessel[]>([])
  const [captainControls, setCaptainControls] = useState<CaptainControl[]>([])
  const [captainEvents, setCaptainEvents] = useState<CaptainEvent[]>([])
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null)
  const [simulationTime, setSimulationTime] = useState(0)
  const [engineInitialized, setEngineInitialized] = useState(false)
  const [engineRunning, setEngineRunning] = useState(false)
  const [clockProfiles, setClockProfiles] = useState<ClockProfile[]>([])
  const [clockProfileId, setClockProfileId] = useState('HOUR_PER_SECOND')
  const [connectionState, setConnectionState] = useState<'connecting' | 'live' | 'offline'>('connecting')
  const [incidentBusy, setIncidentBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showIncidents, setShowIncidents] = useState(false)
  const [showFleet, setShowFleet] = useState(true)
  const [fleetExpanded, setFleetExpanded] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('bridge')
  const [weather, setWeather] = useState<WeatherMode>('clear')
  const topbarDrag = useDraggable()
  const readoutsDrag = useDraggable()
  const rightStackDrag = useDraggable()
  const fleetPanelDrag = useDraggable()
  const bottomControlsDrag = useDraggable()
  const captionDrag = useDraggable()
  const mouseHintDrag = useDraggable()
  const helpPanelDrag = useDraggable()
  const incidentPanelDrag = useDraggable()
  const incidentLogDrag = useDraggable()
  const errorDrag = useDraggable()
  const togglePauseRef = useRef<() => void>(() => {})
  const selectedVessel = fleet.find(vessel => vessel.vesselId === selectedVesselId) ?? null
  const atRiskCount = selectedVessel?.assignedCargoes?.filter(cargo => cargo.deadline !== undefined
    && selectedVessel.expectedArrivalAt !== null && selectedVessel.expectedArrivalAt + 2 > cargo.deadline).length ?? 0
  const telemetry = {
    id: selectedVessel ? compactVesselId(selectedVessel.vesselId) : 'NO SHIP',
    status: selectedVessel?.status ?? 'AWAITING FLEET',
    heading: view.heading,
    speed: view.speed,
    throttle: view.throttle,
    destination: selectedVessel?.destinationName ?? 'No destination assigned',
    eta: selectedVessel?.expectedArrivalAt != null ? modeledTime(selectedVessel.expectedArrivalAt) : 'NO SCHEDULE',
    latitude: selectedVessel?.latitude ?? null,
    longitude: selectedVessel?.longitude ?? null,
    routeCoordinates: selectedVessel?.routeCoordinates ?? [],
    simulationTime,
  }
  const clockHour = (simulationTime + 6) % 24
  const dayLabel = clockHour >= 6 && clockHour < 18 ? 'DAY' : 'NIGHT'

  const refreshFleet = useCallback(async () => {
    try {
      const response = await fetch(`${API}/simulation/navigation`)
      if (!response.ok) throw new Error('Rycorn API is unavailable')
      const data = await response.json()
      setFleet(data.vessels ?? [])
      setCaptainControls(data.controls ?? [])
      setCaptainEvents((data.incidents ?? []).slice(-100))
      setSimulationTime(data.simulationTime ?? 0)
      setEngineInitialized(!!data.engineInitialized)
      setEngineRunning(!!data.engineRunning)
      setConnectionState('live')
      setErrorMessage('')
      setSelectedVesselId(current => current && data.vessels?.some((vessel: FleetVessel) => vessel.vesselId === current)
        ? current
        : data.vessels?.[0]?.vesselId ?? null)
    } catch (error) {
      setConnectionState('offline')
      setErrorMessage(error instanceof Error ? error.message : 'Unable to connect to Rycorn')
    }
  }, [])

  useEffect(() => {
    void refreshFleet()
    const interval = window.setInterval(() => { void refreshFleet() }, 4000)
    void fetch(`${API}/simulation/clock-profile`).then(response => response.json()).then(data => {
      setClockProfiles(data.profiles ?? [])
      setClockProfileId(data.active?.id ?? 'HOUR_PER_SECOND')
    }).catch(() => {})
    let reconnectTimer: number | undefined
    let disposed = false
    let socket: WebSocket
    const connect = () => {
      if (disposed) return
      socket = new WebSocket(WS)
      socket.onopen = () => setConnectionState('live')
      socket.onclose = () => {
        setConnectionState('offline')
        if (!disposed) reconnectTimer = window.setTimeout(connect, 1500)
      }
      socket.onerror = () => socket.close()
      socket.onmessage = message => {
        const data = JSON.parse(message.data)
        if (data.type === 'STATE_UPDATE') {
          setSimulationTime(data.simulationTime ?? 0)
          void refreshFleet()
        }
        if (data.type === 'CAPTAIN_EVENT') setCaptainEvents(current => [...current, data.event].slice(-100))
        if (data.type === 'ADMIN') {
          setEngineInitialized(!!data.payload?.engineInitialized)
          setEngineRunning(!!data.payload?.engineRunning)
        }
      }
    }
    connect()
    return () => {
      window.clearInterval(interval)
      disposed = true
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [refreshFleet])

  useEffect(() => {
    if (!selectedVessel) return
    const control = captainControls.find(item => item.vesselId === selectedVessel.vesselId) ?? { vesselId: selectedVessel.vesselId, rudder: 0, throttle: 60 }
    ship.current.heading = selectedVessel.bearing
    ship.current.rudder = control.rudder
    ship.current.throttle = control.throttle
    ship.current.speed = selectedVessel.status === 'SAILING' || selectedVessel.status === 'REPOSITIONING' ? 10 : 0
    const vesselUnderway = selectedVessel.status === 'SAILING' || selectedVessel.status === 'REPOSITIONING'
    ship.current.paused = !engineRunning || !vesselUnderway
    setView(current => ({ ...current, heading: selectedVessel.bearing, rudder: control.rudder, throttle: control.throttle, speed: ship.current.speed, paused: ship.current.paused }))
  }, [selectedVesselId])

  useEffect(() => {
    const vesselUnderway = selectedVessel?.status === 'SAILING' || selectedVessel?.status === 'REPOSITIONING'
    ship.current.paused = !engineRunning || !vesselUnderway
  }, [engineRunning, selectedVessel?.status])

  useEffect(() => {
    if (!selectedVessel) return
    ship.current.heading = selectedVessel.bearing
    setView(current => ({ ...current, heading: selectedVessel.bearing }))
  }, [selectedVessel?.bearing])

  useEffect(() => {
    if (!selectedVesselId || !engineInitialized) return
    const timeout = window.setTimeout(() => {
      void fetch(`${API}/simulation/captain-control`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vesselId: selectedVesselId, rudder: view.rudder, throttle: view.throttle }),
      }).then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'Helm command failed')
        setErrorMessage('')
        void refreshFleet()
      }).catch(error => setErrorMessage(error instanceof Error ? error.message : 'Helm command failed'))
    }, 550)
    return () => window.clearTimeout(timeout)
  }, [selectedVesselId, view.rudder, view.throttle, engineInitialized, refreshFleet])

  const setRudder = useCallback((value: number) => {
    const rudder = Math.round(value)
    ship.current.rudder = rudder
    setView(current => ({ ...current, rudder }))
  }, [])
  const setThrottle = (value: number) => { ship.current.throttle = value }
  const togglePause = async () => {
    if (!engineInitialized) return
    try {
      const response = await fetch(`${API}/simulation/${engineRunning ? 'pause' : 'run'}`, { method: 'POST' })
      if (!response.ok) throw new Error('Could not update the shared simulation clock')
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : 'Clock control failed') }
  }
  togglePauseRef.current = () => { void togglePause() }

  const chooseClock = async (profileId: string) => {
    setClockProfileId(profileId)
    await fetch(`${API}/simulation/clock-profile`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId }) }).catch(() => {})
  }

  const reportIncident = async (incident: string, delayHours: number) => {
    if (!selectedVesselId) return
    setIncidentBusy(true)
    try {
      const response = await fetch(`${API}/simulation/incident`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vesselId: selectedVesselId, incident, delayHours }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Incident could not be applied')
      setShowIncidents(false)
      setErrorMessage('')
      await refreshFleet()
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : 'Incident failed') }
    finally { setIncidentBusy(false) }
  }

  useEffect(() => {
    let previous = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const dt = Math.min(0.1, (now - previous) / 1000)
      previous = now
      const s = ship.current
      if (!s.paused) {
        const targetSpeed = s.throttle >= 0 ? s.throttle * 0.15 : s.throttle * 0.075
        const braking = s.throttle < 0 ? 2.8 : 0.42
        s.speed += Math.max(-braking * dt, Math.min(braking * dt, targetSpeed - s.speed))
        s.engine = Math.min(100, Math.abs(s.throttle) * 0.82 + Math.abs(s.speed) * 1.15)
        s.heading = (s.heading + s.rudder * Math.abs(s.speed) * 0.012 * dt + 360) % 360
        s.position += s.speed * 0.5144 * dt
        const distance = s.speed * 0.5144 * dt
        s.x += Math.sin(s.heading * Math.PI / 180) * distance
        s.z -= Math.cos(s.heading * Math.PI / 180) * distance
      }
      setView({ ...s })
    }, 100)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'INPUT' || target?.tagName === 'SELECT' || target?.isContentEditable) return
      if (event.code === 'Space') { event.preventDefault(); togglePauseRef.current(); return }
      if (event.code.startsWith('Arrow')) {
        event.preventDefault()
        if (event.code === 'ArrowUp') ship.current.walkZ = Math.max(-5, ship.current.walkZ - 0.45)
        if (event.code === 'ArrowDown') ship.current.walkZ = Math.min(5, ship.current.walkZ + 0.45)
        if (event.code === 'ArrowLeft') ship.current.walkX = Math.max(-7.5, ship.current.walkX - 0.45)
        if (event.code === 'ArrowRight') ship.current.walkX = Math.min(7.5, ship.current.walkX + 0.45)
      }
      if (event.key.toLowerCase() === 'w') ship.current.throttle = Math.min(100, ship.current.throttle + 6)
      if (event.key.toLowerCase() === 's') ship.current.throttle = Math.max(-40, ship.current.throttle - 8)
      if (event.key.toLowerCase() === 'a') ship.current.rudder = Math.max(-35, ship.current.rudder - 3)
      if (event.key.toLowerCase() === 'd') ship.current.rudder = Math.min(35, ship.current.rudder + 3)
      if (event.key === 'Escape') { ship.current.throttle = 0; ship.current.rudder = 0 }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [])

  const speedLabel = Math.abs(view.speed).toFixed(1)
  return <main className="simulator">
    <Canvas className="bridge-canvas" shadows camera={{ position: [0, 2.5, 0], fov: 72, near: 0.1, far: 1600 }} gl={{ antialias: true }}>
      <BridgeScene ship={ship} fleet={fleet as SceneVessel[]} selectedVesselId={selectedVesselId} viewMode={viewMode} telemetry={telemetry} weather={weather} />
    </Canvas>

    <header className="topbar glass" style={topbarDrag.style}>
      <div className="drag-handle topbar-drag-grip" onPointerDown={topbarDrag.onPointerDown} title="Drag to move this panel" />
      <div className="brand-mark"><span>R</span></div>
      <div className="brand-copy"><b>RYCORN <i>·</i> SHIP SIMULATOR</b><small>CAPTAIN'S BRIDGE · OPEN SEA</small></div>
      <label className="camera-pov"><span>CAMERA</span><select aria-label="Camera point of view" value={viewMode} onChange={event => setViewMode(event.target.value as ViewMode)}><option value="bridge">Bridge</option><option value="chase">Chase</option><option value="bow">Bow</option><option value="high">High view</option><option value="port">Port side</option><option value="starboard">Starboard</option><option value="fleet">Fleet</option></select></label>
      <label className="weather-pov"><span>SEA</span><select aria-label="Sea conditions" value={weather} onChange={event => setWeather(event.target.value as WeatherMode)}><option value="clear">Clear</option><option value="rain">Rain</option><option value="storm">Storm</option></select></label>
      <div className="top-port"><span className={`status-dot ${connectionState !== 'live' ? 'offline' : ''}`} />{selectedVessel?.locationName ?? 'RYCORN FLEET'} · {connectionState.toUpperCase()}</div>
      <div className="clock-box"><small>SHARED RYCORN TIME · <i className={`day-indicator ${dayLabel.toLowerCase()}`}>{dayLabel}</i></small><b>{modeledTime(simulationTime)}</b><select aria-label="Shared simulation clock profile" value={clockProfileId} onChange={(e) => { void chooseClock(e.target.value) }}>{clockProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select></div>
      <button className={`pause-button ${!engineRunning ? 'is-paused' : ''}`} onClick={() => { void togglePause() }} disabled={!engineInitialized}>{engineRunning ? 'Ⅱ PAUSE FLEET' : '▶ RESUME FLEET'}</button>
      <a className="help-button rycorn-link" href={`${window.location.protocol}//${window.location.hostname}:${CLIENT_PORT}`} title="Open Rycorn fleet map">↗</a>
      <button className="help-button" onClick={() => setShowHelp(!showHelp)} aria-label="Show controls">?</button>
    </header>

    <section className="fleet-panel glass" style={fleetPanelDrag.style}>
      <div className="panel-label drag-handle" onPointerDown={fleetPanelDrag.onPointerDown}><span>FLEET · {fleet.length}</span><div className="fleet-panel-actions"><button onClick={() => setFleetExpanded(value => !value)}>{fleetExpanded ? 'COMPACT' : 'EXPAND'}</button><button onClick={() => setShowFleet(value => !value)}>{showFleet ? 'HIDE' : 'SHOW'}</button></div></div>
      {showFleet && <div className="fleet-legend"><span><i className="legend-moving"/> MOVING</span><span><i className="legend-working"/> LOADING</span><span><i className="legend-stopped"/> STOPPED</span></div>}
      {!engineInitialized && <div className="fleet-empty">Initialize a voyage from the Rycorn map or a port console to take command.</div>}
      {showFleet && <div className={`fleet-list ${fleetExpanded ? 'fleet-list-expanded' : 'fleet-list-compact'}`}>{fleet.map(vessel => <button title={`${vessel.vesselId} · ${vessel.status} · ${vessel.vesselType}`} aria-label={`${vessel.vesselId}, ${vessel.status}, ${vessel.vesselType}`} key={vessel.vesselId} className={`fleet-row ${statusTone(vessel.status)} ${selectedVesselId === vessel.vesselId ? 'is-selected' : ''}`} onClick={() => { setSelectedVesselId(vessel.vesselId); setViewMode('bridge') }}>
        {!fleetExpanded ? <span className="fleet-compact-id">{compactVesselId(vessel.vesselId)}</span> : <><span className="fleet-row-top"><b>{compactVesselId(vessel.vesselId)}</b><i className={`fleet-state state-${statusTone(vessel.status)}`}>{vessel.status.replace('_', ' ')}</i></span>
        <span className="fleet-row-type">{vessel.vesselType} · {vessel.capability}</span>
        <span className="fleet-row-location">{vessel.locationName}</span>
        <span className="fleet-row-foot"><span>{vessel.latitude.toFixed(2)}°, {vessel.longitude.toFixed(2)}°</span><b>{String(Math.round(vessel.bearing)).padStart(3, '0')}° BRG</b></span></>}
      </button>)}{fleet.length === 0 && <div className="fleet-empty">No vessels in the DS fleet register yet.</div>}</div>}
    </section>

    <section className="readouts glass" style={readoutsDrag.style} onPointerDown={readoutsDrag.onPointerDown}>
      <div className="readout"><small>SPEED OVER WATER</small><b>{speedLabel}<em> kn</em></b><div className="readout-line"><i style={{ width: `${Math.min(100, Math.abs(view.speed) / 15 * 100)}%` }} /></div></div>
      <div className="readout"><small>ENGINE LOAD</small><b>{Math.round(view.engine)}<em> %</em></b><div className="readout-line"><i style={{ width: `${view.engine}%` }} /></div></div>
      <div className="readout"><small>RUDDER</small><b>{view.rudder > 0 ? 'R ' : view.rudder < 0 ? 'L ' : ''}{Math.abs(view.rudder)}<em>°</em></b><div className="rudder-scale"><i style={{ left: `${50 + view.rudder / 70 * 50}%` }} /></div></div>
      <div className="readout"><small>ARRIVAL · DS DEADLINES</small><b className="status-value">{selectedVessel?.expectedArrivalAt !== null && selectedVessel?.expectedArrivalAt !== undefined ? modeledTime(selectedVessel.expectedArrivalAt) : 'NO SCHEDULE'}</b><div className={`depth-status ${atRiskCount ? 'is-risk' : ''}`}><span />{atRiskCount ? `${atRiskCount} CARGO DEADLINE${atRiskCount === 1 ? '' : 'S'} AT RISK` : selectedVessel?.status ?? 'SELECT A VESSEL'}</div></div>
    </section>

    <section className="right-stack" style={rightStackDrag.style}>
      <div className="compass-card glass"><div className="panel-label drag-handle" onPointerDown={rightStackDrag.onPointerDown}>GYRO COMPASS <span>HDG</span></div><Compass heading={view.heading} /><div className="compass-foot"><span>COURSE</span><b>{String(Math.round(view.heading)).padStart(3, '0')}°</b></div></div>
      <div className="radar-card glass"><div className="panel-label">HARBOR RADAR <span className="radar-live">● LIVE</span></div><div className="radar"><i className="radar-sweep" /><i className="radar-ring ring-one" /><i className="radar-ring ring-two" /><i className="radar-ring ring-three" /><b className="radar-own" /><i className="blip b-one" /><i className="blip b-two" /><i className="blip b-three" /></div><div className="radar-foot"><span>RANGE 2.0 NM</span><span>RELATIVE MOTION</span></div></div>
    </section>

    <div className="bridge-caption" style={captionDrag.style} onPointerDown={captionDrag.onPointerDown}><span className="status-dot" />CAPTAIN'S BRIDGE <i>·</i> {selectedVessel ? compactVesselId(selectedVessel.vesselId) : 'NO VESSEL SELECTED'} <i>·</i> {selectedVessel ? `${selectedVessel.latitude.toFixed(3)}, ${selectedVessel.longitude.toFixed(3)}` : 'AWAITING RYCORN'}</div>
    <div className="bottom-controls glass" style={bottomControlsDrag.style}>
      <div className="helm-wrap"><Helm rudder={view.rudder} onChange={setRudder} /><div className="helm-side"><small>STEERING · A / D OR WHEEL</small><strong>{Math.abs(view.rudder)}° <span>{view.rudder < 0 ? 'PORT' : view.rudder > 0 ? 'STARBOARD' : 'MIDSHIPS'}</span></strong><div className="helm-direction"><button onClick={() => setRudder(Math.max(-35, view.rudder - 5))}>◀ PORT</button><button onClick={() => setRudder(Math.min(35, view.rudder + 5))}>STBD ▶</button></div><button onClick={() => setRudder(0)}>CENTER RUDDER</button></div></div>
      <div className="control-divider" />
      <div className="throttle-wrap"><div className="control-heading drag-handle" onPointerDown={bottomControlsDrag.onPointerDown}><div><small>ENGINE TELEGRAPH</small><b>MAIN PROPULSION</b></div><strong>{view.throttle > 0 ? 'AHEAD' : view.throttle < 0 ? 'ASTERN' : 'STOP'}</strong></div><div className="throttle-markers"><span>ASTERN</span><span>STOP</span><span>AHEAD</span></div><input aria-label="Engine throttle" type="range" min="-40" max="100" value={view.throttle} onChange={(e) => setThrottle(Number(e.target.value))} /><div className="throttle-presets"><button onClick={() => setThrottle(-25)}>SLOW ASTERN</button><button onClick={() => setThrottle(0)}>STOP</button><button onClick={() => setThrottle(25)}>SLOW AHEAD</button><button onClick={() => setThrottle(65)}>HALF AHEAD</button></div></div>
      <div className="control-divider" />
      <div className="ship-controls"><button onClick={() => { ship.current.throttle = 0; setThrottle(0) }}><span>▣</span><small>ENGINE STOP</small></button><button onClick={() => setShowIncidents(value => !value)} disabled={!selectedVessel || (selectedVessel.status !== 'SAILING' && selectedVessel.status !== 'REPOSITIONING')}><span>⚠</span><small>INCIDENT DRILL</small></button></div>
    </div>

    {showHelp && <aside className="help-panel glass" style={helpPanelDrag.style}><div className="panel-label drag-handle" onPointerDown={helpPanelDrag.onPointerDown}>BRIDGE CONTROLS <button onClick={() => setShowHelp(false)}>×</button></div><div className="help-row"><b>ARROWS</b><span>Walk around the bridge</span></div><div className="help-row"><b>W / S</b><span>Set ahead / astern throttle</span></div><div className="help-row"><b>A / D</b><span>Adjust rudder</span></div><div className="help-row"><b>DRAG VIEW</b><span>Look around the wheelhouse</span></div><div className="help-row"><b>SPACE</b><span>Pause / resume fleet</span></div><div className="help-row"><b>ESC</b><span>Center helm and stop engine</span></div></aside>}
    {showIncidents && <aside className="incident-panel glass" style={incidentPanelDrag.style}><div className="panel-label drag-handle" onPointerDown={incidentPanelDrag.onPointerDown}>MARITIME INCIDENT DRILL <button onClick={() => setShowIncidents(false)}>×</button></div><p>Apply a disruption to {selectedVessel ? compactVesselId(selectedVessel.vesselId) : 'this vessel'}. Revised arrival flows into Rycon and DS.</p><button disabled={incidentBusy} onClick={() => void reportIncident('Severe weather hold', 6)}>SEVERE WEATHER <b>+6 H</b></button><button disabled={incidentBusy} onClick={() => void reportIncident('Engine fault · reduced speed', 8)}>ENGINE FAULT <b>+8 H</b></button><button disabled={incidentBusy} onClick={() => void reportIncident('Navigation diversion', 4)}>NAVIGATION DIVERSION <b>+4 H</b></button><button disabled={incidentBusy} onClick={() => { const incidents = [['Squall line · route avoidance', 3], ['Unplanned traffic separation hold', 5], ['Propulsion inspection', 7]] as const; const [name, hours] = incidents[Math.floor(Math.random() * incidents.length)]; void reportIncident(name, hours) }}>RANDOM INCIDENT <b>DRILL</b></button></aside>}
    {captainEvents.length > 0 && <aside className="incident-log glass" style={incidentLogDrag.style}><div className="panel-label drag-handle" onPointerDown={incidentLogDrag.onPointerDown}>RECENT BRIDGE EVENTS <span>{captainEvents.length}</span></div>{captainEvents.slice(-4).reverse().map(event => <div className="incident-entry" key={event.eventId}><b>{compactVesselId(event.entityId)}</b><span>{event.summary}</span><small>{event.eventType === 'MARITIME_INCIDENT' ? `ETA +${String(event.metadata.delayHours)} h` : 'HELM / PROPULSION'}</small></div>)}</aside>}
    {errorMessage && <div className="bridge-error glass" style={errorDrag.style} role="status" onPointerDown={errorDrag.onPointerDown}>{errorMessage}<button onClick={() => setErrorMessage('')}>×</button></div>}
    <div className="mouse-hint glass" style={mouseHintDrag.style} onPointerDown={mouseHintDrag.onPointerDown}>ARROWS WALK <span>·</span> DRAG HELM OR A / D STEER <span>·</span> W / S THROTTLE <span>·</span> SPACE PAUSE</div>
  </main>
}

function useDraggable() {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button, input, select, a')) return
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const initial = offset
    const rect = event.currentTarget.closest('.glass')?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect()
    const move = (pointer: PointerEvent) => {
      const minX = initial.x + 18 - rect.left
      const maxX = initial.x + window.innerWidth - 42 - rect.right
      const minY = initial.y + 18 - rect.top
      const maxY = initial.y + window.innerHeight - 42 - rect.bottom
      setOffset({
        x: Math.max(Math.min(minX, maxX), Math.min(Math.max(minX, maxX), initial.x + pointer.clientX - startX)),
        y: Math.max(Math.min(minY, maxY), Math.min(Math.max(minY, maxY), initial.y + pointer.clientY - startY)),
      })
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
  }, [offset])
  return { style: { translate: `${offset.x}px ${offset.y}px` }, onPointerDown }
}
