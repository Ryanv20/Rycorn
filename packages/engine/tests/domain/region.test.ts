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
