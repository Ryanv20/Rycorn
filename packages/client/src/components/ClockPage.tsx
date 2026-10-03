import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarClock, Clock3, Gauge, Info } from 'lucide-react';

const API = 'http://127.0.0.1:3000';
const clockProfiles = [
  { id: 'REAL_TIME', label: 'RTS · Real time', rate: '1 sim hour / 1 real hour', detail: 'Use for live-pace operations and comparing the model with the wall clock.' },
  { id: 'HOUR_PER_SECOND', label: 'Hour / second', rate: '1 sim hour / 1 real second', detail: 'Default review pace; a modeled day takes 24 seconds.' },
  { id: 'DAY_PER_MINUTE', label: 'Day / minute', rate: '1 sim day / 1 real minute', detail: 'Slower, readable playback for observing multi-day journeys.' },
  { id: 'FAST_REVIEW', label: 'Fast review', rate: '1 sim day / 1 real second', detail: 'Rapidly run scenario batches; event order and modeled durations are preserved.' },
] as const;

interface ClockPageProps {
  onBack: () => void;
  simulationTimeHours: number;
  timeMetadata: { observedAtUtc: string; observedAtSource: string } | null;
  startedAt: number | null;
  running: boolean;
  activeProfileId?: string;
}

function formatDuration(hours: number): string {
  const totalMinutes = Math.max(0, Math.floor(hours * 60));
  const days = Math.floor(totalMinutes / 1440);
  const remainingHours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${String(remainingHours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
}

export default function ClockPage({ onBack, simulationTimeHours, timeMetadata, startedAt, running, activeProfileId = 'HOUR_PER_SECOND' }: ClockPageProps) {
  const [now, setNow] = useState(() => Date.now());
  const [selectedProfile, setSelectedProfile] = useState(activeProfileId);
  const [profileError, setProfileError] = useState('');
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const wallElapsedHours = startedAt ? (now - startedAt) / 3_600_000 : 0;
  const dilation = wallElapsedHours > 0 ? simulationTimeHours / wallElapsedHours : 0;
  const observation = timeMetadata ? new Date(timeMetadata.observedAtUtc) : null;

  const selectProfile = async (profileId: string) => {
    setProfileError('');
    try {
      const response = await fetch(`${API}/simulation/clock-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      });
      if (!response.ok) throw new Error('Could not change clock profile');
      setSelectedProfile(profileId);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not change clock profile');
    }
  };

  return <main className="clock-page">
    <header className="page-topline"><button className="page-back" onClick={onBack}><ArrowLeft size={17} /><span>Operations</span></button><div className="page-product"><CalendarClock size={16} /><span>RYCORN TIME</span></div><span className={`clock-state ${running ? 'is-running' : ''}`}>{running ? 'ENGINE RUNNING' : 'ENGINE PAUSED'}</span></header>
    <section className="clock-page-heading"><p className="eyebrow">TIME MODEL / TWO DISTINCT CLOCKS</p><h1>One simulation.<br />Two notions of now.</h1><p>The event engine advances modeled hours. The server clock records when Rycon observed each event. They are related for comparison, not interchangeable.</p></section>
    <section className="clock-cards">
      <article className="clock-card clock-card-simulation"><header><span><Clock3 size={17} /> SIMULATION CLOCK</span><i>FISCAL / MODELED</i></header><strong className="clock-value">T+{simulationTimeHours.toFixed(2)}<small>hours</small></strong><p>{formatDuration(simulationTimeHours)} modeled elapsed time</p><div className="clock-card-source"><b>Source</b><span>Engine event queue: loading, unloading, travel durations, and configured delays.</span></div></article>
      <article className="clock-card clock-card-world"><header><span><CalendarClock size={17} /> WORLD CLOCK</span><i>SERVER UTC</i></header><strong className="clock-value clock-utc">{new Date(now).toISOString().slice(11, 19)}<small>UTC</small></strong><p>{new Date(now).toISOString().slice(0, 10)} · current server wall time</p><div className="clock-card-source"><b>Source</b><span>{timeMetadata?.observedAtSource ?? 'server-host-system-clock'} using Date.now().</span></div></article>
    </section>
    <section className="clock-comparison">
      <header><div><p className="eyebrow">COMPARISON ONLY</p><h2>Observed run rate</h2></div><Gauge size={19} /></header>
      <div className="clock-comparison-values"><strong>{dilation.toFixed(2)}×</strong><span>modeled hours per wall-clock hour since initialization</span></div>
      <div className="clock-meter"><i style={{ width: `${Math.min(100, dilation / 10 * 100)}%` }} /></div>
      <p>This ratio is descriptive. It does not affect event scheduling, imply a calendar date for simulated events, or claim real-world operational performance.</p>
    </section>
    <section className="clock-profile-section">
      <header><div><p className="eyebrow">RATE OPTIONS / RTS</p><h2>Choose how fast modeled time advances</h2></div><span>ACTIVE · {clockProfiles.find(profile => profile.id === selectedProfile)?.label}</span></header>
      <div className="clock-profile-options" role="radiogroup" aria-label="Simulation time rate">
        {clockProfiles.map(profile => <button key={profile.id} role="radio" aria-checked={selectedProfile === profile.id} className={selectedProfile === profile.id ? 'is-selected' : ''} onClick={() => void selectProfile(profile.id)}>
          <span className="clock-profile-check" />
          <strong>{profile.label}</strong>
          <b>{profile.rate}</b>
          <small>{profile.detail}</small>
        </button>)}
      </div>
      {profileError && <p className="page-error">{profileError}</p>}
    </section>
    <section className="clock-notes"><article><Info size={16} /><div><h3>How travel time is calculated</h3><p>Route distance comes from network edge lengths. Nominal vessel speed converts distance into modeled hours; loading, unloading, and configured port delays are added separately.</p></div></article><article><Info size={16} /><div><h3>What a future calendar needs</h3><p>A calendar anchor, timezone policy, and explicit simulation rate are not currently configured. Until then, UTC is an observation timestamp only.</p></div></article></section>
    <footer className="scenario-footer">LAST EVENT OBSERVATION · {observation ? observation.toISOString() : 'NO EVENT OBSERVED'}</footer>
  </main>;
}
