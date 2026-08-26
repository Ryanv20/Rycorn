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

  it('should throw on empty string', () => {
    expect(() => generatePortId('')).toThrow('sourceId must be non-empty');
    expect(() => generatePortId('   ')).toThrow('sourceId must be non-empty');
  });
});
