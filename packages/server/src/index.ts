import Fastify from 'fastify';
import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { getCanonicalPorts } from './data/portCatalog.js';
import simulationRoutes from './routes/simulation.js';
import networkRoutes from './routes/network.js';
import rootRoutes from './routes/root.js';
import dsRoutes from './routes/ds.js';
import { simulationStream } from './websocket/SimulationStream.js';

const dataRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../data');
const requiredDataFiles = [
  'processed/canonical-ports.json',
  'raw/natural-earth/ne_10m_land.shp',
  'raw/natural-earth/ne_10m_land.shx',
  'raw/natural-earth/ne_10m_land.dbf',
];
const missingDataFiles = requiredDataFiles.filter(file => {
  const path = resolve(dataRoot, file);
  return !existsSync(path) || !statSync(path).isFile() || statSync(path).size === 0;
});
if (missingDataFiles.length > 0) {
  throw new Error(`Rycorn startup blocked; required data files are not mounted: ${missingDataFiles.join(', ')}`);
}
if (getCanonicalPorts().length === 0) throw new Error('Rycorn startup blocked; canonical-ports.json contains no ports.');

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(websocket);

app.register(simulationRoutes);
app.register(networkRoutes);
app.register(rootRoutes);
app.register(dsRoutes);

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
  const port = Number(process.env.RYCORN_API_PORT ?? 3000);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Server listening on http://localhost:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
