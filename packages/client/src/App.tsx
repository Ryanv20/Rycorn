import { useEffect, useState } from 'react';
import { Activity, Anchor, CalendarClock, ClipboardList, Compass, FileText, Map as MapIcon, Navigation, Package, Radio, Search, Shield, Ship, X } from 'lucide-react';
import Map from './components/Map';
import SimulationControls from './components/SimulationControls';
import EventLog from './components/EventLog';
import Clock from './components/Clock';
import DSSystemPage from './components/DSSystemPage';
import OperationalReport from './components/OperationalReport';
import OperationsRail from './components/OperationsRail';
import NextStopPage from './components/NextStopPage';
import ClockPage from './components/ClockPage';
import SpecialClassPage from './components/SpecialClassPage';
import type { SpecialVesselRecord } from './components/SpecialVesselMarker';

type ViewMode = 'map' | 'routes' | 'fleet' | 'shipments' | 'activity';

interface VesselRecord {
  vesselId: string;
  vesselCapability: string | number;
  status: string;
  currentNodeId: string;
  assignedCargoIds?: string[];
  currentRoute?: { path: string[]; totalDistanceKm: number };
}

interface CargoRecord {
  cargoId: string;
  originNodeId: string;
  destinationNodeId: string;
  status: string;
  quantity: number;
  assignedVesselId?: string;
  cargoType?: string;
}

interface EventRecord {
  eventId: string;
  eventType: string;
  simulationTime: number;
  entityId: string;
  locationNodeId: string;
}

interface AppState {
  vessels: VesselRecord[];
  cargoes: CargoRecord[];
  events: EventRecord[];
  simulationTime: number;
  timeMetadata: { observedAtUtc: string; observedAtSource: string } | null;
  connected: boolean;
  systemStatus: { engineInitialized: boolean; engineRunning: boolean; totalEventsProcessed: number; clockProfileId?: string } | null;
  errors: Array<{ message: string; timestamp: number }>;
  startedAt: number | null;
}

const views: Array<{ id: ViewMode; label: string; icon: typeof MapIcon }> = [
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'routes', label: 'Routes', icon: Navigation },
  { id: 'fleet', label: 'Fleet', icon: Ship },
  { id: 'shipments', label: 'Shipments', icon: Package },
  { id: 'activity', label: 'Activity', icon: Activity },
];

function ViewNavigation({ view, onChange }: { view: ViewMode; onChange: (next: ViewMode) => void }) {
  return <nav className="view-navigation" aria-label="Workspace views">
    {views.map(item => {
      const Icon = item.icon;
      return <button key={item.id} className={view === item.id ? 'is-active' : ''} aria-current={view === item.id ? 'page' : undefined} onClick={() => onChange(item.id)}>
        <Icon size={16} strokeWidth={1.8} /><span>{item.label}</span>
      </button>;
    })}
  </nav>;
}

function DataTable({ view, vessels, cargoes, events, query, onSelectVessel }: {
  view: Exclude<ViewMode, 'map' | 'routes'>;
  vessels: VesselRecord[];
  cargoes: CargoRecord[];
  events: EventRecord[];
  query: string;
  onSelectVessel: (vesselId: string) => void;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  if (view === 'activity') return <div className="data-view"><EventLog events={events} /></div>;
  if (view === 'fleet') {
    const rows = vessels.filter(vessel => `${vessel.vesselId} ${vessel.currentNodeId} ${vessel.status}`.toLowerCase().includes(normalizedQuery));
    return <section className="data-view">
      <header className="data-view-heading"><div><p className="eyebrow">FLEET REGISTER</p><h1>Vessels</h1><p>Operational position and assignment state</p></div><span>{rows.length} vessels</span></header>
      <div className="table-scroll"><table className="operations-table"><thead><tr><th>Vessel</th><th>Class</th><th>Status</th><th>Current node</th><th>Assigned cargo</th></tr></thead><tbody>
        {rows.map(vessel => <tr key={vessel.vesselId} tabIndex={0} onClick={() => onSelectVessel(vessel.vesselId)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') onSelectVessel(vessel.vesselId); }}>
          <td><span className="table-vessel"><Ship size={16} />{vessel.vesselId}</span></td><td>{vessel.vesselCapability}</td><td><span className={`table-status status-${vessel.status.toLowerCase()}`}>{vessel.status.replace('_', ' ')}</span></td><td className="mono">{vessel.currentNodeId}</td><td>{vessel.assignedCargoIds?.join(', ') || '—'}</td>
        </tr>)}
      </tbody></table>{rows.length === 0 && <p className="table-empty">No vessels match this view.</p>}</div>
    </section>;
  }

  const rows = cargoes.filter(cargo => `${cargo.cargoId} ${cargo.originNodeId} ${cargo.destinationNodeId} ${cargo.status}`.toLowerCase().includes(normalizedQuery));
  return <section className="data-view">
    <header className="data-view-heading"><div><p className="eyebrow">CARGO REGISTER</p><h1>Shipments</h1><p>Movement requests and current execution state</p></div><span>{rows.length} shipments</span></header>
    <div className="table-scroll"><table className="operations-table"><thead><tr><th>Request</th><th>Origin</th><th>Destination</th><th>Quantity</th><th>Vessel</th><th>Status</th></tr></thead><tbody>
      {rows.map(cargo => <tr key={cargo.cargoId}><td><span className="table-vessel"><Package size={15} />{cargo.cargoId}</span></td><td className="mono">{cargo.originNodeId}</td><td className="mono">{cargo.destinationNodeId}</td><td>{cargo.quantity.toLocaleString()}</td><td>{cargo.assignedVesselId ?? 'Unassigned'}</td><td><span className={`table-status status-${cargo.status.toLowerCase()}`}>{cargo.status.replace('_', ' ')}</span></td></tr>)}
    </tbody></table>{rows.length === 0 && <p className="table-empty">No shipments match this view.</p>}</div>
  </section>;
}

export default function App() {
  const [page, setPage] = useState(() => window.location.pathname.toLowerCase());
  const [view, setView] = useState<ViewMode>('map');
  const [query, setQuery] = useState('');
  const [state, setState] = useState<AppState>({
    vessels: [], cargoes: [], events: [], simulationTime: 0, timeMetadata: null, connected: false, systemStatus: null, errors: [], startedAt: null,
  });
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [showPorts, setShowPorts] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showSpecial, setShowSpecial] = useState(true);
  const [cameraFollow, setCameraFollow] = useState(false);
  const [plannedRoutes, setPlannedRoutes] = useState<Array<{ requestId: string; coordinates: [number, number][]; distanceKm: number }>>([]);
  const [specialVessels, setSpecialVessels] = useState<SpecialVesselRecord[]>([]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleVessels = state.vessels.filter(vessel => !normalizedQuery || `${vessel.vesselId} ${vessel.currentNodeId} ${vessel.status}`.toLowerCase().includes(normalizedQuery));

  const resetSimulation = () => setState(current => ({ ...current, vessels: [], cargoes: [], events: [], simulationTime: 0, timeMetadata: null, errors: [] }));
  const openDsSystem = () => { window.history.pushState({}, '', '/DS_system'); setPage('/ds_system'); };
  const openSimulation = () => { window.history.pushState({}, '', '/'); setPage('/'); };
  const openPage = (nextPage: '/next-stop' | '/clock' | '/special-class') => { window.history.pushState({}, '', nextPage); setPage(nextPage); };

  const refreshTopology = async () => {
    try {
      const [routeResponse, specialResponse] = await Promise.all([
        fetch('http://127.0.0.1:3000/network/routes'),
        fetch('http://127.0.0.1:3000/network/special-vessels'),
      ]);
      if (routeResponse.ok) setPlannedRoutes(await routeResponse.json());
      if (specialResponse.ok) setSpecialVessels(await specialResponse.json());
    } catch {
      setPlannedRoutes([]);
    }
  };

  useEffect(() => {
    if (page === '/ds_system' || page === '/next-stop' || page === '/clock' || page === '/special-class') return;
    const ws = new WebSocket('ws://127.0.0.1:3000/ws');
    ws.onopen = () => setState(current => ({ ...current, connected: true }));
    ws.onclose = () => setState(current => ({ ...current, connected: false }));
    ws.onmessage = message => {
      const data = JSON.parse(message.data);
      if (data.type === 'SIMULATION_EVENT') setState(current => ({ ...current, events: [...current.events, data.event] }));
      if (data.type === 'STATE_UPDATE') setState(current => ({
        ...current,
        vessels: data.vessels,
        cargoes: data.cargoes,
        simulationTime: data.simulationTime,
        timeMetadata: data.timeMetadata,
      }));
      if (data.type === 'ADMIN') setState(current => ({ ...current, systemStatus: data.payload, startedAt: data.payload.startedAt }));
      if (data.type === 'ERROR_LOG') setState(current => ({ ...current, errors: data.errors ?? [] }));
    };
    return () => ws.close();
  }, [page]);

  useEffect(() => {
    void refreshTopology();
  }, [state.systemStatus?.engineInitialized]);

  if (page === '/ds_system') return <DSSystemPage onBack={openSimulation} />;
  if (page === '/next-stop') return <NextStopPage onBack={openSimulation} />;
  if (page === '/clock') return <ClockPage onBack={openSimulation} simulationTimeHours={state.simulationTime} timeMetadata={state.timeMetadata} startedAt={state.startedAt} running={!!state.systemStatus?.engineRunning} activeProfileId={state.systemStatus?.clockProfileId} />;
  if (page === '/special-class') return <SpecialClassPage onBack={openSimulation} />;

  return <div className="rycon-app">
    <header className="app-topbar">
      <button className="brand-lockup" onClick={() => setView('map')} aria-label="Rycon map home">
        <span className="brand-mark"><Anchor size={19} strokeWidth={1.8} /></span>
        <span className="brand-copy"><strong>RYCORN</strong><small>MARITIME OPERATIONS</small></span>
      </button>
      <ViewNavigation view={view} onChange={setView} />
      <div className="topbar-status"><span className={`connection-led ${state.connected ? 'is-connected' : ''}`} /><span>{state.connected ? 'LIVE LINK' : 'OFFLINE'}</span></div>
      <div className="topbar-actions">
        <button className="header-action" onClick={openDsSystem} aria-label="Open DS System" title="DS System"><ClipboardList size={16} /><span>DS SYSTEM</span></button>
        <button className="header-action" onClick={() => openPage('/next-stop')} aria-label="Open Next Stop scenario planner" title="Next Stop"><Compass size={16} /><span>NEXT STOP</span></button>
        <button className="header-action" onClick={() => openPage('/clock')} aria-label="Open clock details" title="Clock details"><CalendarClock size={16} /><span>CLOCK</span></button>
        <button className="header-action" onClick={() => openPage('/special-class')} aria-label="Open special-class fleet" title="Special-class units"><Shield size={16} /><span>SPECIAL</span></button>
        <button className="header-action header-action-report" onClick={() => setReportOpen(true)} aria-label="Open operational report" title="Operational report"><FileText size={16} /><span>REPORT</span></button>
      </div>
    </header>

    <section className="simulation-strip" aria-label="Simulation controls">
      <SimulationControls onReset={resetSimulation} onInitialized={() => void refreshTopology()} initialized={!!state.systemStatus?.engineInitialized} running={!!state.systemStatus?.engineRunning} />
      <Clock simulationTime={state.simulationTime} timeMetadata={state.timeMetadata} />
      <div className="strip-events"><Radio size={14} /><span>{state.systemStatus?.totalEventsProcessed ?? 0} EVENTS</span></div>
    </section>

    <main className={`workspace workspace-${view}`}>
      {view === 'map' || view === 'routes' ? <>
        <section className={`map-stage ${view === 'routes' ? 'map-stage-routes' : ''}`} aria-label={view === 'routes' ? 'Planned sea routes' : 'Fleet map'}>
          <Map vessels={visibleVessels} plannedRoutes={plannedRoutes} specialVessels={specialVessels} showPorts={showPorts} showRoutes={showRoutes} showSpecial={showSpecial} routesOnly={view === 'routes'} cameraFollow={cameraFollow} selectedVesselId={selectedVesselId} onSelectVessel={setSelectedVesselId} />
          <div className="map-title-overlay"><span className="map-live-pip" /><div><strong>{view === 'routes' ? 'Route atlas' : 'Fleet tracking'}</strong><small>{view === 'routes' ? `${plannedRoutes.length} planned scenario corridors` : `${state.vessels.length} transport vessels · ${plannedRoutes.length} planned routes`}</small></div></div>
          <label className="map-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search vessel, node, status" aria-label="Search vessels" />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}<kbd>/</kbd></label>
          {view === 'map' && <div className="map-layer-tools" aria-label="Map layers">
            <button className={showPorts ? 'is-active' : ''} onClick={() => setShowPorts(value => !value)} title="Toggle ports" aria-pressed={showPorts}><Anchor size={16} /><span>Ports</span></button>
            <button className={showRoutes ? 'is-active' : ''} onClick={() => setShowRoutes(value => !value)} title="Toggle routes" aria-pressed={showRoutes}><Radio size={16} /><span>Routes</span></button>
            <button className={showSpecial ? 'is-active' : ''} onClick={() => setShowSpecial(value => !value)} title="Toggle special-class patrol fixtures" aria-pressed={showSpecial}><Shield size={16} /><span>Special</span></button>
            {selectedVesselId && <button className={cameraFollow ? 'is-active' : ''} onClick={() => setCameraFollow(value => !value)} title="Follow selected vessel" aria-pressed={cameraFollow}><Navigation size={16} /><span>Follow</span></button>}
          </div>}
        </section>
        {view === 'map' && <OperationsRail vessels={state.vessels} cargoes={state.cargoes} events={state.events} errors={state.errors} selectedVesselId={selectedVesselId} onSelectVessel={setSelectedVesselId} />}
      </> : <>
        <div className="data-toolbar">
          <label className="data-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${view}`} aria-label={`Search ${view}`} />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}</label>
          <span className="data-connection"><span className={`connection-led ${state.connected ? 'is-connected' : ''}`} />{state.connected ? 'Live data' : 'Waiting for server'}</span>
        </div>
        {view === 'activity'
          ? <div className="activity-view"><header className="data-view-heading"><div><p className="eyebrow">EVENT STREAM</p><h1>Activity</h1><p>Chronological simulation history</p></div><span>{state.events.length} events</span></header>{state.errors.map((error, index) => <div className="activity-error" key={`${error.timestamp}-${index}`}><strong>Simulation error</strong><span>{error.message}</span><time>{new Date(error.timestamp).toLocaleTimeString()}</time></div>)}<EventLog events={state.events} /></div>
          : <DataTable view={view} vessels={state.vessels} cargoes={state.cargoes} events={state.events} query={query} onSelectVessel={vesselId => { setSelectedVesselId(vesselId); setView('map'); }} />}
      </>}
    </main>

    <nav className="mobile-view-navigation" aria-label="Workspace views"><ViewNavigation view={view} onChange={setView} /></nav>
    {reportOpen && <OperationalReport onClose={() => setReportOpen(false)} />}
  </div>;
}
