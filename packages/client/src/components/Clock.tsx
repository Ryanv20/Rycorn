import { Clock3 } from 'lucide-react';

interface ClockProps {
  simulationTime: number;
  timeMetadata: { observedAtUtc: string; observedAtSource: string } | null;
}

export default function Clock({ simulationTime, timeMetadata }: ClockProps) {
  const observedAtUtc = timeMetadata
    ? new Date(timeMetadata.observedAtUtc).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
    : 'Waiting for simulation event';

  return (
    <div className="clock-display" title={`Server source: ${timeMetadata?.observedAtSource ?? 'server-host-system-clock'}`}>
      <Clock3 size={15} />
      <div><strong>T+{simulationTime.toFixed(2)} h</strong><small>{observedAtUtc}</small></div>
    </div>
  );
}
