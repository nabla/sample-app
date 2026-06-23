import express from 'express';
import { authRouter } from './auth.js';
import { loadConfig, loadKeypair } from './store.js';
import { API_VERSION } from './version.js';

const PORT = parseInt(process.env.BACKEND_PORT ?? '3001', 10);
const HOST = process.env.BACKEND_HOST ?? 'localhost';

const app = express();
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
    hasKeypair: loadKeypair() !== null,
    host: config?.host ?? null,
    clientUuid: config?.clientUuid ?? null,
    apiVersion: API_VERSION,
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Backend running on http://${HOST}:${PORT}`);
  console.log(`API version: ${API_VERSION}`);
});
