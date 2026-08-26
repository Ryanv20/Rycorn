import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { parseWpiFile } from '../../src/ingestion/parsers/wpiParser';

describe('wpiParser', () => {
  it('should parse fixture and correctly account for valid, invalid, and duplicates', async () => {
    const fixturePath = path.join(__dirname, 'fixture.csv');
    const result = await parseWpiFile(fixturePath);

    expect(result.recordsRead).toBe(6);
    expect(result.valid).toBe(2);
    expect(result.duplicates).toBe(1); // 1010 duplicated
    expect(result.invalid).toBe(3); // 1030 invalid lat, 1040 invalid lon, empty ID
    
    expect(result.ports.length).toBe(2);
    expect(result.ports[0].portId).toBe('19WPI-1010');
    expect(result.ports[1].portId).toBe('19WPI-1020');
  });
});
