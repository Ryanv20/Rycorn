import { FormEvent, useEffect, useState } from 'react';

const API = 'http://localhost:3000';
const tokenKey = 'rycon-ds-session';

type Demand = {
  requestId: string;
  origin: string;
  destination: string;
  quantity: number;
  earliestDeparture: number;
  deadline: number;
  cargoType: string;
};

type Vessel = { id: string; capability: string; startNodeId: string };
type Status = { demandProvider: string; fleetProvider: string; demandCount: number; vesselCount: number; latestSnapshot: Snapshot | null };
type Snapshot = { snapshotId: string; createdAt: string; version: number; cargoDemands: Demand[]; vesselSupply: Vessel[] };

async function request<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? 'DS System request failed');
  return body as T;
}

export default function DSSystemPage({ onBack }: { onBack: () => void }) {
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey) ?? '');
  const [passkey, setPasskey] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [demands, setDemands] = useState<Demand[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [demandForm, setDemandForm] = useState({ requestId: '', origin: '', destination: '', quantity: '100', deadline: '48' });
  const [vesselForm, setVesselForm] = useState({ id: '', capability: 'C', startNodeId: '' });

  const loadData = async (sessionToken = token) => {
    try {
      const [nextStatus, nextDemands, nextVessels] = await Promise.all([
        request<Status>('/ds/status', sessionToken),
        request<{ demands: Demand[] }>('/ds/demands', sessionToken),
        request<{ vessels: Vessel[] }>('/ds/supply', sessionToken),
      ]);
      setStatus(nextStatus);
      setDemands(nextDemands.demands);
      setVessels(nextVessels.vessels);
      setSnapshot(nextStatus.latestSnapshot);
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load DS System');
    }
  };

  useEffect(() => {
    if (token) void loadData();
  }, [token]);

  const authenticate = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await fetch(`${API}/ds/auth`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passkey }),
      });
      const body = await result.json();
      if (!result.ok) throw new Error(body.error ?? 'Authentication failed');
      localStorage.setItem(tokenKey, body.token);
      setToken(body.token);
      setPasskey('');
      setError('');
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed');
    }
  };

  const addDemand = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await request('/ds/demands', token, { method: 'POST', body: JSON.stringify({
        requestId: demandForm.requestId,
        origin: demandForm.origin,
        destination: demandForm.destination,
        quantity: Number(demandForm.quantity),
        earliestDeparture: 0,
        deadline: Number(demandForm.deadline),
        cargoType: 'GENERAL',
      }) });
      setDemandForm({ requestId: '', origin: '', destination: '', quantity: '100', deadline: '48' });
      await loadData();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Demand creation failed'); }
  };

  const addVessel = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await request('/ds/supply', token, { method: 'POST', body: JSON.stringify(vesselForm) });
      setVesselForm({ id: '', capability: 'C', startNodeId: '' });
      await loadData();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Supply registration failed'); }
  };

  const createSnapshot = async () => {
    try {
      const result = await request<{ snapshot: Snapshot }>('/ds/snapshots', token, { method: 'POST' });
      setSnapshot(result.snapshot);
      await loadData();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Snapshot creation failed'); }
  };

  const logout = async () => {
    await fetch(`${API}/ds/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    localStorage.removeItem(tokenKey);
    setToken('');
    setStatus(null);
  };

  if (!token) return (
    <main className="ds-page ds-access">
      <button className="ds-back" onClick={onBack}>Back to simulation</button>
      <section className="ds-access-panel">
        <p className="ds-kicker">RYCON / PRIVATE CONSOLE</p>
        <h1>DS System</h1>
        <p>Demand and supply operations require an access passkey.</p>
        <form onSubmit={authenticate}>
          <label>Passkey<input autoFocus type="password" value={passkey} onChange={event => setPasskey(event.target.value)} /></label>
          <button className="ds-primary" type="submit">Enter DS System</button>
        </form>
        {error && <p className="ds-error">{error}</p>}
      </section>
    </main>
  );

  return (
    <main className="ds-page">
      <header className="ds-header">
        <div><p className="ds-kicker">RYCON / CONTROL PLANE</p><h1>DS System</h1><p>Demand and supply operations console</p></div>
        <div className="ds-actions"><button onClick={onBack}>Simulation</button><button onClick={logout}>Lock console</button></div>
      </header>
      {error && <p className="ds-error ds-banner">{error}</p>}
      <section className="ds-metrics">
        <article><span>Demand</span><strong>{status?.demandCount ?? 0}</strong><small>records held</small></article>
        <article><span>Vessel supply</span><strong>{status?.vesselCount ?? 0}</strong><small>available records</small></article>
        <article><span>Snapshot</span><strong>{snapshot ? `#${snapshot.version}` : 'None'}</strong><small>{snapshot ? new Date(snapshot.createdAt).toLocaleString() : 'not generated'}</small></article>
        <article><span>Provider</span><strong>READY</strong><small>{status?.demandProvider ?? 'loading'}</small></article>
      </section>
      <div className="ds-grid">
        <section className="ds-panel"><div className="ds-panel-title"><h2>Demand</h2><span>{demands.length} total</span></div>
          <form className="ds-form" onSubmit={addDemand}><input required placeholder="Demand ID" value={demandForm.requestId} onChange={event => setDemandForm({ ...demandForm, requestId: event.target.value })} /><input required placeholder="Origin node" value={demandForm.origin} onChange={event => setDemandForm({ ...demandForm, origin: event.target.value })} /><input required placeholder="Destination node" value={demandForm.destination} onChange={event => setDemandForm({ ...demandForm, destination: event.target.value })} /><input required type="number" min="1" placeholder="Quantity" value={demandForm.quantity} onChange={event => setDemandForm({ ...demandForm, quantity: event.target.value })} /><input required type="number" min="1" placeholder="Deadline" value={demandForm.deadline} onChange={event => setDemandForm({ ...demandForm, deadline: event.target.value })} /><button className="ds-primary" type="submit">Create demand</button></form>
          <div className="ds-list">{demands.map(demand => <div className="ds-row" key={demand.requestId}><strong>{demand.requestId}</strong><span>{demand.origin} → {demand.destination}</span><b>{demand.quantity}</b></div>)}</div>
        </section>
        <section className="ds-panel"><div className="ds-panel-title"><h2>Vessel supply</h2><span>{vessels.length} total</span></div>
          <form className="ds-form" onSubmit={addVessel}><input required placeholder="Vessel ID" value={vesselForm.id} onChange={event => setVesselForm({ ...vesselForm, id: event.target.value })} /><select value={vesselForm.capability} onChange={event => setVesselForm({ ...vesselForm, capability: event.target.value })}><option>A</option><option>B</option><option>C</option><option>D</option><option>E</option></select><input required placeholder="Start node" value={vesselForm.startNodeId} onChange={event => setVesselForm({ ...vesselForm, startNodeId: event.target.value })} /><button className="ds-primary" type="submit">Register vessel</button></form>
          <div className="ds-list">{vessels.map(vessel => <div className="ds-row" key={vessel.id}><strong>{vessel.id}</strong><span>{vessel.startNodeId}</span><b>Class {vessel.capability}</b></div>)}</div>
        </section>
      </div>
      <section className="ds-panel ds-snapshot"><div><p className="ds-kicker">ENGINE HANDOFF</p><h2>Demand / supply snapshot</h2><p>Build a consistent view for the engine to consume.</p></div><button className="ds-primary" onClick={createSnapshot}>Generate snapshot</button>{snapshot && <pre>{JSON.stringify({ snapshotId: snapshot.snapshotId, version: snapshot.version, demands: snapshot.cargoDemands.length, vessels: snapshot.vesselSupply.length }, null, 2)}</pre>}</section>
    </main>
  );
}