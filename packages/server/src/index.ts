import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import simulationRoutes from './routes/simulation.js';
import networkRoutes from './routes/network.js';
import rootRoutes from './routes/root.js';
import { simulationStream } from './websocket/SimulationStream.js';

const app = Fastify({ logger: true });

await app.register(cors);
await app.register(websocket);

app.register(simulationRoutes);
app.register(networkRoutes);
app.register(rootRoutes);

app.setNotFoundHandler((request, reply) => {
  reply.code(404).send({
    error: 'Route not found',
    path: request.url,
    help: '/help',
  });
});

app.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    simulationStream.addConnection(connection);
  });
});

try {
  await app.listen({ port: 3000, host: '0.0.0.0' });
  console.log('Server listening on http://localhost:3000');
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
