import { FormEvent, useEffect, useId, useMemo, useState } from 'react';
import { API } from '../api';

type Demand = {
  requestId: string;
  origin: string;
  destination: string;
  quantity: number;
  earliestDeparture: number;
  deadline: number;
  cargoType: string;
  status: string;
  originRegionId?: string;
  destinationRegionId?: string;
  tradeLaneId?: string;
  failureReason?: string;
};

type Port = { portId: string; name: string; country: string; regionId: string };
type TradeRegion = { id: string; name: string; description: string; portCount: number; samplePorts: Array<{ portId: string; name: string; country: string }> };
type Vessel = { id: string; capability: string; startNodeId: string; deadweightTonnes: number };
type TradeCycle = { cycleNumber: number; demandCount: number; deliveredCount: number; lateCount: number; failedCount: number; outstandingCount: number; modelUnits: number };
type Status = { demandProvider: string; fleetProvider: string; demandCount: number; vesselCount: number; latestSnapshot: Snapshot | null; continuousMode?: boolean; continuousCycle?: number; tradeCycles?: TradeCycle[]; environment?: { enabled: boolean } | null };
type Snapshot = { snapshotId: string; createdAt: string; version: number; cargoDemands: Demand[]; vesselSupply: Vessel[] };

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? body.message ?? 'Could not update the planning book');
  return body as T;
}

function PortPicker({ ports, value, label, onChange }: {
  ports: Port[];
  value: string;
  label: string;
  onChange: (nodeId: string) => void;
}) {
  const pickerId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selected = ports.find(port => `node-${port.portId}` === value);
  const search = query.trim().toLowerCase();
  const matches = search.length < 2 ? [] : ports.filter(port =>
    `${port.name} ${port.country} ${port.portId}`.toLowerCase().includes(search)
  ).slice(0, 8);

  return <div className="ds-field ds-port-picker">
    <label htmlFor={pickerId}>{label}</label>
    <input
      id={pickerId}
      required
      role="combobox"
      aria-expanded={open && matches.length > 0}
      aria-autocomplete="list"
      aria-controls={`${pickerId}-options`}
      placeholder="Search by port or country"
      value={query || (selected ? `${selected.name}, ${selected.country}` : '')}
      onFocus={() => setOpen(true)}
      onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      onChange={event => { setQuery(event.target.value); onChange(''); setOpen(true); }}
    />
    <small>Choose a port by name; internal location codes stay in the records.</small>
    {open && matches.length > 0 && <div className="ds-port-options" id={`${pickerId}-options`} role="listbox">
      {matches.map(port => <button
        type="button"
        role="option"
        aria-selected={`node-${port.portId}` === value}
        key={port.portId}
        onMouseDown={event => event.preventDefault()}
        onClick={() => { onChange(`node-${port.portId}`); setQuery(''); setOpen(false); }}
      >{port.name}<small>{port.country} · {regionName(port.regionId)}</small></button>)}
    </div>}
  </div>;
}

function portName(nodeId: string, ports: Port[]): string {
  const portId = nodeId.startsWith('node-') ? nodeId.slice(5) : nodeId;
  const port = ports.find(item => item.portId === portId);
  return port ? `${port.name}, ${port.country}` : nodeId;
}

function regionName(regionId: string | undefined): string {
  return regionId?.replace(/-/g, ' ').replace(/\b\w/g, character => character.toUpperCase()) ?? 'Region not set';
}

function statusLabel(status: string): string {
  return ({ PENDING: 'Awaiting assignment', ASSIGNED: 'Vessel assigned', IN_TRANSIT: 'In transit', DELIVERED: 'Delivered on time', DELIVERED_LATE: 'Delivered late', CANCELLED: 'Cancelled', FAILED: 'Needs review' } as Record<string, string>)[status] ?? status;
}

export default function DSSystemPage({ onBack }: { onBack: () => void }) {
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [demands, setDemands] = useState<Demand[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [ports, setPorts] = useState<Port[]>([]);
  const [regions, setRegions] = useState<TradeRegion[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [editingDemandId, setEditingDemandId] = useState<string | null>(null);
  const [demandForm, setDemandForm] = useState({ origin: '', destination: '', quantity: '100', deadlineDays: '7', cargoType: 'GENERAL' });
  const [vesselForm, setVesselForm] = useState({ id: '', capability: 'C', startNodeId: '', deadweightTonnes: '12000' });

  const loadData = async () => {
    try {
      const [nextStatus, nextDemands, nextVessels, nextPorts, nextRegions] = await Promise.all([
        request<Status>('/ds/status'),
        request<{ demands: Demand[] }>('/ds/demands'),
        request<{ vessels: Vessel[] }>('/ds/supply'),
        request<Port[]>('/network/ports'),
        request<TradeRegion[]>('/network/regions'),
      ]);
      setStatus(nextStatus);
      setDemands(nextDemands.demands);
      setVessels(nextVessels.vessels);
      setPorts(nextPorts);
      setRegions(nextRegions);
      setSnapshot(nextStatus.latestSnapshot);
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load the planning book');
    }
  };

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(async () => {
      try {
        const [nextStatus, nextDemands] = await Promise.all([
          request<Status>('/ds/status'),
          request<{ demands: Demand[] }>('/ds/demands'),
        ]);
        setStatus(nextStatus);
        setDemands(nextDemands.demands);
      } catch {
        // Keep the last planning view visible during a brief server reconnect.
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const openDemands = useMemo(() => demands.filter(demand => ['PENDING', 'ASSIGNED', 'IN_TRANSIT'].includes(demand.status)), [demands]);
  const openVolume = useMemo(() => openDemands.reduce((total, demand) => total + demand.quantity, 0), [openDemands]);
  const fleetDeadweight = useMemo(() => vessels.reduce((total, vessel) => total + vessel.deadweightTonnes, 0), [vessels]);
  const regionalOutlook = useMemo(() => regions.map(region => {
    const regionDemands = openDemands.filter(demand => demand.originRegionId === region.id);
    return {
      ...region,
      flowCount: regionDemands.length,
      modelUnits: regionDemands.reduce((total, demand) => total + demand.quantity, 0),
    };
  }).filter(region => region.portCount > 0), [regions, openDemands]);
  const latestCycle = status?.tradeCycles?.[status.tradeCycles.length - 1];

  const clearDemandForm = () => {
    setEditingDemandId(null);
    setDemandForm({ origin: '', destination: '', quantity: '100', deadlineDays: '7', cargoType: 'GENERAL' });
  };

  const saveDemand = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const values = {
        origin: demandForm.origin,
        destination: demandForm.destination,
        quantity: Number(demandForm.quantity),
        earliestDeparture: 0,
        deadline: Number(demandForm.deadlineDays) * 24,
        cargoType: demandForm.cargoType,
        originRegionId: ports.find(port => `node-${port.portId}` === demandForm.origin)?.regionId,
        destinationRegionId: ports.find(port => `node-${port.portId}` === demandForm.destination)?.regionId,
        tradeLaneId: `${ports.find(port => `node-${port.portId}` === demandForm.origin)?.regionId ?? 'market'}-to-${ports.find(port => `node-${port.portId}` === demandForm.destination)?.regionId ?? 'market'}`,
      };
      if (editingDemandId) {
        await request(`/ds/demands/${encodeURIComponent(editingDemandId)}`, { method: 'PATCH', body: JSON.stringify(values) });
      } else {
        await request('/ds/demands', { method: 'POST', body: JSON.stringify({ requestId: `TRADE-${Date.now()}`, ...values }) });
      }
      clearDemandForm();
      await loadData();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not save the trade request'); }
  };

  const editDemand = (demand: Demand) => {
    setEditingDemandId(demand.requestId);
    setDemandForm({
      origin: demand.origin,
      destination: demand.destination,
      quantity: String(demand.quantity),
      deadlineDays: String(Math.max(1, Math.ceil(demand.deadline / 24))),
      cargoType: demand.cargoType,
    });
  };

  const cancelDemand = async (requestId: string) => {
    try {
      await request(`/ds/demands/${encodeURIComponent(requestId)}`, { method: 'DELETE' });
      if (editingDemandId === requestId) clearDemandForm();
      await loadData();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not withdraw the trade request'); }
  };

  const addVessel = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await request('/ds/supply', {
        method: 'POST',
        body: JSON.stringify({ ...vesselForm, deadweightTonnes: Number(vesselForm.deadweightTonnes) }),
      });
      setVesselForm({ id: '', capability: 'C', startNodeId: '', deadweightTonnes: '12000' });
      await loadData();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not register fleet capacity'); }
  };

  const createSnapshot = async () => {
    try {
      const result = await request<{ snapshot: Snapshot }>('/ds/snapshots', { method: 'POST' });
      setSnapshot(result.snapshot);
      await loadData();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not save the planning snapshot'); }
  };

  return <main className="ds-page">
    <header className="ds-header">
      <div><p className="ds-kicker">RYCORN / ECONOMIC PLANNING</p><h1>Trade demand &amp; fleet capacity</h1><p>Shape the movement outlook, review available shipping supply, and save a planning snapshot.</p></div>
      <div className="ds-actions"><button onClick={onBack}>Operations map</button></div>
    </header>
    {error && <p className="ds-error ds-banner" role="alert">{error}</p>}
    <section className="ds-metrics" aria-label="Planning overview">
      <article><span>Open trade requests</span><strong>{openDemands.length}</strong><small>{openVolume.toLocaleString()} model cargo units in the pipeline</small></article>
      <article><span>Registered fleet</span><strong>{vessels.length}</strong><small>{fleetDeadweight.toLocaleString()} tonnes total rated deadweight</small></article>
      <article><span>Planning snapshot</span><strong>{snapshot ? `#${snapshot.version}` : 'None'}</strong><small>{snapshot ? new Date(snapshot.createdAt).toLocaleString() : 'No saved planning view'}</small></article>
      <article><span>Planning book</span><strong>{status ? 'Ready' : 'Loading'}</strong><small>Demand and fleet supply records</small></article>
    </section>
    <section className="ds-region-overview" aria-label="Trade region outlook">
      <header><div><p className="ds-kicker">REGIONAL OUTLOOK</p><h2>Markets connected by the plan</h2></div><span>{status?.continuousMode ? `Live trade cycle ${status.continuousCycle ?? 0}` : `${regionalOutlook.length} regions · ${ports.length.toLocaleString()} catalog ports`}</span></header>
      <div className="ds-region-grid">{regionalOutlook.map(region => <article key={region.id}>
        <span>{region.name}</span><strong>{region.flowCount ? region.flowCount.toLocaleString() : '—'}</strong>
        <small>{region.flowCount ? `${region.modelUnits.toLocaleString()} model units outbound` : `${region.portCount.toLocaleString()} ports in catalog`}</small>
      </article>)}</div>
      {latestCycle && <p className="ds-cycle-summary">Most recent cycle: {latestCycle.deliveredCount} of {latestCycle.demandCount} movements delivered, {latestCycle.lateCount} after deadline · {latestCycle.outstandingCount} still open · {latestCycle.failedCount} failed · {latestCycle.modelUnits.toLocaleString()} model units.</p>}
      <p className="ds-help">Regions are broad planning groups assigned from the port country. They are not official trade blocs; flow volumes are model units unless a sourced data series is connected.</p>
      {status?.environment?.enabled && <p className="ds-help">Voyage times include repeatable weather, daytime congestion, and port-delay sensitivities. They are seeded model assumptions, not live conditions.</p>}
    </section>
    <div className="ds-grid">
      <section className="ds-panel">
        <div className="ds-panel-title"><div><p className="ds-kicker">TRADE FLOWS</p><h2>Demand outlook</h2><p>Record a movement requirement between two ports.</p></div><span>{demands.length} requests</span></div>
        <form className="ds-form" onSubmit={saveDemand}>
          <PortPicker ports={ports} value={demandForm.origin} label="Origin market / port" onChange={origin => setDemandForm({ ...demandForm, origin })} />
          <PortPicker ports={ports} value={demandForm.destination} label="Destination market / port" onChange={destination => setDemandForm({ ...demandForm, destination })} />
          <div className="ds-form-pair">
            <label className="ds-field">Cargo volume <span>(model units)</span><input required type="number" min="1" step="any" value={demandForm.quantity} onChange={event => setDemandForm({ ...demandForm, quantity: event.target.value })} /></label>
            <label className="ds-field">Delivery horizon <span>(days from scenario start)</span><input required type="number" min="1" step="1" value={demandForm.deadlineDays} onChange={event => setDemandForm({ ...demandForm, deadlineDays: event.target.value })} /></label>
          </div>
          <label className="ds-field">Goods category<select value={demandForm.cargoType} onChange={event => setDemandForm({ ...demandForm, cargoType: event.target.value })}>
            <option value="GENERAL">General goods</option><option value="CONTAINERIZED_GOODS">Containerized goods</option><option value="RAW_MATERIALS">Raw materials</option><option value="ENERGY">Energy</option><option value="FOOD">Food</option><option value="MACHINERY">Machinery</option>
          </select></label>
          <p className="ds-help">Volume is a model quantity, not a measured tonnage or current booking.</p>
          <div className="ds-form-actions"><button className="ds-primary" type="submit">{editingDemandId ? 'Save demand changes' : 'Add trade demand'}</button>{editingDemandId && <button type="button" onClick={clearDemandForm}>Cancel edit</button>}</div>
        </form>
        <div className="ds-list">
          {demands.map(demand => <article className="ds-row" key={demand.requestId}>
            <div className="ds-row-main"><strong>{portName(demand.origin, ports)} <span>→</span> {portName(demand.destination, ports)}</strong><small>{demand.quantity.toLocaleString()} model units · {regionName(demand.originRegionId)} → {regionName(demand.destinationRegionId)} · due within {Math.ceil(demand.deadline / 24)} days</small>{demand.failureReason && <small className="ds-failure-reason">{demand.failureReason}</small>}</div>
            <span className={`ds-demand-status status-${demand.status.toLowerCase()}`}>{statusLabel(demand.status)}</span>
            {demand.status === 'PENDING' && <div className="ds-row-actions"><button type="button" onClick={() => editDemand(demand)}>Edit</button><button type="button" onClick={() => void cancelDemand(demand.requestId)}>Withdraw</button></div>}
          </article>)}
          {demands.length === 0 && <p className="ds-empty">No trade requests in the planning book yet.</p>}
        </div>
      </section>
      <section className="ds-panel">
        <div className="ds-panel-title"><div><p className="ds-kicker">SHIPPING SUPPLY</p><h2>Fleet capacity</h2><p>Register a vessel and its starting market for scenario planning.</p></div><span>{vessels.length} vessels</span></div>
        <form className="ds-form" onSubmit={addVessel}>
          <div className="ds-form-pair">
            <label className="ds-field">Fleet reference<input required placeholder="e.g. FLEET-101" value={vesselForm.id} onChange={event => setVesselForm({ ...vesselForm, id: event.target.value })} /></label>
            <label className="ds-field">Model capacity class<select value={vesselForm.capability} onChange={event => setVesselForm({ ...vesselForm, capability: event.target.value })}><option value="A">A · smallest</option><option value="B">B · small</option><option value="C">C · medium</option><option value="D">D · large</option><option value="E">E · largest</option></select></label>
          </div>
          <label className="ds-field">Rated deadweight <span>(tonnes)</span><input required type="number" min="1" step="1" value={vesselForm.deadweightTonnes} onChange={event => setVesselForm({ ...vesselForm, deadweightTonnes: event.target.value })} /></label>
          <PortPicker ports={ports} value={vesselForm.startNodeId} label="Starting market / port" onChange={startNodeId => setVesselForm({ ...vesselForm, startNodeId })} />
          <p className="ds-help">Capacity class controls what the simulation can carry; deadweight is shown as a separate fleet attribute.</p>
          <button className="ds-primary" type="submit">Register fleet capacity</button>
        </form>
        <div className="ds-list">
          {vessels.map(vessel => <article className="ds-row" key={vessel.id}>
            <div className="ds-row-main"><strong>{vessel.id}</strong><small>{portName(vessel.startNodeId, ports)} · {vessel.deadweightTonnes.toLocaleString()} t deadweight</small></div>
            <span className="ds-capacity-class">Class {vessel.capability}</span>
          </article>)}
        </div>
      </section>
    </div>
    <section className="ds-panel ds-snapshot">
      <div><p className="ds-kicker">PLANNING RECORD</p><h2>Save a market snapshot</h2><p>Capture the current trade demand and fleet supply for comparison with a later planning view.</p></div>
      <button className="ds-primary" onClick={createSnapshot}>Save planning snapshot</button>
      {snapshot && <p className="ds-snapshot-summary">Snapshot #{snapshot.version}: {snapshot.cargoDemands.length} trade requests and {snapshot.vesselSupply.length} vessels · {new Date(snapshot.createdAt).toLocaleString()}</p>}
    </section>
  </main>;
}
