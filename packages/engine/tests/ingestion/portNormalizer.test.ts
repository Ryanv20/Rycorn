import { describe, it, expect } from 'vitest';
import { normalizePort } from '../../src/ingestion/normalizers/portNormalizer';
import { WorldPortIndexRecord } from '../../src/ingestion/validators/wpiValidator';

describe('portNormalizer', () => {
  it('should convert a WorldPortIndexRecord to a CanonicalPort', () => {
    const rawRecord: WorldPortIndexRecord = {
      'World Port Index Number': '1010',
      'Main Port Name': 'Test Port',
      'Country Code': 'US',
      'Latitude': 45.5,
      'Longitude': -120.0,
      'Harbor Type': 'Coastal Natural',
      'Harbor Size': 'L',
      'Maximum Vessel Size': 'Over 500 feet',
    };

    const canonical = normalizePort(rawRecord);

    expect(canonical).toEqual({
      portId: '19WPI-1010',
      sourceId: '1010',
      name: 'Test Port',
      country: 'US',
      latitude: 45.5,
      longitude: -120.0,
      harborType: 'Coastal Natural',
      harborSize: 'L',
      maximumVesselSize: 'Over 500 feet',
      source: 'WPI',
      sourceVersion: 'NGA Pub 150, data through 2019-08-31',
    });
  });
});
