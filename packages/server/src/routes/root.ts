import { FastifyInstance } from 'fastify';
import { simulationStream } from '../websocket/SimulationStream.js';

const help = {
  routes: {
    help: 'GET /help',
    ships: 'GET /ship',
    networkNodes: 'GET /network/nodes',
    networkEdges: 'GET /network/edges',
    simulationStatus: 'GET /simulation/status',
    simulationEvents: 'GET /simulation/events',
  },
  simulationActions: {
    initialize: 'POST /simulation/initialize',
    run: 'POST /simulation/run',
    pause: 'POST /simulation/pause',
    step: 'POST /simulation/step',
    reset: 'POST /simulation/reset',
    speed: 'POST /simulation/speed',
  },
};

export default async function rootRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => ({
    name: 'Rycon maritime simulation API',
    message: 'Choose an action below.',
    links: {
      help: '/help',
      ships: '/ship',
    },
  }));

  fastify.get('/help', async () => help);

  fastify.get('/ship', async (_request, reply) => {
    const status = simulationStream.getStatus();
    if (!status) {
      return reply.code(503).send({
        error: 'Simulation is not initialized',
        next: 'POST /simulation/initialize',
      });
    }

    return {
      ships: Array.from(status.vessels.values()),
      count: status.vessels.size,
    };
  });
}