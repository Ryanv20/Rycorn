import { useEffect, useMemo, useState } from 'react';
import { Anchor, ArrowLeft, Boxes, CircleDollarSign, GitFork, Package, Ship } from 'lucide-react';
import { API } from '../api';

interface Region { id: string; name: string; portCount: number; samplePorts?: Array<{ portId: string; name: string; country: string }>; }
interface Demand { requestId: string; originRegionId?: string; destinationRegionId?: string; quantity: number; status: string; origin: string; destination: string; }
interface Vessel { id: string; capability: string; deadweightTonnes?: number; startNodeId: string; }

export default function DSGraphPage({ onBack }: { onBack: () => void }) {
  const [regions, setRegions] = useState<Region[]>([]);
  const [demands, setDemands] = useState<Demand[]>([]);
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = () => Promise.all([
        fetch(`${API}/network/regions`).then(response => { if (!response.ok) throw new Error('Could not load regions'); return response.json(); }),
        fetch(`${API}/ds/demands`).then(response => { if (!response.ok) throw new Error('Could not load trade demands'); return response.json(); }),
        fetch(`${API}/ds/supply`).then(response => { if (!response.ok) throw new Error('Could not load vessel supply'); return response.json(); }),
      ]).then(([nextRegions, demandResult, supplyResult]) => {
        if (!active) return;
        setRegions(Array.isArray(nextRegions) ? nextRegions : []);
        setDemands(Array.isArray(demandResult.demands) ? demandResult.demands : []);
        setVessels(Array.isArray(supplyResult.vessels) ? supplyResult.vessels : []);
        setError('');
      }).catch(requestError => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Could not load DS flow graph');
      });
    void load();
    const refreshTimer = window.setInterval(() => void load(), 5000);
    return () => { active = false; window.clearInterval(refreshTimer); };
  }, []);

  const layout = useMemo(() => {
    const radiusX = 335;
    const radiusY = 175;
    return new Map(regions.map((region, index) => {
      const angle = -Math.PI / 2 + (index / Math.max(regions.length, 1)) * Math.PI * 2;
      return [region.id, { x: 500 + Math.cos(angle) * radiusX, y: 270 + Math.sin(angle) * radiusY }];
    }));
  }, [regions]);
  const activeDemands = demands.filter(demand => ['PENDING', 'ASSIGNED', 'IN_TRANSIT'].includes(demand.status));
  const openUnits = activeDemands.reduce((sum, demand) => sum + demand.quantity, 0);
  const capacity = vessels.reduce((sum, vessel) => sum + (vessel.deadweightTonnes ?? 0), 0);
  const selected = regions.find(region => region.id === selectedRegion) ?? null;
  const selectedFlows = selected ? activeDemands.filter(demand => demand.originRegionId === selected.id || demand.destinationRegionId === selected.id) : [];

  return <main className="ds-graph-page">
    <header className="ds-graph-topline"><button className="page-back" onClick={onBack}><ArrowLeft size={16} /> Operations</button><span><GitFork size={15} /> DS FLOW GRAPH</span><small>DEMAND · FLEET · REGIONS</small></header>
    <section className="ds-graph-heading"><div><p className="eyebrow">DEMAND &amp; SUPPLY / NETWORK VIEW</p><h1>How trade connects the fleet</h1><p>Regional demand flows connect ports to available vessel capacity. Select a region to inspect its live planning links.</p></div></section>
    <section className="ds-graph-metrics">
      <article><Package size={16} /><span>OPEN FLOWS</span><strong>{activeDemands.length.toLocaleString()}</strong></article>
      <article><Boxes size={16} /><span>MODEL UNITS</span><strong>{openUnits.toLocaleString()}</strong></article>
      <article><Ship size={16} /><span>FLEET SUPPLY</span><strong>{vessels.length.toLocaleString()} <small>vessels</small></strong></article>
      <article><CircleDollarSign size={16} /><span>REGISTERED CAPACITY</span><strong>{capacity.toLocaleString()} <small>tonnes</small></strong></article>
    </section>
    {error && <p className="ds-error ds-banner" role="alert">{error}</p>}
    <div className="ds-graph-layout">
      <section className="ds-graph-canvas" aria-label="Regional demand and supply graph">
        <svg viewBox="0 0 1000 540" role="img" aria-label="Trade demand flows between market regions">
          <defs><pattern id="ds-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(160,211,201,.08)" strokeWidth="1" /></pattern></defs>
          <rect width="1000" height="540" fill="url(#ds-grid)" />
          {demands.map(demand => {
            const origin = demand.originRegionId ? layout.get(demand.originRegionId) : null;
            const destination = demand.destinationRegionId ? layout.get(demand.destinationRegionId) : null;
            if (!origin || !destination) return null;
            const dx = destination.x - origin.x;
            const dy = destination.y - origin.y;
            const intensity = Math.max(.35, Math.min(1, demand.quantity / Math.max(openUnits / 4, 1)));
            return <path key={demand.requestId} d={`M ${origin.x} ${origin.y} Q ${500 - dy * .12} ${270 + dx * .12} ${destination.x} ${destination.y}`} className={`ds-graph-edge status-${demand.status.toLowerCase()}`} strokeWidth={1 + intensity * 3} opacity={activeDemands.includes(demand) ? .25 + intensity * .5 : .18}><title>{demand.origin} → {demand.destination} · {demand.quantity.toLocaleString()} model units · {demand.status}</title></path>;
          })}
          {regions.map(region => {
            const point = layout.get(region.id);
            if (!point) return null;
            const activeCount = activeDemands.filter(demand => demand.originRegionId === region.id || demand.destinationRegionId === region.id).length;
            const selectedClass = selectedRegion === region.id ? 'is-selected' : '';
            return <g key={region.id} className={`ds-graph-node ${selectedClass}`} transform={`translate(${point.x} ${point.y})`} onClick={() => setSelectedRegion(region.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedRegion(region.id); } }} role="button" tabIndex={0} aria-label={`${region.name}, ${region.portCount} ports, ${activeCount} open flows`}>
              <circle className="ds-graph-node-halo" r="47" /><circle className="ds-graph-node-core" r="37" />
              <text y="-4" className="ds-graph-node-count">{region.portCount}</text><text y="12" className="ds-graph-node-caption">PORTS</text>
              <text y="61" className="ds-graph-node-name">{region.name}</text><text y="76" className="ds-graph-node-flows">{activeCount} OPEN FLOWS</text>
            </g>;
          })}
          {!regions.length && <text x="500" y="270" textAnchor="middle" className="ds-graph-empty">Loading regional network…</text>}
        </svg>
        <div className="ds-graph-legend"><span><i className="edge-active" /> Open demand</span><span><i className="edge-delivered" /> Delivered / terminal</span><span><Anchor size={13} /> Region size shows port count</span></div>
      </section>
      <aside className="ds-graph-detail">
        <p className="eyebrow">REGION DETAIL</p>
        {selected ? <><h2>{selected.name}</h2><p>{selected.portCount} catalog ports · {selectedFlows.length} open connected flows.</p>
          <div className="ds-graph-detail-metric"><span>Open model units</span><strong>{selectedFlows.reduce((sum, flow) => sum + flow.quantity, 0).toLocaleString()}</strong></div>
          <h3>Connected demand</h3>
          <ul>{selectedFlows.slice(0, 8).map(flow => <li key={flow.requestId}><span>{flow.origin} → {flow.destination}</span><b>{flow.quantity.toLocaleString()}</b><small>{flow.status.replace(/_/g, ' ')}</small></li>)}</ul>
          <h3>Sample ports</h3><div className="ds-graph-port-list">{selected.samplePorts?.slice(0, 8).map(port => <span key={port.portId}>{port.name}<small>{port.country}</small></span>)}</div>
        </> : <div className="ds-graph-empty-detail"><GitFork size={22} /><p>Select a region node to inspect its demand links and ports.</p></div>}
      </aside>
    </div>
    <footer className="scenario-footer">Planning model view · cargo volumes are model units; capacity records are configured fleet inputs.</footer>
  </main>;
}
