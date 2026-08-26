import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/simulation/engine/SimulationEngine';
import { VesselCapability } from '../../src/domain/network/VesselCapability';
import { NetworkBuilder } from '../../src/network/NetworkBuilder';

describe('SimulationEngine - Single Voyage', () => {
  it('runs a complete single voyage', () => {
    const builder = new NetworkBuilder();
    builder.addPorts([
      { id: 'PORT-A', name: 'Port A', country: 'XX', position: { latitude: 0, longitude: 0 }, sourceId: '1' } as any,
      { id: 'PORT-B', name: 'Port B', country: 'XX', position: { latitude: 0, longitude: 1 }, sourceId: '2' } as any
    ]);
    builder.addEdges([{ fromPortId: 'PORT-A', toPortId: 'PORT-B', minimumCapability: VesselCapability.A }]);
    const network = builder.build();

    const engine = new SimulationEngine();
    engine.initialize({
      vessels: [{ id: 'V1', capability: VesselCapability.A, startNodeId: 'node-PORT-A' }],
      cargoes: [{ id: 'C1', origin: 'node-PORT-A', destination: 'node-PORT-B' }],
      network
    });

    const result = engine.run();
    expect(result.finalCargoStates.get('C1')?.status).toBe('DELIVERED');
    expect(result.finalVesselStates.get('V1')?.status).toBe('IDLE');
    
    // Ordered check
    const times = result.events.map(e => e.simulationTime);
    const sortedTimes = [...times].sort((a, b) => a - b);
    expect(times).toEqual(sortedTimes);
  });
});
