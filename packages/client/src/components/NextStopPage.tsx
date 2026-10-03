import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Compass, GitBranch, Globe2, RefreshCw, Ship } from 'lucide-react';

const API = 'http://127.0.0.1:3000';

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
  cargoDemands: Array<{ requestId: string; origin: string; destination: string; quantity: number; cargoType: string; deadline: number }>;
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
}

function portName(nodeId: string): string {
  const known: Record<string, string> = {
    'node-19WPI-59970': 'Shanghai, China',
    'node-19WPI-31140': 'Rotterdam, Netherlands',
    'node-19WPI-50000': 'Singapore',
    'node-19WPI-16080': 'Los Angeles, United States',
    'node-19WPI-46130': 'Lagos, Nigeria',
    'node-19WPI-7640': 'New York, United States',
    'node-19WPI-53650': 'Sydney, Australia',
    'node-19WPI-12970': 'Santos, Brazil',
    'node-19WPI-48840': 'Mumbai, India',
    'node-19WPI-46850': 'Durban, South Africa',
    'node-19WPI-18150': 'Vancouver, Canada',
    'node-19WPI-13760': 'Buenos Aires, Argentina',
  };
  return known[nodeId] ?? nodeId;
}

async function fetchScenario(scenarioId: string): Promise<ScenarioPlan> {
  const response = await fetch(`${API}/ds/scenario?scenarioId=${encodeURIComponent(scenarioId)}`);
  if (!response.ok) throw new Error('Could not load the fixed scenario plan');
  return response.json() as Promise<ScenarioPlan>;
}

export default function NextStopPage({ onBack }: { onBack: () => void }) {
  const [scenario, setScenario] = useState<ScenarioPlan | null>(null);
  const [scenarioOptions, setScenarioOptions] = useState<ScenarioOption[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState('NEXT-STOP-09');
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const [nextScenario, optionsResponse] = await Promise.all([
        fetchScenario(selectedScenarioId),
        fetch(`${API}/ds/scenarios`),
      ]);
      setScenario(nextScenario);
      if (optionsResponse.ok) setScenarioOptions(await optionsResponse.json());
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
      if (!applyResponse.ok) throw new Error('Could not queue this scenario');
      const initializeResponse = await fetch(`${API}/simulation/initialize`, { method: 'POST' });
      if (!initializeResponse.ok) throw new Error('Scenario queued, but simulation initialization failed');
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
      <span>{scenarioOptions.length} fixed plans · #10 repeats continuously</span>
    </section>
    <section className="scenario-hero">
      <div className="scenario-globe"><Globe2 size={24} /><span>{scenario.id} / {scenario.continuous ? 'CONTINUOUS' : 'FIXED PLAN'}</span></div>
      <p className="eyebrow">DEMAND & SUPPLY SCENARIO</p>
      <h1>{scenario.name}</h1>
      <p className="scenario-summary">{scenario.summary}</p>
      <div className="scenario-hero-footer"><span><GitBranch size={15} /> {scenario.cargoDemands.length} planned movements</span><span><Ship size={15} /> {scenario.fleetCount} synthetic vessels</span><button className="scenario-launch" onClick={() => void applyScenario()} disabled={applying}>{applying ? 'Preparing…' : 'Use this scenario'}<ArrowRight size={16} /></button></div>
    </section>
    {error && <p className="page-error">{error}</p>}
    <section className="scenario-meta-grid">
      <article><span className="meta-index">01 / METHOD</span><h2>Fixed rules</h2><p>Human-authored trade rationale and deterministic demand records. Gemini is not connected.</p></article>
      <article><span className="meta-index">02 / SOURCE</span><h2>Port identities</h2><p>{scenario.sourceNote}</p></article>
      <article><span className="meta-index">03 / LIMIT</span><h2>Route preview</h2><p>Generalized sea lanes are visualization aids, not certified navigation instructions.</p></article>
      <article><span className="meta-index">04 / BUILT</span><h2>{new Date(scenario.generatedAt).toLocaleString()}</h2><p>Generated by fixed rules on this server.</p></article>
    </section>
    <section className="scenario-content-grid">
      <div className="scenario-flow-section">
        <header className="section-title-line"><div><p className="eyebrow">PLANNED MOVEMENTS</p><h2>Trade flow register</h2></div><span>{scenario.cargoDemands.length} FLOWS</span></header>
        <div className="scenario-flow-list">{scenario.cargoDemands.map((demand, index) => <article className="scenario-flow" key={demand.requestId}>
          <span className="flow-number">{String(index + 1).padStart(2, '0')}</span>
          <div className="flow-route"><strong>{portName(demand.origin)}</strong><ArrowRight size={14} /><strong>{portName(demand.destination)}</strong><small>{demand.requestId} · {demand.cargoType.replace(/_/g, ' ')}</small></div>
          <div className="flow-volume"><strong>{demand.quantity.toLocaleString()}</strong><small>scenario units</small></div>
        </article>)}</div>
      </div>
      <aside className="scenario-reasoning">
        <p className="eyebrow">WHY THESE MOVEMENTS</p><h2>Scenario rationale</h2>
        <ol>{scenario.rationale.map(item => <li key={item}>{item}</li>)}</ol>
        <div className="reasoning-notes"><h3>Assumptions</h3>{scenario.assumptions.map(item => <p key={item}>{item}</p>)}<h3>Known limits</h3>{scenario.limitations.map(item => <p key={item}>{item}</p>)}</div>
      </aside>
    </section>
    <footer className="scenario-footer">NEXT STOP · FIXED RULES NOW · FUTURE GENERATOR INTEGRATION IS NOT ENABLED</footer>
  </main>;
}
