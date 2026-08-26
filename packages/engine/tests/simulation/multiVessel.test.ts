import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/simulation/engine/SimulationEngine';
import { VesselCapability } from '../../src/domain/network/VesselCapability';
import { NetworkBuilder } from '../../src/network/NetworkBuilder';

describe('SimulationEngine - Multi-Vessel', () => {
  it('runs multiple vessels and reuses them', () => {
    const builder = new NetworkBuilder();
    builder.addPorts([
      { id: 'PORT-A', name: 'Port A', country: 'XX', position: { latitude: 0, longitude: 0 }, sourceId: 'A' } as any,
      { id: 'PORT-B', name: 'Port B', country: 'XX', position: { latitude: 0, longitude: 1 }, sourceId: 'B' } as any,
      { id: 'PORT-C', name: 'Port C', country: 'XX', position: { latitude: 0, longitude: 2 }, sourceId: 'C' } as any
    ]);
    builder.addEdges([
      { fromPortId: 'PORT-A', toPortId: 'PORT-B', minimumCapability: VesselCapability.C },
      { fromPortId: 'PORT-B', toPortId: 'PORT-A', minimumCapability: VesselCapability.C },
      { fromPortId: 'PORT-A', toPortId: 'PORT-C', minimumCapability: VesselCapability.B },
      { fromPortId: 'PORT-C', toPortId: 'PORT-B', minimumCapability: VesselCapability.B }
    ]);
    const network = builder.build();

    const engine = new SimulationEngine();
    engine.initialize({
      vessels: [
        { id: 'V1', capability: VesselCapability.C, startNodeId: 'node-PORT-A' },
        { id: 'V2', capability: VesselCapability.B, startNodeId: 'node-PORT-A' },
        { id: 'V3', capability: VesselCapability.D, startNodeId: 'node-PORT-B' } // Just to have a 3rd vessel
      ],
      cargoes: [
        { id: 'C1', origin: 'node-PORT-A', destination: 'node-PORT-B' },
        { id: 'C2', origin: 'node-PORT-A', destination: 'node-PORT-C' },
        { id: 'C3', origin: 'node-PORT-B', destination: 'node-PORT-A' },
        { id: 'C4', origin: 'node-PORT-C', destination: 'node-PORT-B' },
        { id: 'C5', origin: 'node-PORT-A', destination: 'node-PORT-B' } // V1 will pick this up after C3
      ],
      network
    });

    const result = engine.run();
    expect(result.finalCargoStates.get('C1')?.status).toBe('DELIVERED');
    expect(result.finalCargoStates.get('C2')?.status).toBe('DELIVERED');
    expect(result.finalCargoStates.get('C3')?.status).toBe('DELIVERED');
    expect(result.finalCargoStates.get('C4')?.status).toBe('DELIVERED');
    expect(result.finalCargoStates.get('C5')?.status).toBe('DELIVERED');
    
    expect(result.finalVesselStates.get('V1')?.status).toBe('IDLE');
    expect(result.finalVesselStates.get('V2')?.status).toBe('IDLE');
    expect(result.finalVesselStates.get('V3')?.status).toBe('IDLE');
    
    const times = result.events.map(e => e.simulationTime);
    const sortedTimes = [...times].sort((a, b) => a - b);
    expect(times).toEqual(sortedTimes);
  });
});
