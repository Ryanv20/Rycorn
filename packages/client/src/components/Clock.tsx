import { Activity, Clock3, Globe2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { API } from '../api';

interface ClockProps {
  simulationTime: number;
  timeMetadata: { observedAtUtc: string; observedAtSource: string } | null;
  running: boolean;
  profileId?: string;
}

const clockRates: Record<string, number> = {
  REAL_TIME: 1 / 3600,
  HOUR_PER_SECOND: 1,
  DAY_PER_MINUTE: 0.4,
  FAST_REVIEW: 24,
  MINUTE_PER_SECOND: 1 / 60,
  SIX_HOURS_PER_SECOND: 6,
  WEEK_PER_SECOND: 168,
};

export default function Clock({ simulationTime, timeMetadata, running, profileId }: ClockProps) {
  const [now, setNow] = useState(() => Date.now());
  const [profileError, setProfileError] = useState('');
  const [changingProfile, setChangingProfile] = useState(false);
  const clockAnchor = useRef({ simulationTime, timestamp: Date.now() });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    clockAnchor.current = { simulationTime, timestamp: Date.now() };
  }, [simulationTime, running, profileId]);

  const observedAt = timeMetadata ? Date.parse(timeMetadata.observedAtUtc) : Number.NaN;
  const elapsedMs = Number.isFinite(observedAt) ? Math.max(0, now - observedAt) : 0;
  const utcNow = Number.isFinite(observedAt) ? new Date(observedAt + elapsedMs) : null;
  const simHours = simulationTime + (running ? Math.max(0, now - clockAnchor.current.timestamp) / 3_600_000 * (clockRates[profileId ?? 'HOUR_PER_SECOND'] ?? 1) : 0);
  const observedAtUtc = utcNow
    ? utcNow.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
    : 'Waiting for simulation event';

  const changeProfile = async (nextProfile: string) => {
    setChangingProfile(true);
    setProfileError('');
    try {
      const response = await fetch(`${API}/simulation/clock-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: nextProfile }),
      });
      if (!response.ok) throw new Error('Clock rate update failed');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Clock rate update failed');
    } finally {
      setChangingProfile(false);
    }
  };

  return (
    <section className={`live-clock ${running ? 'is-running' : 'is-paused'}`} title={`Server source: ${timeMetadata?.observedAtSource ?? 'server-host-system-clock'}`}>
      <header><span><Clock3 size={15} /> LIVE CLOCK</span><i><b />{running ? 'RUNNING' : 'PAUSED'}</i></header>
      <div className="live-clock-readout"><strong>T+{simHours.toFixed(2)}</strong><small>SIM HOURS</small></div>
      <div className="live-clock-track"><i /></div>
      <div className="live-clock-world"><Globe2 size={13} /><span>{observedAtUtc}</span><Activity size={13} className="live-clock-pulse" /></div>
      <div className="live-clock-controls">
        <label htmlFor="rail-clock-rate">RATE</label>
        <select id="rail-clock-rate" value={profileId ?? 'HOUR_PER_SECOND'} disabled={changingProfile} onChange={event => void changeProfile(event.target.value)}>
          <option value="REAL_TIME">Real time</option>
          <option value="MINUTE_PER_SECOND">Minute / second</option>
          <option value="HOUR_PER_SECOND">Hour / second</option>
          <option value="DAY_PER_MINUTE">Day / minute</option>
          <option value="SIX_HOURS_PER_SECOND">6 hours / second</option>
          <option value="FAST_REVIEW">Day / second</option>
          <option value="WEEK_PER_SECOND">Week / second</option>
        </select>
      </div>
      {profileError && <small className="live-clock-error" role="alert">{profileError}</small>}
      <footer><span className="live-clock-signal">WORLD SYNC</span></footer>
    </section>
  );
}
