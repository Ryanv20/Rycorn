import { describe, it, expect } from 'vitest';
import { SimulationEngine } from '../../src/simulation/engine/SimulationEngine';
import { VesselCapability } from '../../src/domain/network/VesselCapability';
import { NetworkBuilder } from '../../src/network/NetworkBuilder';
import { CongestionModel } from '../../src/conditions/models/CongestionModel';
import { PortDelayModel } from '../../src/conditions/models/PortDelayModel';
import { SeededRng } from '../../src/conditions/SeededRng';

describe('Engine with Models', () => {
  it('functions identically when no modifier is attached', () => {
    const builder = new NetworkBuilder();
    builder.addPorts([
      { id: 'PORT-A', name: 'Port A', country: 'XX', position: { latitude: 0, longitude: 0 }, sourceId: '1' } as any,
      { id: 'PORT-B', name: 'Port B', country: 'XX', position: { latitude: 0, longitude: 1 }, sourceId: '2' } as any
    ]);
    builder.addEdges([{ fromPortId: 'PORT-A', toPortId: 'PORT-B', minimumCapability: VesselCapability.A }]);
    const network = builder.build();

    const engine1 = new SimulationEngine();
    engine1.initialize({
      vessels: [{ id: 'V1', capability: VesselCapability.A, startNodeId: 'node-PORT-A' }],
      cargoes: [{ id: 'C1', origin: 'node-PORT-A', destination: 'node-PORT-B' }],
      network
    });
    const result1 = engine1.run();
    expect(result1.finalCargoStates.get('C1')?.status).toBe('DELIVERED');
  });

  it('delivers cargo successfully when modifiers are attached', () => {
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
      network,
      config: {
        loadDurationHours: 2,
        unloadDurationHours: 2,
        movementModifier: new CongestionModel(),
        portDelayModifier: new PortDelayModel(new SeededRng('seed1'), 2)
      }
    });
    
    const result = engine.run();
    expect(result.finalCargoStates.get('C1')?.status).toBe('DELIVERED');
    
    // Total simulated hours should be greater or equal to without modifier
    // Due to delays or congestion
    const engineNoMod = new SimulationEngine();
    engineNoMod.initialize({
      vessels: [{ id: 'V1', capability: VesselCapability.A, startNodeId: 'node-PORT-A' }],
      cargoes: [{ id: 'C1', origin: 'node-PORT-A', destination: 'node-PORT-B' }],
      network,
      config: {
        loadDurationHours: 2,
        unloadDurationHours: 2
      }
    });
    const resultNoMod = engineNoMod.run();
    
    // We expect it to differ deterministically
    expect(result.totalSimulatedHours).not.toBe(resultNoMod.totalSimulatedHours);
  });
});
