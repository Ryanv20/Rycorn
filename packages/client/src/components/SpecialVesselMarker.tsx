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
  previewSpeedKnots: number;
  coordinates: [number, number][];
  fixtureNotice: string;
}

const KILOMETRES_PER_NAUTICAL_MILE = 1.852;
const SIMULATED_HOURS_PER_WALL_SECOND: Record<string, number> = {
  REAL_TIME: 1 / 3600,
  HOUR_PER_SECOND: 1,
  DAY_PER_MINUTE: 0.4,
  FAST_REVIEW: 24,
  MINUTE_PER_SECOND: 1 / 60,
  SIX_HOURS_PER_SECOND: 6,
  WEEK_PER_SECOND: 168,
};

function segmentDistanceNauticalMiles(from: [number, number], to: [number, number]): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (to[0] - from[0]) * radians;
  const longitudeDelta = (to[1] - from[1]) * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(from[0] * radians) * Math.cos(to[0] * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)) / KILOMETRES_PER_NAUTICAL_MILE;
}

function positionAtDistance(route: [number, number][], segmentLengths: number[], distance: number): [number, number] {
  let remaining = distance;
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index];
    const from = route[index];
    const to = route[index + 1];
    if (!from || !to) continue;
    if (remaining <= segmentLength || index === segmentLengths.length - 1) {
      const fraction = segmentLength === 0 ? 0 : Math.min(remaining / segmentLength, 1);
      let toLongitude = to[1];
      if (Math.abs(toLongitude - from[1]) > 180) toLongitude += from[1] > 0 ? -360 : 360;
      const longitude = from[1] + (toLongitude - from[1]) * fraction;
      return [
        from[0] + (to[0] - from[0]) * fraction,
        ((longitude + 540) % 360) - 180,
      ];
    }
    remaining -= segmentLength;
  }
  return route[route.length - 1] ?? [0, 0];
}

export default function SpecialVesselMarker({ vessel, simulationTimeHours, running, clockProfileId }: {
  vessel: SpecialVesselRecord;
  simulationTimeHours: number;
  running: boolean;
  clockProfileId?: string;
}) {
  const route = vessel.coordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number]);
  const previewSpeedKnots = vessel.previewSpeedKnots;
  const [position, setPosition] = useState<[number, number] | null>(route[0] ?? null);
  const icon = useMemo(() => new DivIcon({
    className: 'special-ship-avatar',
    html: '<span class="special-ship-symbol" aria-hidden="true"><img src="/visual_component/icons/special-vessel.svg" alt="" /></span>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  }), []);

  useEffect(() => {
    if (route.length < 2) return;
    const segmentLengths = route.slice(1).map((point, index) => segmentDistanceNauticalMiles(route[index]!, point));
    const oneWayDistance = segmentLengths.reduce((total, length) => total + length, 0);
    if (oneWayDistance === 0) return;

    let frame = 0;
    let lastPaint = 0;
    const startedAt = performance.now();
    const hoursPerWallSecond = SIMULATED_HOURS_PER_WALL_SECOND[clockProfileId ?? 'HOUR_PER_SECOND'] ?? 1;
    const updatePosition = (now: number) => {
      const elapsedWallSeconds = running ? (now - startedAt) / 1000 : 0;
      const modeledHours = Math.max(0, simulationTimeHours + elapsedWallSeconds * hoursPerWallSecond);
      const traveledNauticalMiles = modeledHours * previewSpeedKnots;
      const roundTripDistance = oneWayDistance * 2;
      const cycleDistance = traveledNauticalMiles % roundTripDistance;
      const distanceAlongRoute = cycleDistance <= oneWayDistance
        ? cycleDistance
        : roundTripDistance - cycleDistance;
      setPosition(positionAtDistance(route, segmentLengths, distanceAlongRoute));
    };

    updatePosition(startedAt);
    if (!running) return;
    const animate = (now: number) => {
      if (now - lastPaint >= 40) {
        lastPaint = now;
        updatePosition(now);
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [vessel.coordinates, previewSpeedKnots, simulationTimeHours, running, clockProfileId]);

  if (!position) return null;
  return <Marker position={position} icon={icon}>
    <Popup>
      <strong>{vessel.name}</strong><br />
      Special class · {vessel.sector}<br />
      Status: {vessel.status}<br />
      Illustrative motion: {previewSpeedKnots} kn · follows simulation clock<br />
      {vessel.fixtureNotice}
    </Popup>
  </Marker>;
}
