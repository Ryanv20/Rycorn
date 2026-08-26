import { describe, it, expect } from 'vitest';
import { wpiRecordSchema } from '../../src/ingestion/validators/wpiValidator';

describe('wpiValidator', () => {
  it('should validate valid coordinates', () => {
    const valid = {
      'World Port Index Number': '1',
      'Main Port Name': 'Name',
      'Country Code': 'US',
      'Latitude': '45',
      'Longitude': '-120'
    };
    const result = wpiRecordSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.Latitude).toBe(45);
      expect(result.data.Longitude).toBe(-120);
    }
  });

  it('should reject invalid latitude', () => {
    const invalid = {
      'World Port Index Number': '1',
      'Main Port Name': 'Name',
      'Country Code': 'US',
      'Latitude': '999.2',
      'Longitude': '-120'
    };
    const result = wpiRecordSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject invalid longitude', () => {
    const invalid = {
      'World Port Index Number': '1',
      'Main Port Name': 'Name',
      'Country Code': 'US',
      'Latitude': '45',
      'Longitude': '-190'
    };
    const result = wpiRecordSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const invalid = {
      'Main Port Name': 'Name',
      'Country Code': 'US',
      'Latitude': '45',
      'Longitude': '-120'
    };
    const result = wpiRecordSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
