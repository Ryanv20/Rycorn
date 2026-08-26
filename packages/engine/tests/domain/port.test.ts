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
