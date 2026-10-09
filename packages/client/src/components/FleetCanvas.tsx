import { useEffect, useMemo, useRef } from 'react';
import { useMap } from 'react-leaflet';

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
interface RouteTrack { points: Point[]; cumulativeKm: number[]; totalKm: number; }

interface FleetCanvasProps {
  vessels: any[];
  nodes: any[];
  simulationTimeHours: number;
  simulationRunning: boolean;
  clockProfileId?: string;
  selectedVesselId: string | null;
  cameraFollow: boolean;
  followPoint: Point | null;
  showShips: boolean;
  onSelectVessel: (vesselId: string) => void;
}

function nodePoint(node: any): Point | null {
  if (!node) return null;
  const lat = node.position?.latitude ?? node.latitude;
  const lng = node.position?.longitude ?? node.longitude;
  return typeof lat === 'number' && typeof lng === 'number' ? [lat, lng] : null;
}

function distanceKm(from: Point, to: Point): number {
  const radians = Math.PI / 180;
  const lat1 = from[0] * radians;
  const lat2 = to[0] * radians;
  const dLat = (to[0] - from[0]) * radians;
  const dLng = (to[1] - from[1]) * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function makeRouteTrack(points: Point[]): RouteTrack {
  const cumulativeKm = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulativeKm.push(cumulativeKm[index - 1] + distanceKm(points[index - 1], points[index]));
  }
  return { points, cumulativeKm, totalKm: cumulativeKm[cumulativeKm.length - 1] ?? 0 };
}

function pointAlongRoute(route: RouteTrack, progress: number): Point | null {
  const { points, cumulativeKm, totalKm } = route;
  if (!points.length) return null;
  if (points.length === 1 || progress >= 1) return points[points.length - 1];
  if (progress <= 0) return points[0];
  if (!totalKm) return points[points.length - 1];
  const targetKm = totalKm * progress;
  for (let i = 1; i < cumulativeKm.length; i += 1) {
    if (targetKm <= cumulativeKm[i] || i === cumulativeKm.length - 1) {
      const segmentLength = cumulativeKm[i] - cumulativeKm[i - 1];
      const fraction = segmentLength ? Math.min(1, (targetKm - cumulativeKm[i - 1]) / segmentLength) : 1;
      const [lat1, lng1] = points[i - 1];
      const [lat2, lng2] = points[i];
      const deltaLng = ((lng2 - lng1 + 540) % 360) - 180;
      const lng = lng1 + deltaLng * fraction;
      return [lat1 + (lat2 - lat1) * fraction, lng > 180 ? lng - 360 : lng < -180 ? lng + 360 : lng];
    }
  }
  return points[points.length - 1];
}

export default function FleetCanvas({ vessels, nodes, simulationTimeHours, simulationRunning, clockProfileId, selectedVesselId, cameraFollow, followPoint, showShips, onSelectVessel }: FleetCanvasProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressRef = useRef(new Map<string, { key: string; start: number; progress: number }>());
  const simAnchor = useRef({ hours: simulationTimeHours, at: performance.now() });
  const hitTargets = useRef<Array<{ id: string; x: number; y: number; point: Point }>>([]);
  const clockRate = clockRates[clockProfileId ?? 'HOUR_PER_SECOND'] ?? 1;
  const nodeIndex = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);
  const fleet = useMemo(() => vessels.map(vessel => {
    const routePoints = (vessel.currentRoute?.path ?? [])
      .map((nodeId: string) => nodePoint(nodeIndex.get(nodeId)))
      .filter((point: Point | null): point is Point => point !== null);
    const current = nodePoint(nodeIndex.get(vessel.currentNodeId));
    const underway = (vessel.status === 'SAILING' || vessel.status === 'REPOSITIONING') && routePoints.length > 1;
    // Route identity is stable for the whole trip. Arrival metadata often
    // arrives one event after the route; including it here restarted progress
    // at zero and made a vessel visibly jump back along its track.
    const key = (vessel.currentRoute?.path ?? []).join('|');
    return { id: vessel.vesselId, vessel, route: makeRouteTrack(routePoints), current, underway, key };
  }), [vessels, nodeIndex]);

  useEffect(() => {
    const liveIds = new Set(fleet.map(item => item.id));
    for (const id of progressRef.current.keys()) if (!liveIds.has(id)) progressRef.current.delete(id);
  }, [fleet]);

  useEffect(() => {
    simAnchor.current = { hours: simulationTimeHours, at: performance.now() };
  }, [simulationTimeHours, simulationRunning, clockRate]);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.className = 'fleet-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:450';
    map.getContainer().appendChild(canvas);
    canvasRef.current = canvas;
    return () => {
      canvas.remove();
      canvasRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    let frame = 0;
    let lastPaint = 0;
    let lastFollow = 0;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    const draw = (now: number) => {
      if (now - lastPaint < 32 && simulationRunning) {
        frame = requestAnimationFrame(draw);
        return;
      }
      lastPaint = now;
      const size = map.getSize();
      const width = Math.max(1, Math.round(size.x * pixelRatio));
      const height = Math.max(1, Math.round(size.y * pixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, size.x, size.y);
      const simHours = simAnchor.current.hours + (simulationRunning ? Math.max(0, now - simAnchor.current.at) / 1000 * clockRate : 0);
      const targets: typeof hitTargets.current = [];
      let followedPoint: Point | null = null;

      for (const item of fleet) {
        let point = item.current;
        if (item.underway) {
          let journey = progressRef.current.get(item.id);
          if (!journey || journey.key !== item.key) {
            journey = { key: item.key, start: item.vessel.currentVoyageStartedAt ?? simHours, progress: 0 };
            progressRef.current.set(item.id, journey);
          }
          if (typeof item.vessel.currentVoyageStartedAt === 'number') journey.start = item.vessel.currentVoyageStartedAt;
          const arrival = item.vessel.expectedArrivalAt ?? journey.start + 1;
          const raw = arrival <= journey.start ? 1 : Math.max(0, Math.min(1, (simHours - journey.start) / (arrival - journey.start)));
          journey.progress = Math.max(journey.progress, raw);
          point = pointAlongRoute(item.route, journey.progress);
        } else if (item.vessel.status === 'ARRIVED' && item.route.points.length > 1) {
          point = item.route.points[item.route.points.length - 1];
        }
        if (!point) continue;

        const screen = map.latLngToContainerPoint(point);
        if (item.id === selectedVesselId) followedPoint = point;
        if (!showShips) continue;
        targets.push({ id: item.id, x: screen.x, y: screen.y, point });
        if (screen.x < -24 || screen.y < -24 || screen.x > size.x + 24 || screen.y > size.y + 24) continue;
        context.save();
        context.translate(screen.x, screen.y);
        const nextPoint = item.underway ? pointAlongRoute(item.route, Math.min(1, (progressRef.current.get(item.id)?.progress ?? 0) + .001)) : null;
        if (nextPoint) {
          const nextScreen = map.latLngToContainerPoint(nextPoint);
          context.rotate(Math.atan2(nextScreen.x - screen.x, screen.y - nextScreen.y));
        }
        const shipColor = item.id === selectedVesselId ? '#ffc18a'
          : item.vessel.status === 'LOADING' || item.vessel.status === 'UNLOADING' ? '#ffc64a'
            : item.vessel.status === 'SAILING' || item.vessel.status === 'REPOSITIONING' ? '#42f0cf'
              : item.vessel.status === 'FAILED' || item.vessel.status === 'CANCELLED' ? '#ff8474' : '#e3f2f2';
        // A dark halo and bright outline keep small vessels legible over both
        // pale map tiles and dense route lines. Keep the geometry compact.
        context.beginPath();
        context.arc(0, 0, item.id === selectedVesselId ? 11 : 9, 0, Math.PI * 2);
        context.fillStyle = 'rgba(5, 19, 27, .82)';
        context.fill();
        context.shadowColor = shipColor;
        context.shadowBlur = 10;
        context.beginPath();
        context.moveTo(0, -9);
        context.lineTo(5.5, -1);
        context.lineTo(-5.5, -1);
        context.closePath();
        context.fillStyle = shipColor;
        context.strokeStyle = '#f4fffc';
        context.lineWidth = 1.2;
        context.fill();
        context.stroke();
        context.fillRect(-3.5, -1, 7, 9);
        context.strokeRect(-3.5, -1, 7, 9);
        context.shadowBlur = 0;
        if (item.id === selectedVesselId) {
          context.beginPath();
          context.arc(0, 0, 9, 0, Math.PI * 2);
          context.strokeStyle = 'rgba(255,193,138,.75)';
          context.lineWidth = 1.5;
          context.stroke();
          context.font = '10px monospace';
          context.textAlign = 'center';
          context.fillStyle = '#effbf7';
          context.fillText(item.id, 0, -13);
        }
        context.restore();
      }
      hitTargets.current = targets;

      const followTarget = followPoint ?? followedPoint;
      if (cameraFollow && followTarget && now - lastFollow > 100) {
        lastFollow = now;
        const target = map.latLngToContainerPoint(followTarget);
        const center = map.getSize().divideBy(2);
        if (target.distanceTo(center) > 1.5) map.panTo(followTarget, { animate: false });
      }
      if (simulationRunning) frame = requestAnimationFrame(draw);
    };

    const redraw = () => {
      if (!simulationRunning) draw(performance.now());
    };
    const selectNearest = (event: any) => {
      const point = map.latLngToContainerPoint(event.latlng);
      let nearest: { id: string; distance: number } | null = null;
      for (const target of hitTargets.current) {
        const distance = Math.hypot(point.x - target.x, point.y - target.y);
        if (distance <= 18 && (!nearest || distance < nearest.distance)) nearest = { id: target.id, distance };
      }
      if (nearest) onSelectVessel(nearest.id);
    };
    map.on('move zoom resize viewreset', redraw);
    map.on('click', selectNearest);
    draw(performance.now());
    return () => {
      cancelAnimationFrame(frame);
      map.off('move zoom resize viewreset', redraw);
      map.off('click', selectNearest);
    };
  }, [map, fleet, simulationTimeHours, simulationRunning, clockRate, selectedVesselId, cameraFollow, followPoint, showShips, onSelectVessel]);

  return null;
}
