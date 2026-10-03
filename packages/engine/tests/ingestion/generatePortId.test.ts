import { describe, it, expect } from 'vitest';
import { generatePortId } from '../../src/ingestion/ids/generatePortId';

describe('generatePortId', () => {
  it('should generate a deterministic ID', () => {
    expect(generatePortId('12345')).toBe('19WPI-12345');
    expect(generatePortId('12345')).toBe('19WPI-12345');
  });

  it('should generate different IDs for different inputs', () => {
    expect(generatePortId('12345')).not.toBe(generatePortId('67890'));
  });

  it('normalizes numeric source IDs and qualifies reused IDs deterministically', () => {
    expect(generatePortId('46135.0')).toBe('19WPI-46135');
    expect(generatePortId('46135.0', 'Lekki-6.42320-4.00824')).toBe('19WPI-46135-LEKKI-6-42320-4-00824');
  });

  it('should throw on empty string', () => {
    expect(() => generatePortId('')).toThrow('sourceId must be non-empty');
    expect(() => generatePortId('   ')).toThrow('sourceId must be non-empty');
  });
});
