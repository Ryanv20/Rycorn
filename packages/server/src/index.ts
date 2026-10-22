import { createApp } from './app.js';

const app = await createApp();

try {
  const port = Number(process.env.RYCORN_API_PORT ?? 3000);
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`Server listening on http://localhost:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
