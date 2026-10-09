import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open } from 'shapefile';
import type { MaritimeNetwork } from '@rycon/engine';

interface Bounds { minX: number; minY: number; maxX: number; maxY: number }
interface LandFeature { feature: any; bounds: Bounds }
interface LandIndex { buckets: Map<string, LandFeature[]> }

const landShapePath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../data/raw/natural-earth/ne_10m_land.shp');
const bucketDegrees = 2;
let landFeaturesPromise: Promise<LandIndex> | undefined;

function extendBounds(geometry: any, bounds: Bounds): void {
  if (typeof geometry?.[0] === 'number' && typeof geometry?.[1] === 'number') {
    bounds.minX = Math.min(bounds.minX, geometry[0]);
    bounds.minY = Math.min(bounds.minY, geometry[1]);
    bounds.maxX = Math.max(bounds.maxX, geometry[0]);
    bounds.maxY = Math.max(bounds.maxY, geometry[1]);
    return;
  }
  if (Array.isArray(geometry)) for (const child of geometry) extendBounds(child, bounds);
}

async function loadLandFeatures(): Promise<LandIndex> {
  if (!landFeaturesPromise) {
    landFeaturesPromise = (async () => {
      const source = await open(landShapePath);
      const buckets = new Map<string, LandFeature[]>();
      while (true) {
        const result = await source.read();
        if (result.done) break;
        const geometry = result.value.geometry;
        const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
        for (const polygon of polygons) {
          const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
          extendBounds(polygon, bounds);
          const item: LandFeature = {
            feature: { type: 'Feature', properties: result.value.properties, geometry: { type: 'Polygon', coordinates: polygon } },
            bounds,
          };
          const minX = Math.floor((bounds.minX + 180) / bucketDegrees);
          const maxX = Math.floor((bounds.maxX + 180) / bucketDegrees);
          const minY = Math.floor((bounds.minY + 90) / bucketDegrees);
          const maxY = Math.floor((bounds.maxY + 90) / bucketDegrees);
          for (let x = minX; x <= maxX; x += 1) {
            for (let y = minY; y <= maxY; y += 1) {
              const key = `${x}:${y}`;
              const bucket = buckets.get(key) ?? [];
              bucket.push(item);
              buckets.set(key, bucket);
            }
          }
        }
      }
      return { buckets };
    })();
  }
  return landFeaturesPromise;
}

function overlaps(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function segmentBounds(a: [number, number], b: [number, number]): Bounds {
  return { minX: Math.min(a[0], b[0]), minY: Math.min(a[1], b[1]), maxX: Math.max(a[0], b[0]), maxY: Math.max(a[1], b[1]) };
}

function distanceKm(a: [number, number], b: [number, number]): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (b[1] - a[1]) * radians;
  const longitudeDelta = (b[0] - a[0]) * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(a[1] * radians) * Math.cos(b[1] * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

// Natural Earth marks canal locks as land, while the sea-route graph intentionally crosses them.
function isKnownCanalTransitSegment(a: [number, number], b: [number, number]): boolean {
  const corridors = [
    {
      widthKm: 15,
      path: [[-79.5, 8.6], [-79.667, 9.2], [-79.667, 9.25], [-80, 9.75]] as [number, number][],
    },
    {
      widthKm: 20,
      path: [[32.1, 31.7], [32.1667, 31], [32.1667, 30.95], [32.6, 29.7], [33.75, 27.9], [34.5, 27]] as [number, number][],
    },
  ];
  const distanceToPathKm = (point: [number, number], path: [number, number][]) => Math.min(...path.slice(1).map((end, index) => {
    const start = path[index];
    const longitudeScale = Math.cos(((point[1] + start[1] + end[1]) / 3) * Math.PI / 180);
    const pointX = point[0] * longitudeScale;
    const startX = start[0] * longitudeScale;
    const deltaX = (end[0] - start[0]) * longitudeScale;
    const deltaY = end[1] - start[1];
    const lengthSquared = deltaX ** 2 + deltaY ** 2;
    const fraction = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
      ((pointX - startX) * deltaX + (point[1] - start[1]) * deltaY) / lengthSquared,
    ));
    return Math.hypot(pointX - (startX + deltaX * fraction), point[1] - (start[1] + deltaY * fraction)) * 111.195;
  }));

  return distanceKm(a, b) <= 180 && corridors.some(corridor =>
    distanceToPathKm(a, corridor.path) <= corridor.widthKm
    && distanceToPathKm(b, corridor.path) <= corridor.widthKm
  );
}

function normalizeLongitude(longitude: number): number {
  return ((longitude + 540) % 360) - 180;
}

function isLand(coordinate: [number, number], land: LandIndex): boolean {
  const [longitude, latitude] = coordinate;
  const key = `${Math.floor((longitude + 180) / bucketDegrees)}:${Math.floor((latitude + 90) / bucketDegrees)}`;
  const candidate = point(coordinate);
  return (land.buckets.get(key) ?? []).some(item =>
    longitude >= item.bounds.minX && longitude <= item.bounds.maxX
    && latitude >= item.bounds.minY && latitude <= item.bounds.maxY
    && booleanPointInPolygon(candidate, item.feature, { ignoreBoundary: true })
  );
}

export async function screenRouteAgainstLand(coordinates: [number, number][]): Promise<{
  clear: boolean;
  dataset: string;
  crossingSegment?: number;
  reason?: string;
  checkedInteriorSamples: number;
  portConnectorExemptionsKm: number[];
}> {
  const land = await loadLandFeatures();
  const maxPortConnectorKm = 100;
  const segmentLengths = coordinates.slice(1).map((coordinate, index) => distanceKm(coordinates[index], coordinate));
  const routeDistanceKm = segmentLengths.reduce((total, segmentLength) => total + segmentLength, 0);
  let traversedKm = 0;
  let crossing: number | undefined;
  let checkedInteriorSamples = 0;
  const portConnectorExemptionsKm: number[] = [];

  for (let index = 0; index < segmentLengths.length && crossing === undefined; index += 1) {
    const from = coordinates[index];
    const to = coordinates[index + 1];
    const segmentLength = segmentLengths[index];
    const distanceAtSegmentEnd = traversedKm + segmentLength;
    if (isKnownCanalTransitSegment(from, to)) {
      traversedKm += segmentLength;
      continue;
    }
    const isPortConnector = index === 0 || index === segmentLengths.length - 1;
    if (isPortConnector && segmentLength <= maxPortConnectorKm) {
      portConnectorExemptionsKm.push(segmentLength);
      traversedKm += segmentLength;
      continue;
    }
    if (isPortConnector) {
      crossing = index;
      break;
    }
    const samples = Math.max(1, Math.ceil(segmentLength / 2));
    let adjustedToLongitude = to[0];
    if (Math.abs(adjustedToLongitude - from[0]) > 180) {
      adjustedToLongitude += from[0] > 0 ? 360 : -360;
    }

    for (let sampleIndex = 0; sampleIndex <= samples; sampleIndex += 1) {
      const fraction = sampleIndex / samples;
      const distanceAlongRoute = traversedKm + segmentLength * fraction;
      if (distanceAlongRoute <= 10 || routeDistanceKm - distanceAlongRoute <= 10) continue;
      const coordinate: [number, number] = [
        normalizeLongitude(from[0] + (adjustedToLongitude - from[0]) * fraction),
        from[1] + (to[1] - from[1]) * fraction,
      ];
      checkedInteriorSamples += 1;
      if (isLand(coordinate, land)) {
        crossing = index;
        break;
      }
    }
    traversedKm = distanceAtSegmentEnd;
  }

  return {
    clear: crossing === undefined,
    dataset: 'Natural Earth 1:10m Land v5.1.1 (2 km interior samples; first/last port connectors up to 100 km exempt)',
    crossingSegment: crossing,
    reason: crossing === undefined ? undefined
      : (crossing === 0 || crossing === segmentLengths.length - 1)
        ? `Port connector exceeds ${maxPortConnectorKm} km`
        : 'Route segment intersects land geometry',
    checkedInteriorSamples,
    portConnectorExemptionsKm,
  };
}

export async function screenNetworkEdgesAgainstLand(
  network: MaritimeNetwork,
  portConnectorPairs: ReadonlySet<string> = new Set(),
  endpointApproachExemptions: ReadonlyMap<string, { fromStartKm: number; fromEndKm: number }> = new Map(),
): Promise<{
  clear: boolean;
  dataset: string;
  crossingEdgeId?: string;
  crossingCoordinates?: [[number, number], [number, number]];
  reason?: string;
  checkedEdges: number;
  checkedInteriorSamples: number;
  portConnectorExemptionsKm: number[];
}> {
  const land = await loadLandFeatures();
  const maxPortConnectorKm = 100;
  const checkedPairs = new Set<string>();
  const portConnectorExemptionsKm: number[] = [];
  let checkedEdges = 0;
  let checkedInteriorSamples = 0;

  for (const edge of network.edges.values()) {
    const pair = [edge.fromNodeId, edge.toNodeId].sort().join('|');
    if (checkedPairs.has(pair)) continue;
    checkedPairs.add(pair);

    const from = network.nodes.get(edge.fromNodeId);
    const to = network.nodes.get(edge.toNodeId);
    if (!from || !to) {
      return {
        clear: false,
        dataset: 'Natural Earth 1:10m Land v5.1.1',
        crossingEdgeId: edge.id,
        reason: 'Edge references a missing network node',
        checkedEdges,
        checkedInteriorSamples,
        portConnectorExemptionsKm,
      };
    }

    const start: [number, number] = [from.position.longitude, from.position.latitude];
    const end: [number, number] = [to.position.longitude, to.position.latitude];
    const segmentLength = distanceKm(start, end);
    if (isKnownCanalTransitSegment(start, end)) continue;
    if (portConnectorPairs.has(pair)) {
      if (segmentLength <= maxPortConnectorKm) {
        portConnectorExemptionsKm.push(segmentLength);
        continue;
      }
      return {
        clear: false,
        dataset: 'Natural Earth 1:10m Land v5.1.1',
        crossingEdgeId: edge.id,
        crossingCoordinates: [start, end],
        reason: `Port connector exceeds ${maxPortConnectorKm} km`,
        checkedEdges,
        checkedInteriorSamples,
        portConnectorExemptionsKm,
      };
    }

    checkedEdges += 1;
    const samples = Math.max(1, Math.ceil(segmentLength / 2));
    const exemptions = endpointApproachExemptions.get(pair) ?? { fromStartKm: 0, fromEndKm: 0 };
    const firstCheckedFraction = Math.min(exemptions.fromStartKm / segmentLength, 1);
    const lastCheckedFraction = Math.max(1 - exemptions.fromEndKm / segmentLength, 0);
    let adjustedEndLongitude = end[0];
    if (Math.abs(adjustedEndLongitude - start[0]) > 180) {
      adjustedEndLongitude += start[0] > 0 ? 360 : -360;
    }

    for (let sampleIndex = 0; sampleIndex <= samples; sampleIndex += 1) {
      const fraction = sampleIndex / samples;
      if (fraction < firstCheckedFraction || fraction > lastCheckedFraction) continue;
      const coordinate: [number, number] = [
        normalizeLongitude(start[0] + (adjustedEndLongitude - start[0]) * fraction),
        start[1] + (end[1] - start[1]) * fraction,
      ];
      checkedInteriorSamples += 1;
      if (isLand(coordinate, land)) {
        return {
          clear: false,
          dataset: 'Natural Earth 1:10m Land v5.1.1 (2 km edge samples; configured endpoint approaches and Panama/Suez transit corridors exempt; port connectors up to 100 km exempt)',
          crossingEdgeId: edge.id,
          crossingCoordinates: [start, end],
          reason: 'Edge intersects land geometry',
          checkedEdges,
          checkedInteriorSamples,
          portConnectorExemptionsKm,
        };
      }
    }
  }

  return {
    clear: true,
    dataset: 'Natural Earth 1:10m Land v5.1.1 (2 km edge samples; configured endpoint approaches and Panama/Suez transit corridors exempt; port connectors up to 100 km exempt)',
    checkedEdges,
    checkedInteriorSamples,
    portConnectorExemptionsKm,
  };
}
