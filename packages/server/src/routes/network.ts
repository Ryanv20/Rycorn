import { FastifyInstance } from 'fastify';
import { simulationStream } from '../websocket/SimulationStream.js';
import { DEMO_PORTS } from '../demo/demoNetwork.js';
import { getDemoNetwork } from '../demo/demoNetwork.js';
import { getCanonicalPorts } from '../data/portCatalog.js';
import { getActiveScenario } from '../maritime/activeScenario.js';
import { getSpecialVessels } from '../maritime/specialVessels.js';

export default async function networkRoutes(fastify: FastifyInstance) {
  const bunkerPortIds = new Set(['19WPI-50000', '19WPI-16080', '19WPI-18150', '19WPI-53650', '19WPI-46850']);
  // Returns all network nodes with their coordinates so the client can render them
  fastify.get('/network/nodes', async () => {
    const network = getActiveScenario()?.network ?? getDemoNetwork();
    const nodes: Array<{
      id: string;
      type: string;
      latitude: number;
      longitude: number;
      name?: string;
    }> = [];

    for (const [id, node] of network.nodes) {
      const portRecord = DEMO_PORTS.find(p => `node-${p.id}` === id);
      nodes.push({
        id,
        type: node.type,
        latitude:  node.position.latitude,
        longitude: node.position.longitude,
        name: portRecord?.name ?? node.portId,
      });
    }

    return nodes;
  });

  fastify.get('/network/ports', async () => getCanonicalPorts());

  fastify.get('/network/bunker-spots', async () => getCanonicalPorts()
    .filter(port => bunkerPortIds.has(port.portId))
    .map(port => ({ ...port, serviceType: 'SIMULATED_BUNKER_STATION', sourceNote: 'Scenario bunker fixture; not verified from WPI facilities.' })));

  fastify.get('/network/routes', async () => getActiveScenario()?.plannedRoutes ?? []);

  fastify.get('/network/special-vessels', async () => getSpecialVessels());

  // Returns all edges
  fastify.get('/network/edges', async () => {
    const network = getActiveScenario()?.network ?? getDemoNetwork();
    const edges: Array<{
      id: string;
      fromNodeId: string;
      toNodeId: string;
      distanceKm: number;
      minimumVesselCapability: number;
    }> = [];

    for (const [id, edge] of network.edges) {
      edges.push({
        id,
        fromNodeId: edge.fromNodeId,
        toNodeId:   edge.toNodeId,
        distanceKm: edge.distanceKm,
        minimumVesselCapability: edge.minimumVesselCapability,
      });
    }

    return edges;
  });

  // Admin: system status snapshot
  fastify.get('/admin/status', async () => {
    return simulationStream.getSystemStatus();
  });

  // Admin: error log
  fastify.get('/admin/errors', async () => {
    return simulationStream.getErrors();
  });
}
