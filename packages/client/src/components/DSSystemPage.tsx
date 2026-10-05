import { FormEvent, useEffect, useState } from 'react';
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
};

type Vessel = { id: string; capability: string; startNodeId: string };
type Status = { demandProvider: string; fleetProvider: string; demandCount: number; vesselCount: number; latestSnapshot: Snapshot | null };
type Snapshot = { snapshotId: string; createdAt: string; version: number; cargoDemands: Demand[]; vesselSupply: Vessel[] };

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? 'DS System request failed');
  return body as T;
}

export default function DSSystemPage({ onBack }: { onBack: () => void }) {
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [demands, setDemands] = useState<Demand[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [editingDemandId, setEditingDemandId] = useState<string | null>(null);
  const [demandForm, setDemandForm] = useState({ requestId: '', origin: '', destination: '', quantity: '100', deadline: '48' });
  const [vesselForm, setVesselForm] = useState({ id: '', capability: 'C', startNodeId: '' });

  const loadData = async () => {
    try {
      const [nextStatus, nextDemands, nextVessels] = await Promise.all([
        request<Status>('/ds/status'),
        request<{ demands: Demand[] }>('/ds/demands'),
        request<{ vessels: Vessel[] }>('/ds/supply'),
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
    void loadData();
  }, []);

  const addDemand = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const values = {
        origin: demandForm.origin,
        destination: demandForm.destination,
        quantity: Number(demandForm.quantity),
        earliestDeparture: 0,
        deadline: Number(demandForm.deadline),
        cargoType: 'GENERAL',
      };
      if (editingDemandId) {
        await request(`/ds/demands/${encodeURIComponent(editingDemandId)}`, {
          method: 'PATCH',
          body: JSON.stringify(values),
        });
      } else {
        await request('/ds/demands', {
          method: 'POST',
          body: JSON.stringify({ requestId: demandForm.requestId, ...values }),
        });
      }
      setEditingDemandId(null);
      setDemandForm({ requestId: '', origin: '', destination: '', quantity: '100', deadline: '48' });
      await loadData();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Demand creation failed'); }
  };

  const editDemand = (demand: Demand) => {
    setEditingDemandId(demand.requestId);
    setDemandForm({
      requestId: demand.requestId,
      origin: demand.origin,
      destination: demand.destination,
      quantity: String(demand.quantity),
      deadline: String(demand.deadline),
    });
  };

  const cancelDemand = async (requestId: string) => {
    try {
      await request(`/ds/demands/${encodeURIComponent(requestId)}`, { method: 'DELETE' });
      if (editingDemandId === requestId) {
        setEditingDemandId(null);
        setDemandForm({ requestId: '', origin: '', destination: '', quantity: '100', deadline: '48' });
      }
      await loadData();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Demand cancellation failed'); }
  };

  const stopEditingDemand = () => {
    setEditingDemandId(null);
    setDemandForm({ requestId: '', origin: '', destination: '', quantity: '100', deadline: '48' });
  };

  const addVessel = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await request('/ds/supply', { method: 'POST', body: JSON.stringify(vesselForm) });
      setVesselForm({ id: '', capability: 'C', startNodeId: '' });
      await loadData();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Supply registration failed'); }
  };

  const createSnapshot = async () => {
    try {
      const result = await request<{ snapshot: Snapshot }>('/ds/snapshots', { method: 'POST' });
      setSnapshot(result.snapshot);
      await loadData();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Snapshot creation failed'); }
  };

  return (
    <main className="ds-page">
      <header className="ds-header">
        <div><p className="ds-kicker">RYCON / CONTROL PLANE</p><h1>DS System</h1><p>Demand and supply operations console</p></div>
        <div className="ds-actions"><button onClick={onBack}>Simulation</button></div>
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
          <form className="ds-form" onSubmit={addDemand}><input required placeholder="Demand ID" disabled={Boolean(editingDemandId)} value={demandForm.requestId} onChange={event => setDemandForm({ ...demandForm, requestId: event.target.value })} /><input required placeholder="Origin node" value={demandForm.origin} onChange={event => setDemandForm({ ...demandForm, origin: event.target.value })} /><input required placeholder="Destination node" value={demandForm.destination} onChange={event => setDemandForm({ ...demandForm, destination: event.target.value })} /><input required type="number" min="1" placeholder="Quantity" value={demandForm.quantity} onChange={event => setDemandForm({ ...demandForm, quantity: event.target.value })} /><input required type="number" min="1" placeholder="Deadline" value={demandForm.deadline} onChange={event => setDemandForm({ ...demandForm, deadline: event.target.value })} /><div className="ds-form-actions"><button className="ds-primary" type="submit">{editingDemandId ? 'Save changes' : 'Create demand'}</button>{editingDemandId && <button type="button" onClick={stopEditingDemand}>Stop editing</button>}</div></form>
          <div className="ds-list">{demands.map(demand => <div className="ds-row" key={demand.requestId}><strong>{demand.requestId}</strong><span>{demand.origin} → {demand.destination}</span><b>{demand.quantity}</b><small>{demand.status}</small>{demand.status === 'PENDING' && <div className="ds-row-actions"><button type="button" onClick={() => editDemand(demand)}>Edit</button><button type="button" onClick={() => void cancelDemand(demand.requestId)}>Cancel</button></div>}</div>)}</div>
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
