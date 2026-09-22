import { randomUUID } from 'node:crypto';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  InMemoryDemandSupplyStore,
} from '@rycon/ds-system';

const developmentPasskey = 'rycon-local-access';
const passkey = process.env.DS_SYSTEM_PASSKEY ?? developmentPasskey;
const sessions = new Set<string>();

const store = new InMemoryDemandSupplyStore(
  [{
    requestId: 'ORDER-DEMO-001',
    origin: 'node-PORT-ALPHA',
    destination: 'node-PORT-BETA',
    quantity: 100,
    earliestDeparture: 0,
    deadline: 48,
    cargoType: 'GENERAL',
  }],
  [{ id: 'VESSEL-DEMO-001', capability: 'C', startNodeId: 'node-PORT-ALPHA' }],
);

function sessionToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length);
  return sessions.has(token) ? token : null;
}

function requireSession(request: FastifyRequest, reply: FastifyReply): boolean {
  if (sessionToken(request)) return true;
  reply.code(401).send({ error: 'DS System access required' });
  return false;
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : 'DS System request failed';
}

export default async function dsRoutes(fastify: FastifyInstance) {
  fastify.post('/ds/auth', async (request, reply) => {
    const body = (request.body as { passkey?: unknown } | undefined) ?? {};
    if (body.passkey !== passkey) {
      return reply.code(401).send({ error: 'Invalid passkey' });
    }

    const token = randomUUID();
    sessions.add(token);
    return { token };
  });

  fastify.post('/ds/logout', async (request, reply) => {
    const token = sessionToken(request);
    if (token) sessions.delete(token);
    return reply.code(204).send();
  });

  fastify.get('/ds/status', async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const demands = store.getCargoDemands();
    const vessels = store.getVesselSupply();
    return {
      demandProvider: 'InMemoryDemandSupplyStore',
      fleetProvider: 'InMemoryDemandSupplyStore',
      demandCount: demands.length,
      vesselCount: vessels.length,
      latestSnapshot: store.getLatestSnapshot(),
    };
  });

  fastify.get('/ds/demands', async (request, reply) => {
    if (!requireSession(request, reply)) return;
    return { demands: store.getCargoDemands() };
  });

  fastify.post('/ds/demands', async (request, reply) => {
    if (!requireSession(request, reply)) return;
    try {
      const demand = store.addDemand(request.body);
      return reply.code(201).send({ demand });
    } catch (error) {
      return reply.code(400).send({ error: messageFor(error) });
    }
  });

  fastify.get('/ds/supply', async (request, reply) => {
    if (!requireSession(request, reply)) return;
    return { vessels: store.getVesselSupply() };
  });

  fastify.post('/ds/supply', async (request, reply) => {
    if (!requireSession(request, reply)) return;
    try {
      const vessel = store.addVessel(request.body);
      return reply.code(201).send({ vessel });
    } catch (error) {
      return reply.code(400).send({ error: messageFor(error) });
    }
  });

  fastify.post('/ds/snapshots', async (request, reply) => {
    if (!requireSession(request, reply)) return;
    const snapshot = await store.createSnapshot();
    return reply.code(201).send({ snapshot });
  });

  fastify.get('/ds/snapshots/latest', async (request, reply) => {
    if (!requireSession(request, reply)) return;
    return { snapshot: store.getLatestSnapshot() };
  });
}