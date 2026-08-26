import { FastifyInstance } from 'fastify';
import { simulationStream } from '../websocket/SimulationStream.js';

export default async function simulationRoutes(fastify: FastifyInstance) {
  // Initialize — network is always built server-side from demoNetwork.ts
  fastify.post('/simulation/initialize', async (request) => {
    const body = (request.body as any) ?? {};
    simulationStream.initialize(body);
    return { success: true, status: simulationStream.getSystemStatus() };
  });

  fastify.post('/simulation/run', async () => {
    simulationStream.run();
    return { success: true };
  });

  fastify.post('/simulation/pause', async () => {
    simulationStream.pause();
    return { success: true };
  });

  fastify.post('/simulation/step', async () => {
    const event = simulationStream.step();
    return { success: true, event: event ?? null };
  });

  fastify.post('/simulation/reset', async () => {
    simulationStream.reset();
    return { success: true };
  });

  fastify.post('/simulation/speed', async (request) => {
    const { multiplier } = (request.body as { multiplier: number });
    if (!multiplier || multiplier <= 0) return { success: false, error: 'Invalid multiplier' };
    simulationStream.setSpeed(multiplier);
    return { success: true, tickIntervalMs: Math.max(10, 200 / multiplier) };
  });

  fastify.get('/simulation/status', async (request, reply) => {
    const status = simulationStream.getStatus();
    if (!status) return reply.code(400).send({ error: 'Not initialized' });
    return {
      vessels: Array.from(status.vessels.values()),
      cargoes: Array.from(status.cargoes.values()),
    };
  });

  fastify.get('/simulation/events', async () => simulationStream.getEvents());
}
