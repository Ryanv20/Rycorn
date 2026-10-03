import { describe, it, expect } from 'vitest';
import { StaticDemandProvider } from '../../src/integration/DemandInterface';
import { DemandAdapter } from '../../src/integration/DemandAdapter';
import { SimulationEngine } from '../../src/simulation/engine/SimulationEngine';
import { MaritimeNetwork } from '../../src/domain/network/MaritimeNetwork';

describe('Demand Flow Integration', () => {
  it('StaticDemandProvider -> DemandAdapter -> SimulationEngine -> DELIVERED', () => {
    const provider = new StaticDemandProvider([{
      requestId: 'dynamic-cargo-1',
      origin: 'nodeA',
      destination: 'nodeB',
      quantity: 100,
      earliestDeparture: 0,
      deadline: 100,
      cargoType: 'GENERAL'
    }]);

    const adapter = new DemandAdapter();
    const requests = provider.getCargoRequests();
    const cargoes = adapter.toBatch(requests);

    const nodes = new Map<any, any>();
    nodes.set('nodeA', { nodeId: 'nodeA', position: { type: 'Point', coordinates: [0, 0] }, isPort: true });
    nodes.set('nodeB', { nodeId: 'nodeB', position: { type: 'Point', coordinates: [1, 1] }, isPort: true });

    const edges = new Map<any, any>();
    edges.set('e1', { id: 'e1', fromNodeId: 'nodeA', toNodeId: 'nodeB', distanceKm: 10, minimumVesselCapability: 'A' });
    edges.set('e2', { id: 'e2', fromNodeId: 'nodeB', toNodeId: 'nodeA', distanceKm: 10, minimumVesselCapability: 'A' });

    const adjacency = new Map<any, any>();
    adjacency.set('nodeA', ['e1']);
    adjacency.set('nodeB', ['e2']);

    const network = new MaritimeNetwork(nodes, edges, adjacency);

    const engine = new SimulationEngine();
    engine.initialize({
      vessels: [
        { id: 'v1', capability: 'A', startNodeId: 'nodeA' }
      ],
      cargoes: cargoes,
      network: network,
      config: {
        loadDurationHours: 1,
        unloadDurationHours: 1,
        speedProfiles: [{ capability: 'A' as any, nominalSpeedKnots: 10 }]
      }
    });

    const result = engine.run();
    const cargoState = result.finalCargoStates.get('dynamic-cargo-1');
    
    expect(cargoState).toBeDefined();
    expect(cargoState?.status).toBe('DELIVERED');

    engine.addCargo({
      id: 'dynamic-cargo-2',
      origin: 'nodeB',
      destination: 'nodeA',
      quantity: 50,
      earliestDeparture: result.totalSimulatedHours + 12,
      deadline: 200,
      cargoType: 'GENERAL',
    });
    engine.run();
    expect(engine.getState().getCargo('dynamic-cargo-2').status).toBe('DELIVERED');
  });
});
