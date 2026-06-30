import express from 'express';
import { authRouter } from './auth.ts';
import { loadConfig } from './store.ts';
import { API_VERSION } from './version.ts';

const PORT = parseInt(process.env.BACKEND_PORT ?? '3001', 10);
const HOST = process.env.BACKEND_HOST ?? 'localhost';

const app = express();
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
