import { DivIcon } from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';

const clockRates: Record<string, number> = {
  REAL_TIME: 1 / 3600,
  HOUR_PER_SECOND: 1,
  DAY_PER_MINUTE: 0.4,
  FAST_REVIEW: 24,
  MINUTE_PER_SECOND: 1 / 60,
  SIX_HOURS_PER_SECOND: 6,
  WEEK_PER_SECOND: 168,
};

type Point = [number, number];

function escapeHtml(value: string): string {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return value.replace(/[&<>"']/g, character => entities[character]);
}

function getCoordinates(node: any): Point | null {
  if (!node) return null;
  const latitude = node.position?.latitude ?? node.latitude;
  const longitude = node.position?.longitude ?? node.longitude;
  return typeof latitude === 'number' && typeof longitude === 'number' ? [latitude, longitude] : null;
}

function distanceKm(from: Point, to: Point): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (to[0] - from[0]) * radians;
  const longitudeDelta = (to[1] - from[1]) * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(from[0] * radians) * Math.cos(to[0] * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function pointAlongRoute(points: Point[], progress: number): Point | null {
  if (points.length === 0) return null;
  if (points.length === 1 || progress >= 1) return points[points.length - 1];
  if (progress <= 0) return points[0];
  const segmentLengths = points.slice(1).map((point, index) => distanceKm(points[index], point));
  const routeLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  if (routeLength === 0) return points[points.length - 1];
  let distanceRemaining = routeLength * progress;
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index];
    if (distanceRemaining <= segmentLength || index === segmentLengths.length - 1) {
      const fraction = segmentLength === 0 ? 1 : Math.min(1, distanceRemaining / segmentLength);
      const [fromLatitude, fromLongitude] = points[index];
      const [toLatitude, toLongitude] = points[index + 1];
      const longitudeDelta = ((toLongitude - fromLongitude + 540) % 360) - 180;
      let longitude = fromLongitude + longitudeDelta * fraction;
      if (longitude > 180) longitude -= 360;
      if (longitude < -180) longitude += 360;
      return [fromLatitude + (toLatitude - fromLatitude) * fraction, longitude];
    }
    distanceRemaining -= segmentLength;
  }
  return points[points.length - 1];
}

export default function VesselMarker({ vessel, nodes, vesselIndex, selected, onSelect, simulationTimeHours, simulationRunning, clockProfileId }: {
  vessel: any;
  nodes: any[];
  vesselIndex: number;
  selected: boolean;
  onSelect: () => void;
  simulationTimeHours: number;
  simulationRunning: boolean;
  clockProfileId?: string;
}) {
  const routePoints = (vessel.currentRoute?.path ?? [])
    .map((nodeId: string) => getCoordinates(nodes.find(node => node.id === nodeId)))
    .filter((point: Point | null): point is Point => point !== null);
  const currentPoint = getCoordinates(nodes.find(node => node.id === vessel.currentNodeId));
  const [position, setPosition] = useState<Point | null>(currentPoint);
  const positionRef = useRef<Point | null>(currentPoint);
  const animationFrame = useRef<number | null>(null);
  const lastPaint = useRef(0);
  const clockRate = clockRates[clockProfileId ?? 'HOUR_PER_SECOND'] ?? 1;
  const voyageKey = `${vessel.vesselId}:${(vessel.currentRoute?.path ?? []).join('|')}:${vessel.currentVoyageStartedAt ?? ''}:${vessel.expectedArrivalAt ?? ''}`;
  const voyageAnchor = useRef({ key: '', startedAt: simulationTimeHours });
  const voyageProgress = useRef({ key: '', progress: 0 });
  const simulationCursor = useRef({
    serverHours: simulationTimeHours,
    visualHours: simulationTimeHours,
    lastFrameAt: performance.now(),
    running: simulationRunning,
    rate: clockRate,
  });

  useEffect(() => {
    const cursor = simulationCursor.current;
    if (cursor.serverHours !== simulationTimeHours) cursor.visualHours = simulationTimeHours;
    cursor.serverHours = simulationTimeHours;
    cursor.running = simulationRunning;
    cursor.rate = clockRate;
    cursor.lastFrameAt = performance.now();
  }, [simulationTimeHours, simulationRunning, clockRate]);

  const updatePosition = (nextPosition: Point) => {
    positionRef.current = nextPosition;
    const now = performance.now();
    if (now - lastPaint.current >= 32 || now === 0) {
      lastPaint.current = now;
      setPosition(nextPosition);
    }
  };

  useEffect(() => {
    if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current);
    const underway = vessel.status === 'SAILING' || vessel.status === 'REPOSITIONING';
    if (!underway || routePoints.length < 2) {
      if (vessel.status === 'ARRIVED' && routePoints.length > 1) {
        const destination = routePoints[routePoints.length - 1];
        if (destination) updatePosition(destination);
      } else if (currentPoint) {
        updatePosition(currentPoint);
      }
      return;
    }

    const animate = (now: number) => {
      const cursor = simulationCursor.current;
      if (voyageAnchor.current.key !== voyageKey) {
        voyageAnchor.current = {
          key: voyageKey,
          startedAt: vessel.currentVoyageStartedAt ?? cursor.serverHours,
        };
        voyageProgress.current = { key: voyageKey, progress: 0 };
      }
      if (cursor.running) cursor.visualHours += Math.max(0, now - cursor.lastFrameAt) / 1000 * cursor.rate;
      cursor.lastFrameAt = now;
      // Keep an inferred departure time stable across server state updates. Using
      // cursor.serverHours here would reset progress to zero after every event.
      const startsAt = vessel.currentVoyageStartedAt ?? voyageAnchor.current.startedAt;
      const arrivesAt = vessel.expectedArrivalAt ?? startsAt + 1;
      const clockProgress = arrivesAt <= startsAt ? 1 : Math.max(0, Math.min(1, (cursor.visualHours - startsAt) / (arrivesAt - startsAt)));
      // Server event times can arrive in bursts or be corrected backward. Keep
      // the marker moving forward during this voyage instead of visibly looping.
      voyageProgress.current.progress = Math.max(voyageProgress.current.progress, clockProgress);
      const progress = voyageProgress.current.progress;
      const nextPosition = pointAlongRoute(routePoints, progress);
      if (nextPosition) updatePosition(nextPosition);
      if (cursor.running) animationFrame.current = requestAnimationFrame(animate);
    };

    animate(performance.now());
    return () => {
      if (animationFrame.current !== null) cancelAnimationFrame(animationFrame.current);
    };
  }, [vessel.vesselId, vessel.status, vessel.currentNodeId, voyageKey, vessel.currentVoyageStartedAt, vessel.expectedArrivalAt, simulationRunning, simulationTimeHours, nodes.length]);

  if (!position) return null;

  const offset = vesselIndex % 3 - 1;
  const displayPosition: Point = [position[0] + offset * 0.18, position[1] + offset * 0.22];
  const icon = new DivIcon({
    className: `ship-avatar ${selected ? 'is-selected' : ''}`,
    html: `<span class="ship-symbol" title="${escapeHtml(String(vessel.vesselId))}"><img src="/visual_component/icons/ship.svg" alt="" /></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

  return <Marker position={displayPosition} icon={icon} eventHandlers={{ click: onSelect }}>
    {selected && <Tooltip permanent direction="top" offset={[0, -15]} className="ship-name-label">{vessel.vesselId}</Tooltip>}
    <Popup>
      <strong>{vessel.vesselId}</strong><br />
      Status: {vessel.status === 'REPOSITIONING' ? 'Repositioning without cargo' : vessel.status}<br />
      Class: {vessel.vesselCapability}
    </Popup>
  </Marker>;
}
