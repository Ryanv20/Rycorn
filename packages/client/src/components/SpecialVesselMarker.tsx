import { DivIcon } from 'leaflet';
import { useEffect, useMemo, useState } from 'react';
import { Marker, Popup } from 'react-leaflet';

export interface SpecialVesselRecord {
  id: string;
  name: string;
  sector: string;
  originName: string;
  destinationName: string;
  status: string;
  coordinates: [number, number][];
  fixtureNotice: string;
}

export default function SpecialVesselMarker({ vessel }: { vessel: SpecialVesselRecord }) {
  const route = vessel.coordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number]);
  const [position, setPosition] = useState<[number, number] | null>(route[0] ?? null);
  const icon = useMemo(() => new DivIcon({
    className: 'special-ship-avatar',
    html: '<span class="special-ship-symbol" aria-hidden="true">✦</span>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  }), []);

  useEffect(() => {
    if (route.length < 2) return;
    let frame = 0;
    let lastPaint = 0;
    const startedAt = performance.now();
    const cycleMs = 80000;
    const animate = (now: number) => {
      const cycle = ((now - startedAt) % cycleMs) / cycleMs;
      const progress = cycle <= 0.5 ? cycle * 2 : (1 - cycle) * 2;
      const segmentPosition = progress * (route.length - 1);
      const segmentIndex = Math.min(Math.floor(segmentPosition), route.length - 2);
      const segmentProgress = segmentPosition - segmentIndex;
      const from = route[segmentIndex] ?? route[0];
      const to = route[segmentIndex + 1] ?? route[route.length - 1];
      if (!from || !to) return;
      if (now - lastPaint >= 40) {
        lastPaint = now;
        setPosition([
          from[0] + (to[0] - from[0]) * segmentProgress,
          from[1] + (to[1] - from[1]) * segmentProgress,
        ]);
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [vessel.coordinates]);

  if (!position) return null;
  return <Marker position={position} icon={icon}>
    <Popup>
      <strong>{vessel.name}</strong><br />
      Special class · {vessel.sector}<br />
      Status: {vessel.status}<br />
      {vessel.fixtureNotice}
    </Popup>
  </Marker>;
}
