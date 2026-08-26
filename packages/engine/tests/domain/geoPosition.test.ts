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
