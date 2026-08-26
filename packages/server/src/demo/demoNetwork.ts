/**
 * Canonical demo network — built once on the server, never serialized to the client.
 * Ports are placed at real-ish North Sea / English Channel coordinates so the
 * Leaflet map renders them at recognisable positions.
 */
import { NetworkBuilder } from '@rycon/engine';
import { VesselCapability } from '@rycon/engine';
import type { MaritimeNetwork } from '@rycon/engine';

export interface PortRecord {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export const DEMO_PORTS: PortRecord[] = [
  { id: 'PORT-ALPHA', name: 'Alpha Port (London)',  latitude: 51.50, longitude:  0.12 },
  { id: 'PORT-BETA',  name: 'Beta Port (Rotterdam)', latitude: 51.92, longitude:  4.48 },
  { id: 'PORT-GAMMA', name: 'Gamma Port (Le Havre)', latitude: 49.49, longitude:  0.11 },
    { id: 'PORT-DELTA', name: 'Delta Port (Dover)', latitude: 51.13, longitude:  1.31 },
];

export const DEMO_VESSELS = [
  { id: 'VESSEL-001', capability: VesselCapability.C, startNodeId: 'node-PORT-ALPHA' },
  { id: 'VESSEL-002', capability: VesselCapability.B, startNodeId: 'node-PORT-ALPHA' },
  { id: 'VESSEL-003', capability: VesselCapability.D, startNodeId: 'node-PORT-BETA'  },
    { id: 'VESSEL-004', capability: VesselCapability.C, startNodeId: 'node-PORT-GAMMA' },
    { id: 'VESSEL-005', capability: VesselCapability.B, startNodeId: 'node-PORT-DELTA' },
    { id: 'VESSEL-006', capability: VesselCapability.D, startNodeId: 'node-PORT-BETA'  },
];

export const DEMO_CARGOES = [
  { id: 'CARGO-001', origin: 'node-PORT-ALPHA', destination: 'node-PORT-BETA',  quantity: 100 },
  { id: 'CARGO-002', origin: 'node-PORT-ALPHA', destination: 'node-PORT-GAMMA', quantity:  50 },
  { id: 'CARGO-003', origin: 'node-PORT-BETA',  destination: 'node-PORT-ALPHA', quantity: 200 },
  { id: 'CARGO-004', origin: 'node-PORT-GAMMA', destination: 'node-PORT-BETA',  quantity:  75 },
  { id: 'CARGO-005', origin: 'node-PORT-ALPHA', destination: 'node-PORT-BETA',  quantity:  30 },
    { id: 'CARGO-006', origin: 'node-PORT-DELTA', destination: 'node-PORT-ALPHA', quantity: 120 },
    { id: 'CARGO-007', origin: 'node-PORT-GAMMA', destination: 'node-PORT-DELTA', quantity: 80 },
    { id: 'CARGO-008', origin: 'node-PORT-BETA', destination: 'node-PORT-DELTA', quantity: 60 },
    { id: 'CARGO-009', origin: 'node-PORT-DELTA', destination: 'node-PORT-GAMMA', quantity: 90 },
    { id: 'CARGO-010', origin: 'node-PORT-ALPHA', destination: 'node-PORT-DELTA', quantity: 40 },
];

let _network: MaritimeNetwork | null = null;

export function getDemoNetwork(): MaritimeNetwork {
  if (_network) return _network;

  const builder = new NetworkBuilder();

  builder.addPorts(
    DEMO_PORTS.map(p => ({
      id: p.id,
      name: p.name,
      country: 'XX',
      position: { latitude: p.latitude, longitude: p.longitude },
      sourceId: p.id,
    }) as any)
  );

  builder.addEdges([
    { fromPortId: 'PORT-ALPHA', toPortId: 'PORT-BETA',  minimumCapability: VesselCapability.B },
    { fromPortId: 'PORT-BETA',  toPortId: 'PORT-ALPHA', minimumCapability: VesselCapability.B },
    { fromPortId: 'PORT-ALPHA', toPortId: 'PORT-GAMMA', minimumCapability: VesselCapability.A },
    { fromPortId: 'PORT-GAMMA', toPortId: 'PORT-ALPHA', minimumCapability: VesselCapability.A },
    { fromPortId: 'PORT-BETA',  toPortId: 'PORT-GAMMA', minimumCapability: VesselCapability.A },
    { fromPortId: 'PORT-GAMMA', toPortId: 'PORT-BETA',  minimumCapability: VesselCapability.A },
      { fromPortId: 'PORT-ALPHA', toPortId: 'PORT-DELTA', minimumCapability: VesselCapability.B },
      { fromPortId: 'PORT-DELTA', toPortId: 'PORT-ALPHA', minimumCapability: VesselCapability.B },
      { fromPortId: 'PORT-BETA', toPortId: 'PORT-DELTA', minimumCapability: VesselCapability.A },
      { fromPortId: 'PORT-DELTA', toPortId: 'PORT-BETA', minimumCapability: VesselCapability.A },
      { fromPortId: 'PORT-GAMMA', toPortId: 'PORT-DELTA', minimumCapability: VesselCapability.A },
      { fromPortId: 'PORT-DELTA', toPortId: 'PORT-GAMMA', minimumCapability: VesselCapability.A },
  ]);

  _network = builder.build();
  return _network;
}
