const fs = require('fs');
const path = require('path');

const write = (filepath, content) => {
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, content.trim() + '\n');
};

const base = 'c:/Users/Owner/Desktop/Projects/project_e';

// Phase 2 files

write(`${base}/src/domain/shared/GeoPosition.ts`, `
export interface GeoPosition {
  latitude: number;
  longitude: number;
}
`);

write(`${base}/src/domain/shared/Provenance.ts`, `
export interface Provenance {
  source: string;
  sourceId: string;
  sourceVersion: string;
}
`);

write(`${base}/src/domain/shared/PortId.ts`, `
export type PortId = string & { readonly __brand: unique symbol };
`);

write(`${base}/src/domain/shared/enums.ts`, `
export enum HarborType {
  CoastalNatural = 'Coastal (Natural)',
  CoastalBreakwater = 'Coastal (Breakwater)',
  CoastalTideGate = 'Coastal (Tide Gate)',
  RiverNatural = 'River (Natural)',
  RiverBasin = 'River (Basin)',
  RiverTideGate = 'River (Tide Gate)',
  Lake = 'Lake',
  OpenRoadstead = 'Open Roadstead',
  Canal = 'Canal',
  Lagoon = 'Lagoon',
  Unknown = 'Unknown'
}

export enum HarborSize {
  Small = 'Small',
  Medium = 'Medium',
  Large = 'Large',
  VeryLarge = 'Very Large',
  Unknown = 'Unknown'
}
`);

write(`${base}/src/domain/schemas/portSchema.ts`, `
import { z } from 'zod';
import { HarborType, HarborSize } from '../shared/enums';

export const geoPositionSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const provenanceSchema = z.object({
  source: z.string(),
  sourceId: z.string(),
  sourceVersion: z.string(),
});

export const portSchema = z.object({
  id: z.string() as unknown as z.ZodType<any, any, any>,
  name: z.string(),
  country: z.string(),
  position: geoPositionSchema,
  harborType: z.nativeEnum(HarborType),
  harborSize: z.nativeEnum(HarborSize),
  maximumVesselSize: z.string(),
  provenance: provenanceSchema,
});
`);

write(`${base}/src/domain/schemas/nodeSchema.ts`, `
import { z } from 'zod';
import { geoPositionSchema } from './portSchema';

export const geographicNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['PORT', 'INTERMEDIATE']),
  position: geoPositionSchema,
  portId: z.string().optional(),
}).refine(data => {
  if (data.type === 'PORT') return data.portId !== undefined;
  if (data.type === 'INTERMEDIATE') return data.portId === undefined;
  return true;
}, { message: "portId is required for PORT nodes and must be omitted for INTERMEDIATE nodes" });
`);

write(`${base}/src/domain/schemas/regionSchema.ts`, `
import { z } from 'zod';
import { geoPositionSchema } from './portSchema';

export const regionSchema = z.object({
  id: z.string(),
  name: z.string(),
  boundary: z.array(geoPositionSchema).min(3),
}).refine(data => {
  if (data.boundary.length === 0) return true;
  const first = data.boundary[0];
  const last = data.boundary[data.boundary.length - 1];
  return first.latitude === last.latitude && first.longitude === last.longitude;
}, { message: "Region boundary must be a closed loop" });
`);

write(`${base}/src/domain/ports/Port.ts`, `
import { PortId } from '../shared/PortId';
import { GeoPosition } from '../shared/GeoPosition';
import { HarborType, HarborSize } from '../shared/enums';
import { Provenance } from '../shared/Provenance';

export interface Port {
  id: PortId;
  name: string;
  country: string;
  position: GeoPosition;
  harborType: HarborType;
  harborSize: HarborSize;
  maximumVesselSize: string;
  provenance: Provenance;
}
`);

write(`${base}/src/domain/regions/Region.ts`, `
import { GeoPosition } from '../shared/GeoPosition';

export type RegionId = string & { readonly __brand: unique symbol };

export interface Region {
  id: RegionId;
  name: string;
  boundary: GeoPosition[];
}
`);

write(`${base}/src/domain/nodes/GeographicNode.ts`, `
import { GeoPosition } from '../shared/GeoPosition';
import { PortId } from '../shared/PortId';

export type NodeId = string & { readonly __brand: unique symbol };
export type NodeType = 'PORT' | 'INTERMEDIATE';

export interface GeographicNode {
  id: NodeId;
  type: NodeType;
  position: GeoPosition;
  portId?: PortId;
}
`);

write(`${base}/src/ingestion/transformers/portTransformer.ts`, `
import { CanonicalPort } from '../../domain/ports/CanonicalPort';
import { Port } from '../../domain/ports/Port';
import { HarborType, HarborSize } from '../../domain/shared/enums';
import { PortId } from '../../domain/shared/PortId';
import { generatePortId } from '../ids/generatePortId';

export function mapHarborType(raw: string): HarborType {
  const map: Record<string, HarborType> = {
    'Coastal (Natural)': HarborType.CoastalNatural,
    'Coastal (Breakwater)': HarborType.CoastalBreakwater,
    'Coastal (Tide Gate)': HarborType.CoastalTideGate,
    'River (Natural)': HarborType.RiverNatural,
    'River (Basin)': HarborType.RiverBasin,
    'River (Tide Gate)': HarborType.RiverTideGate,
    'Lake': HarborType.Lake,
    'Open Roadstead': HarborType.OpenRoadstead,
    'Canal': HarborType.Canal,
    'Lagoon': HarborType.Lagoon,
  };
  return map[raw] || HarborType.Unknown;
}

export function mapHarborSize(raw: string): HarborSize {
  const map: Record<string, HarborSize> = {
    'S': HarborSize.Small,
    'M': HarborSize.Medium,
    'L': HarborSize.Large,
    'V': HarborSize.VeryLarge,
  };
  return map[raw] || HarborSize.Unknown;
}

export function transformPort(canonical: CanonicalPort): Port {
  const id = generatePortId(canonical.sourceId) as PortId;
  return {
    id,
    name: canonical.name,
    country: canonical.country,
    position: {
      latitude: canonical.latitude,
      longitude: canonical.longitude,
    },
    harborType: mapHarborType(canonical.harborType),
    harborSize: mapHarborSize(canonical.harborSize),
    maximumVesselSize: canonical.maximumVesselSize,
    provenance: {
      source: canonical.source,
      sourceId: canonical.sourceId,
      sourceVersion: canonical.sourceVersion,
    },
  };
}
`);

write(`${base}/tests/domain/geoPosition.test.ts`, `
import { describe, it, expect } from 'vitest';
import { geoPositionSchema } from '../../src/domain/schemas/portSchema';

describe('GeoPosition validation', () => {
  it('should accept valid coordinates', () => {
    const res = geoPositionSchema.safeParse({ latitude: 45, longitude: -90 });
    expect(res.success).toBe(true);
  });

  it('should reject invalid coordinates', () => {
    expect(geoPositionSchema.safeParse({ latitude: 91, longitude: 0 }).success).toBe(false);
    expect(geoPositionSchema.safeParse({ latitude: 0, longitude: 181 }).success).toBe(false);
  });
});
`);

write(`${base}/tests/domain/port.test.ts`, `
import { describe, it, expect } from 'vitest';
import { transformPort, mapHarborType, mapHarborSize } from '../../src/ingestion/transformers/portTransformer';
import { CanonicalPort } from '../../src/domain/ports/CanonicalPort';
import { HarborType, HarborSize } from '../../src/domain/shared/enums';
import { portSchema } from '../../src/domain/schemas/portSchema';

describe('Port canonical to domain transformation', () => {
  it('maps harbor type and size from WPI codes', () => {
    expect(mapHarborType('Coastal (Natural)')).toBe(HarborType.CoastalNatural);
    expect(mapHarborSize('V')).toBe(HarborSize.VeryLarge);
  });

  it('creates Port with valid data', () => {
    const raw: CanonicalPort = {
      portId: 'ignored',
      sourceId: '123',
      name: 'Test Port',
      country: 'Testland',
      latitude: 10,
      longitude: 20,
      harborType: 'Coastal (Natural)',
      harborSize: 'L',
      maximumVesselSize: 'M',
      source: 'WPI',
      sourceVersion: 'v1'
    };
    const port = transformPort(raw);
    expect(port.harborSize).toBe(HarborSize.Large);
    expect(port.harborType).toBe(HarborType.CoastalNatural);
    expect(port.provenance.sourceId).toBe('123');
    
    // validate schema
    const val = portSchema.safeParse(port);
    expect(val.success).toBe(true);
  });
});
`);

write(`${base}/tests/domain/region.test.ts`, `
import { describe, it, expect } from 'vitest';
import { regionSchema } from '../../src/domain/schemas/regionSchema';
import { geographicNodeSchema } from '../../src/domain/schemas/nodeSchema';

describe('Region & Node Schemas', () => {
  it('accepts valid region with closed boundary', () => {
    const boundary = [
      { latitude: 0, longitude: 0 },
      { latitude: 10, longitude: 0 },
      { latitude: 10, longitude: 10 },
      { latitude: 0, longitude: 0 },
    ];
    const res = regionSchema.safeParse({ id: 'r1', name: 'Reg', boundary });
    expect(res.success).toBe(true);
  });

  it('rejects region with open boundary', () => {
    const boundary = [
      { latitude: 0, longitude: 0 },
      { latitude: 10, longitude: 0 },
      { latitude: 10, longitude: 10 },
    ];
    const res = regionSchema.safeParse({ id: 'r1', name: 'Reg', boundary });
    expect(res.success).toBe(false);
  });
  
  it('PORT node must have portId', () => {
    const n1 = geographicNodeSchema.safeParse({
      id: 'n1', type: 'PORT', position: { latitude: 0, longitude: 0 }
    });
    expect(n1.success).toBe(false);

    const n2 = geographicNodeSchema.safeParse({
      id: 'n1', type: 'PORT', position: { latitude: 0, longitude: 0 }, portId: 'p1'
    });
    expect(n2.success).toBe(true);
  });

  it('INTERMEDIATE node must not have portId', () => {
    const n1 = geographicNodeSchema.safeParse({
      id: 'n1', type: 'INTERMEDIATE', position: { latitude: 0, longitude: 0 }, portId: 'p1'
    });
    expect(n1.success).toBe(false);

    const n2 = geographicNodeSchema.safeParse({
      id: 'n1', type: 'INTERMEDIATE', position: { latitude: 0, longitude: 0 }
    });
    expect(n2.success).toBe(true);
  });
});
`);

console.log("Phase 2 files generated");
