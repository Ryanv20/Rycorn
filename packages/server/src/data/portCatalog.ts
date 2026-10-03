import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface CanonicalPortRecord {
  portId: string;
  sourceId: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  harborType: string;
  harborSize: string;
  maximumVesselSize: string;
  source: string;
  sourceVersion: string;
}

const catalogPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../data/processed/canonical-ports.json');
let cachedPorts: CanonicalPortRecord[] | undefined;

export function getCanonicalPorts(): CanonicalPortRecord[] {
  if (!cachedPorts) cachedPorts = JSON.parse(readFileSync(catalogPath, 'utf8')) as CanonicalPortRecord[];
  return cachedPorts;
}

export function getPortByNodeId(nodeId: string): CanonicalPortRecord | undefined {
  const portId = nodeId.startsWith('node-') ? nodeId.slice('node-'.length) : nodeId;
  return getCanonicalPorts().find(port => port.portId === portId);
}
