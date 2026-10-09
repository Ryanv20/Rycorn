import { Activity, Anchor, ChevronLeft, ChevronRight, CircleDot, Clock3, Compass, GitFork, Map as MapIcon, Navigation, Package, Ship, Shield, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import EventLog from './EventLog';
import Clock from './Clock';

interface VesselRecord {
  vesselId: string;
  vesselCapability: string | number;
  status: string;
  currentNodeId: string;
}

interface CargoRecord {
  cargoId: string;
  status: string;
  quantity: number;
}

interface EventRecord {
  eventId: string;
  eventType: string;
  simulationTime: number;
  entityId: string;
  locationNodeId: string;
}
interface PortRecord { portId: string; name: string; country: string; }

interface OperationsRailProps {
  vessels: VesselRecord[];
  cargoes: CargoRecord[];
  events: EventRecord[];
  ports: PortRecord[];
  errors: Array<{ message: string; timestamp: number }>;
  selectedVesselId: string | null;
  onSelectVessel: (vesselId: string) => void;
  simulationTime: number;
  timeMetadata: { observedAtUtc: string; observedAtSource: string } | null;
  running: boolean;
  clockProfileId?: string;
  routesMode: boolean;
  routeCount: number;
  regionCount: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  clockVisible: boolean;
  onToggleClock: () => void;
  currentView: 'map' | 'routes' | 'fleet' | 'shipments' | 'activity';
  onSelectView: (view: 'map' | 'routes' | 'fleet' | 'shipments' | 'activity') => void;
  onOpenTool: (page: '/next-stop' | '/clock' | '/special-class' | '/ds-graph') => void;
  onOpenDs: () => void;
  hideRecentActivity?: boolean;
}

export default function OperationsRail({ vessels, cargoes, events, ports, errors, selectedVesselId, onSelectVessel, simulationTime, timeMetadata, running, clockProfileId, routesMode, routeCount, regionCount, collapsed, onToggleCollapsed, clockVisible, onToggleClock, currentView, onSelectView, onOpenTool, onOpenDs, hideRecentActivity = false }: OperationsRailProps) {
  const [vesselScrollTop, setVesselScrollTop] = useState(0);
  const selectedVessel = vessels.find(vessel => vessel.vesselId === selectedVesselId);
  const sailingCount = vessels.filter(vessel => vessel.status === 'SAILING' || vessel.status === 'REPOSITIONING').length;
  const activeCargoCount = cargoes.filter(cargo => cargo.status !== 'DELIVERED' && cargo.status !== 'CANCELLED').length;
  const rowHeight = 37;
  const firstVessel = Math.max(0, Math.floor(vesselScrollTop / rowHeight));
  const visibleVessels = vessels.slice(firstVessel, firstVessel + 9);
  const nodeDisplay = (nodeId: string) => {
    const portId = nodeId.startsWith('node-') ? nodeId.slice(5) : nodeId;
    const port = ports.find(item => item.portId === portId);
    return port ? `${port.name}, ${port.country}` : nodeId;
  };

  return (
    <aside className={`operations-rail ${collapsed ? 'is-collapsed' : ''}`}>
      <header className="rail-heading">
        {!collapsed && <><div><p className="eyebrow">{routesMode ? 'NETWORK INTELLIGENCE' : 'LIVE OPERATIONS'}</p><h2>{routesMode ? 'Route overview' : 'Fleet overview'}</h2></div><span className="live-indicator"><i /> Live</span></>}
        <div className="rail-heading-tools">
          {!collapsed && <button className={`rail-tool-button ${clockVisible ? 'is-active' : ''}`} onClick={onToggleClock} title={clockVisible ? 'Hide clock panel' : 'Show clock panel'} aria-label={clockVisible ? 'Hide clock panel' : 'Show clock panel'} aria-pressed={clockVisible}><Clock3 size={15} /><span>Clock</span></button>}
          <button className="rail-tool-button rail-collapse-button" onClick={onToggleCollapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
        </div>
      </header>
      {!collapsed && <>
      <nav className="rail-navigation" aria-label="Views and tools">
        <p className="eyebrow">VIEWS</p>
        {[
          { id: 'map' as const, label: 'Fleet map', icon: MapIcon },
          { id: 'routes' as const, label: 'Route atlas', icon: Navigation },
          { id: 'fleet' as const, label: 'Fleet register', icon: Ship },
          { id: 'shipments' as const, label: 'Shipments', icon: Package },
          { id: 'activity' as const, label: 'Activity', icon: Activity },
        ].map(item => <button key={item.id} className={currentView === item.id ? 'is-active' : ''} onClick={() => onSelectView(item.id)}>{<item.icon size={15} />}<span>{item.label}</span></button>)}
        <p className="eyebrow rail-tools-label">PLANNING TOOLS</p>
        <button onClick={() => onOpenTool('/next-stop')}><Compass size={15} /><span>Scenario planner</span></button>
        <button onClick={() => onOpenDs()}><Anchor size={15} /><span>Demand &amp; supply</span></button>
        <button onClick={() => onOpenTool('/ds-graph')}><GitFork size={15} /><span>DS flow graph</span></button>
        <button onClick={() => onOpenTool('/special-class')}><Shield size={15} /><span>Special fleet</span></button>
      </nav>
      {clockVisible && <Clock simulationTime={simulationTime} timeMetadata={timeMetadata} running={running} profileId={clockProfileId} />}
      {routesMode && <div className="route-rail-metrics"><div><span>TRADE LANES</span><strong>{routeCount.toString().padStart(2, '0')}</strong></div><div><span>CONNECTED REGIONS</span><strong>{regionCount.toString().padStart(2, '0')}</strong></div><small>Modeled sea corridors · select a vessel to inspect its active passage</small></div>}
      <div className="rail-metrics">
        <div><span>Vessels</span><strong>{vessels.length.toString().padStart(2, '0')}</strong></div>
        <div><span>Underway</span><strong>{sailingCount.toString().padStart(2, '0')}</strong></div>
        <div><span>Open cargo</span><strong>{activeCargoCount.toString().padStart(2, '0')}</strong></div>
      </div>

      {selectedVessel && <section className="selected-vessel">
        <div className="section-label"><Ship size={15} /><span>Selected vessel</span></div>
        <div className="selected-vessel-name">{selectedVessel.vesselId}</div>
        <div className="detail-line"><span>Status</span><strong className={`status-text status-${selectedVessel.status.toLowerCase()}`}>{selectedVessel.status}</strong></div>
        <div className="detail-line"><span>Class</span><strong>{selectedVessel.vesselCapability}</strong></div>
        <div className="detail-line"><span>At</span><strong title={selectedVessel.currentNodeId}>{nodeDisplay(selectedVessel.currentNodeId)}<small className="node-code">{selectedVessel.currentNodeId}</small></strong></div>
      </section>}

      <section className="rail-section fleet-section">
        <div className="section-heading"><h3>Vessels</h3><span>{vessels.length}</span></div>
        {vessels.length === 0
          ? <div className="rail-empty"><Anchor size={17} /><span>Initialize the simulation to load the DS fleet.</span></div>
          : <div className="vessel-list vessel-list-virtual" onScroll={event => setVesselScrollTop(event.currentTarget.scrollTop)}>
            <div aria-hidden="true" style={{ height: vessels.length * rowHeight }} />
            {visibleVessels.map((vessel, index) => <button
              key={vessel.vesselId}
              className={`vessel-row ${selectedVesselId === vessel.vesselId ? 'is-selected' : ''}`}
              style={{ position: 'absolute', top: (firstVessel + index) * rowHeight, left: 0, height: rowHeight - 3 }}
              onClick={() => onSelectVessel(vessel.vesselId)}
            >
              <span className={`vessel-status-dot status-${vessel.status.toLowerCase()}`} />
              <span className="vessel-row-copy"><strong>{vessel.vesselId}</strong><small title={vessel.currentNodeId}>{nodeDisplay(vessel.currentNodeId)}</small></span>
              <span className="vessel-row-status">{vessel.status.replace('_', ' ')}</span>
            </button>)}
          </div>}
      </section>

      <section className="rail-section cargo-summary">
        <div className="section-heading"><h3><Package size={14} /> Cargo</h3><span>{cargoes.length}</span></div>
        <div className="cargo-summary-line"><CircleDot size={13} /><span>Active shipments</span><strong>{activeCargoCount}</strong></div>
        <div className="cargo-summary-line"><CircleDot size={13} /><span>Delivered</span><strong>{cargoes.filter(cargo => cargo.status === 'DELIVERED').length}</strong></div>
      </section>

      <section className="rail-health">
        <div className="section-heading"><h3><TriangleAlert size={14} /> System health</h3><span className={errors.length ? 'health-warning' : 'health-ok'}>{errors.length ? `${errors.length} alerts` : 'Normal'}</span></div>
        {errors.length ? errors.slice(-2).reverse().map((error, index) => <p key={`${error.timestamp}-${index}`}>{error.message}</p>) : <p>No active simulation errors.</p>}
      </section>

      {!hideRecentActivity && <EventLog events={events} compact />}
      </>}
    </aside>
  );
}
