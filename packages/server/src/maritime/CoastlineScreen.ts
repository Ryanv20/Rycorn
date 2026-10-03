import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open } from 'shapefile';

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

function normalizeLongitude(longitude: number): number {
  return ((longitude + 540) % 360) - 180;
}

function isLand(coordinate: [number, number], land: LandIndex): boolean {
  const [longitude, latitude] = coordinate;
  const key = `${Math.floor((longitude + 180) / bucketDegrees)}:${Math.floor((latitude + 90) / bucketDegrees)}`;
  const candidate = point(coordinate);
  return (land.buckets.get(key) ?? []).some(item => booleanPointInPolygon(candidate, item.feature, { ignoreBoundary: true }));
}

export async function screenRouteAgainstLand(coordinates: [number, number][]): Promise<{
  clear: boolean;
  dataset: string;
  crossingSegment?: number;
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
      const distanceAlong = traversedKm + segmentLength * fraction;
      if (distanceAlong <= 10 || routeDistanceKm - distanceAlong <= 10) continue;
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
    traversedKm += segmentLength;
  }

  return {
    clear: crossing === undefined,
    dataset: 'Natural Earth 1:10m Land v5.1.1 (2 km interior samples; first/last port connectors up to 100 km exempt)',
    crossingSegment: crossing,
    checkedInteriorSamples,
    portConnectorExemptionsKm,
  };
}
