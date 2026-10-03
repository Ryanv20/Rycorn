import { Anchor, CircleDot, Package, Ship, TriangleAlert } from 'lucide-react';
import EventLog from './EventLog';

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

interface OperationsRailProps {
  vessels: VesselRecord[];
  cargoes: CargoRecord[];
  events: EventRecord[];
  errors: Array<{ message: string; timestamp: number }>;
  selectedVesselId: string | null;
  onSelectVessel: (vesselId: string) => void;
}

export default function OperationsRail({ vessels, cargoes, events, errors, selectedVesselId, onSelectVessel }: OperationsRailProps) {
  const selectedVessel = vessels.find(vessel => vessel.vesselId === selectedVesselId);
  const sailingCount = vessels.filter(vessel => vessel.status === 'SAILING').length;
  const activeCargoCount = cargoes.filter(cargo => cargo.status !== 'DELIVERED' && cargo.status !== 'CANCELLED').length;

  return (
    <aside className="operations-rail">
      <header className="rail-heading">
        <div><p className="eyebrow">LIVE OPERATIONS</p><h2>Fleet overview</h2></div>
        <span className="live-indicator"><i /> Live</span>
      </header>
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
        <div className="detail-line"><span>Current node</span><strong className="mono">{selectedVessel.currentNodeId}</strong></div>
      </section>}

      <section className="rail-section fleet-section">
        <div className="section-heading"><h3>Vessels</h3><span>{vessels.length}</span></div>
        {vessels.length === 0
          ? <div className="rail-empty"><Anchor size={17} /><span>Initialize the simulation to load the DS fleet.</span></div>
          : <div className="vessel-list">{vessels.map(vessel => <button
            key={vessel.vesselId}
            className={`vessel-row ${selectedVesselId === vessel.vesselId ? 'is-selected' : ''}`}
            onClick={() => onSelectVessel(vessel.vesselId)}
          >
            <span className={`vessel-status-dot status-${vessel.status.toLowerCase()}`} />
            <span className="vessel-row-copy"><strong>{vessel.vesselId}</strong><small>{vessel.currentNodeId}</small></span>
            <span className="vessel-row-status">{vessel.status.replace('_', ' ')}</span>
          </button>)}</div>}
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

      <EventLog events={events} compact />
    </aside>
  );
}
