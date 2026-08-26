import { describe, it, expect } from 'vitest';
import { cargoRequestSchema } from '../../src/integration/CargoRequest';

describe('CargoRequest Schema', () => {
  it('validates a correct request', () => {
    const req = {
      requestId: 'req-1',
      origin: 'port-a',
      destination: 'port-b',
      quantity: 100,
      earliestDeparture: 0,
      deadline: 48,
      cargoType: 'GENERAL'
    };
    expect(() => cargoRequestSchema.parse(req)).not.toThrow();
  });

  it('rejects missing requestId', () => {
    const req = {
      origin: 'port-a',
      destination: 'port-b',
      quantity: 100,
      earliestDeparture: 0,
      deadline: 48
    };
    expect(() => cargoRequestSchema.parse(req)).toThrow();
  });

  it('rejects negative quantity', () => {
    const req = {
      requestId: 'req-1',
      origin: 'port-a',
      destination: 'port-b',
      quantity: -50,
      earliestDeparture: 0,
      deadline: 48
    };
    expect(() => cargoRequestSchema.parse(req)).toThrow();
  });
});
