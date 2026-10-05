import { useEffect, useState } from 'react';
import { ArrowLeft, Crosshair, Shield, Ship } from 'lucide-react';
import type { SpecialVesselRecord } from './SpecialVesselMarker';
import { API } from '../api';


export default function SpecialClassPage({ onBack }: { onBack: () => void }) {
  const [vessels, setVessels] = useState<SpecialVesselRecord[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(`${API}/network/special-vessels`)
      .then(response => {
        if (!response.ok) throw new Error('Special-class units are unavailable');
        return response.json();
      })
      .then(setVessels)
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : 'Could not load special units'));
  }, []);

  return <main className="special-page">
    <header className="page-topline"><button className="page-back" onClick={onBack}><ArrowLeft size={17} /><span>Operations</span></button><div className="page-product"><Shield size={16} /><span>SPECIAL CLASS</span></div><span className="special-fleet-count">{vessels.length.toString().padStart(2, '0')} UNITS</span></header>
    <section className="special-page-heading"><p className="eyebrow">SEPARATE FROM COMMERCIAL FLEET</p><h1>Special-class<br />patrol units</h1><p>Seven fictional, mobile map fixtures. These units do not transport cargo and are not real military or AIS tracks.</p></section>
    {error && <p className="page-error">{error}</p>}
    <section className="special-grid">{vessels.map((vessel, index) => <article className="special-card" key={vessel.id}>
      <header><span className="special-card-index">{String(index + 1).padStart(2, '0')}</span><span className="special-live"><i /> PATROL LOOP</span></header>
      <div className="special-emblem"><Ship size={23} /></div>
      <p className="eyebrow">{vessel.sector.toUpperCase()}</p>
      <h2>{vessel.name}</h2>
      <div className="special-detail"><span>Class</span><strong>SPECIAL</strong></div>
      <div className="special-detail"><span>Patrol preview</span><strong>{vessel.originName} ↔ {vessel.destinationName}</strong></div>
      <footer><Crosshair size={14} /><span>Illustrative sea-lane animation</span></footer>
    </article>)}</section>
    <p className="special-disclaimer">All seven identities and moving positions are synthetic presentation fixtures. They are excluded from cargo assignment, transport capacity, and simulation event history.</p>
  </main>;
}
