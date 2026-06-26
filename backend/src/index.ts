import express from 'express';
import { authRouter } from './auth.ts';
import { loadConfig } from './store.ts';
import { API_VERSION } from './version.ts';

const PORT = parseInt(process.env.BACKEND_PORT ?? '3001', 10);
const HOST = process.env.BACKEND_HOST ?? 'localhost';

const app = express();
// Permissive CORS so the backend can also be hit directly (e.g. curl) during local
// dev; the app itself calls it same-origin through the Vite /api proxy.
app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (request.method === 'OPTIONS') { response.sendStatus(204); return; }
  next();
});
app.use(express.json());

app.use('/api', authRouter);

app.get('/api/status', (_request, response) => {
  const config = loadConfig();
  response.json({
    configured: config !== null,
    host: config?.host ?? null,
    clientUuid: config?.clientUuid ?? null,
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Backend running on http://${HOST}:${PORT}`);
  console.log(`API version: ${API_VERSION}`);
});
