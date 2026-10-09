import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Compass, GitBranch, Globe2, RefreshCw, Ship } from 'lucide-react';
import { API } from '../api';


interface ScenarioPlan {
  id: string;
  name: string;
  generatedAt: string;
  generationMode: 'FIXED_RULES';
  continuous: boolean;
  summary: string;
  rationale: string[];
  assumptions: string[];
  limitations: string[];
  sourceNote: string;
  regionBreakdown: Array<{ regionId: string; regionName: string; flowCount: number; modelUnits: number }>;
  cycleModel?: { label: string; volumeVariationPercent: number; note: string };
  cargoDemands: Array<{ requestId: string; origin: string; destination: string; quantity: number; cargoType: string; deadline: number; originRegionId?: string; destinationRegionId?: string; tradeLaneId?: string }>;
  fleetCount: number;
  routePreviewOnly: true;
}

interface ScenarioOption {
  id: string;
  number: number;
  name: string;
  summary: string;
  flowCount: number;
  continuous: boolean;
  regionCount: number;
}

type Port = { portId: string; name: string; country: string; regionId: string };

function portName(nodeId: string, ports: Port[]): string {
  const portId = nodeId.startsWith('node-') ? nodeId.slice(5) : nodeId;
  const port = ports.find(item => item.portId === portId);
  return port ? `${port.name}, ${port.country}` : portId;
}

function regionName(regionId: string | undefined): string {
  return regionId?.replace(/-/g, ' ').replace(/\b\w/g, character => character.toUpperCase()) ?? 'Regional';
}

async function fetchScenario(scenarioId: string): Promise<ScenarioPlan> {
  const response = await fetch(`${API}/ds/scenario?scenarioId=${encodeURIComponent(scenarioId)}`);
  if (!response.ok) throw new Error('Could not load the fixed scenario plan');
  return response.json() as Promise<ScenarioPlan>;
}

async function responseError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => ({})) as { error?: string; message?: string };
  return body.error ?? body.message ?? fallback;
}

export default function NextStopPage({ onBack }: { onBack: () => void }) {
  const [scenario, setScenario] = useState<ScenarioPlan | null>(null);
  const [scenarioOptions, setScenarioOptions] = useState<ScenarioOption[]>([]);
  const [ports, setPorts] = useState<Port[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState('NEXT-STOP-10');
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const [nextScenario, optionsResponse, portsResponse] = await Promise.all([
        fetchScenario(selectedScenarioId),
        fetch(`${API}/ds/scenarios`),
        fetch(`${API}/network/ports`),
      ]);
      setScenario(nextScenario);
      if (optionsResponse.ok) setScenarioOptions(await optionsResponse.json());
      if (portsResponse.ok) setPorts(await portsResponse.json());
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load scenario');
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => { void load(); }, [selectedScenarioId]);

  const applyScenario = async () => {
    setApplying(true);
    try {
      const applyResponse = await fetch(`${API}/ds/scenario/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: selectedScenarioId }),
      });
      if (!applyResponse.ok) throw new Error(await responseError(applyResponse, 'Could not apply this trade plan'));
      const initializeResponse = await fetch(`${API}/simulation/initialize`, { method: 'POST' });
      if (!initializeResponse.ok) throw new Error(await responseError(initializeResponse, 'Trade plan was applied, but the simulation could not initialize'));
      onBack();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Could not initialize scenario');
    } finally {
      setApplying(false);
    }
  };

  if (!scenario) return <main className="next-stop-page"><p className="eyebrow">NEXT STOP / SCENARIO PLANNER</p><h1>Loading trade scenario</h1>{error && <p className="page-error">{error}</p>}</main>;

  return <main className="next-stop-page">
    <header className="page-topline">
      <button className="page-back" onClick={onBack} aria-label="Back to operations"><ArrowLeft size={17} /><span>Operations</span></button>
      <div className="page-product"><Compass size={16} /><span>NEXT STOP</span><i>{scenario.continuous ? 'CONTINUOUS MODE' : 'FIXED SCENARIO MODE'}</i></div>
      <button className="page-icon-button" onClick={() => void load()} disabled={refreshing} title="Refresh scenario" aria-label="Refresh scenario"><RefreshCw size={16} /></button>
    </header>
    <section className="scenario-picker" aria-label="Scenario selection">
      <label htmlFor="scenario-select">Scenario</label>
      <select id="scenario-select" value={selectedScenarioId} onChange={event => setSelectedScenarioId(event.target.value)}>
        {scenarioOptions.map(option => <option key={option.id} value={option.id}>{String(option.number).padStart(2, '0')} · {option.name}{option.continuous ? ' · Continuous' : ''}</option>)}
      </select>
      <span>{scenarioOptions.length} trade plans · includes one continuous global cycle</span>
    </section>
    <section className="scenario-hero">
      <div className="scenario-globe"><Globe2 size={24} /><span>{scenario.id} / {scenario.continuous ? 'GLOBAL TRADE CYCLE' : 'TRADE PLAN'}</span></div>
      <p className="eyebrow">DEMAND & SUPPLY SCENARIO</p>
      <h1>{scenario.name}</h1>
      <p className="scenario-summary">{scenario.summary}</p>
      <div className="scenario-hero-footer"><span><GitBranch size={15} /> {scenario.cargoDemands.length} planned movements</span><span><Ship size={15} /> {scenario.fleetCount} model vessels</span><button className="scenario-launch" onClick={() => void applyScenario()} disabled={applying}>{applying ? 'Preparing trade routes…' : 'Use this scenario'}<ArrowRight size={16} /></button></div>
      {applying && <p className="scenario-progress" role="status">Preparing the route map and checking that each modeled sea lane clears the coastline dataset.</p>}
    </section>
    {error && <p className="page-error">{error}</p>}
    <section className="scenario-meta-grid">
      <article><span className="meta-index">01 / MODEL</span><h2>{scenario.continuous ? 'Balanced trade cycle' : 'Illustrative trade plan'}</h2><p>{scenario.continuous ? scenario.cycleModel?.note : 'Human-authored lane assumptions form a clear, repeatable scenario.'}</p></article>
      <article><span className="meta-index">02 / SOURCE</span><h2>Port identities</h2><p>{scenario.sourceNote}</p></article>
      <article><span className="meta-index">03 / REGIONS</span><h2>{new Set(scenario.cargoDemands.flatMap(demand => [demand.originRegionId, demand.destinationRegionId]).filter(Boolean)).size} market regions</h2><p>Rycon planning groups based on port country. They are not official trade blocs.</p></article>
      <article><span className="meta-index">04 / BUILT</span><h2>{new Date(scenario.generatedAt).toLocaleString()}</h2><p>Generated by fixed rules on this server.</p></article>
    </section>
    <section className="scenario-region-summary" aria-label="Regional trade coverage">
      <header><div><p className="eyebrow">REGIONAL COVERAGE</p><h2>Trade flows by origin market</h2></div><span>Scenario units are illustrative</span></header>
      <div className="scenario-region-grid">{scenario.regionBreakdown.map(region => <article key={region.regionId}>
        <strong>{region.regionName}</strong><span>{region.flowCount} flows</span><small>{region.modelUnits.toLocaleString()} model units outbound</small>
      </article>)}</div>
      {scenario.cycleModel && <p className="scenario-cycle-note">Continuous loop: balanced return lanes, deterministic volume variation up to ±{scenario.cycleModel.volumeVariationPercent}%, and a running simulation clock.</p>}
    </section>
    <section className="scenario-content-grid">
      <div className="scenario-flow-section">
        <header className="section-title-line"><div><p className="eyebrow">PLANNED MOVEMENTS</p><h2>Trade flow register</h2></div><span>{scenario.cargoDemands.length} FLOWS</span></header>
        <div className="scenario-flow-list">{scenario.cargoDemands.map((demand, index) => <article className="scenario-flow" key={demand.requestId}>
          <span className="flow-number">{String(index + 1).padStart(2, '0')}</span>
          <div className="flow-route"><strong>{portName(demand.origin, ports)}</strong><ArrowRight size={14} /><strong>{portName(demand.destination, ports)}</strong><small>{regionName(demand.originRegionId)} → {regionName(demand.destinationRegionId)} · {demand.cargoType.replace(/_/g, ' ')}</small></div>
          <div className="flow-volume"><strong>{demand.quantity.toLocaleString()}</strong><small>scenario units</small></div>
        </article>)}</div>
      </div>
      <aside className="scenario-reasoning">
        <p className="eyebrow">WHY THESE MOVEMENTS</p><h2>Scenario rationale</h2>
        <ol>{scenario.rationale.map(item => <li key={item}>{item}</li>)}</ol>
        <div className="reasoning-notes"><h3>Assumptions</h3>{scenario.assumptions.map(item => <p key={item}>{item}</p>)}<h3>Known limits</h3>{scenario.limitations.map(item => <p key={item}>{item}</p>)}</div>
      </aside>
    </section>
    <footer className="scenario-footer">NEXT STOP · WPI PORT IDENTITIES · HUMAN-AUTHORED TRADE ASSUMPTIONS · NO LIVE TRADE FEED</footer>
  </main>;
}
