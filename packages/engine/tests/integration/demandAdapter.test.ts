import { describe, it, expect } from 'vitest';
import { DemandAdapter } from '../../src/integration/DemandAdapter';
import { CargoRequest } from '../../src/integration/CargoRequest';

describe('DemandAdapter', () => {
  const adapter = new DemandAdapter();

  it('converts single request to CargoDefinition', () => {
    const request: CargoRequest = {
      requestId: 'req-1',
      origin: 'port-A',
      destination: 'port-B',
      quantity: 50,
      earliestDeparture: 0,
      deadline: 10,
      cargoType: 'GENERAL'
    };
    
    const def = adapter.toCargoDefinition(request);
    expect(def.id).toBe('req-1');
    expect(def.origin).toBe('port-A');
    expect(def.destination).toBe('port-B');
  });

  it('converts batch of requests', () => {
    const requests: CargoRequest[] = [
      {
        requestId: 'req-1',
        origin: 'port-A',
        destination: 'port-B',
        quantity: 50,
        earliestDeparture: 0,
        deadline: 10,
        cargoType: 'GENERAL'
      },
      {
        requestId: 'req-2',
        origin: 'port-C',
        destination: 'port-D',
        quantity: 100,
        earliestDeparture: 0,
        deadline: 20,
        cargoType: 'BULK'
      }
    ];
    
    const defs = adapter.toBatch(requests);
    expect(defs.length).toBe(2);
    expect(defs[0].id).toBe('req-1');
    expect(defs[1].id).toBe('req-2');
  });
});
