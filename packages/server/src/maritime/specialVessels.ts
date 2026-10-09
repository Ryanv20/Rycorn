import { createRequire } from 'node:module';
import type { CanonicalPortRecord } from '../data/portCatalog.js';
import { getCanonicalPorts } from '../data/portCatalog.js';

interface SeaRouteFeature {
  geometry: { type: 'LineString'; coordinates: [number, number][] };
}

type SeaRouteFunction = (origin: unknown, destination: unknown, units?: string) => SeaRouteFeature | null;
const require = createRequire(import.meta.url);
const seaRoute = require('searoute-js') as SeaRouteFunction;

const patrolDefinitions = [
  { id: 'RYC-SPEC-001', name: 'Arctic Sentinel', sector: 'Arctic Ocean', origin: '19WPI-100', destination: '19WPI-640' },
  { id: 'RYC-SPEC-002', name: 'Atlantic Sentinel', sector: 'North Atlantic', origin: '19WPI-7640', destination: '19WPI-31140' },
  { id: 'RYC-SPEC-003', name: 'Pacific Sentinel', sector: 'North Pacific', origin: '19WPI-59970', destination: '19WPI-16080' },
  { id: 'RYC-SPEC-004', name: 'Indian Sentinel', sector: 'Indian Ocean', origin: '19WPI-48840', destination: '19WPI-46850' },
  { id: 'RYC-SPEC-005', name: 'Southern Sentinel', sector: 'Southern Ocean', origin: '19WPI-55150', destination: '19WPI-46770' },
  { id: 'RYC-SPEC-006', name: 'Pacific Sentinel II', sector: 'Western Pacific', origin: '19WPI-18150', destination: '19WPI-59970' },
  { id: 'RYC-SPEC-007', name: 'South Atlantic Sentinel', sector: 'South Atlantic', origin: '19WPI-46850', destination: '19WPI-13760' },
] as const;

function point(port: CanonicalPortRecord) {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [port.longitude, port.latitude] },
  };
}

let cachedPatrols: ReturnType<typeof buildPatrols> | undefined;

function buildPatrols() {
  const ports = new Map(getCanonicalPorts().map(port => [port.portId, port]));
  return patrolDefinitions.map(definition => {
    const origin = ports.get(definition.origin);
    const destination = ports.get(definition.destination);
    if (!origin || !destination) throw new Error(`Unknown patrol route port in ${definition.id}`);
    const route = seaRoute(point(origin), point(destination), 'kilometers');
    if (!route) throw new Error(`No generalized patrol preview path for ${definition.id}`);
    return {
      ...definition,
      vesselClass: 'SPECIAL',
      status: 'ON PATROL',
      previewSpeedKnots: 12,
      originName: origin.name,
      destinationName: destination.name,
      coordinates: route.geometry.coordinates,
      routePreviewOnly: true as const,
      fixtureNotice: 'Fictional patrol unit and position for simulation display; not live military or AIS data.',
    };
  });
}

export function getSpecialVessels() {
  cachedPatrols ??= buildPatrols();
  return cachedPatrols;
}
