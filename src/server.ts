import 'dotenv/config';
import express from 'express';
import path from 'path';

import configRouter from './routes/configRouter';
import servicesRouter, { performHealthCheck } from './routes/servicesRouter';
import monitorRouter from './routes/monitorRouter';
import { watchdog } from './lib/watchdog';

const app = express();
const PORT = process.env.PORT ?? 3000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(express.json());

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public Health Endpoint (no auth required)
// ---------------------------------------------------------------------------

app.get('/health', async (_req, res) => {
  res.json(await performHealthCheck());
});

// ---------------------------------------------------------------------------

app.use('/api/config', configRouter);
app.use('/api/services', servicesRouter);
app.use('/api/monitor', monitorRouter);

// ---------------------------------------------------------------------------
// Static Frontend
// ---------------------------------------------------------------------------

const PUBLIC = path.join(__dirname, 'public');
app.use(express.static(PUBLIC));

// All non-API routes → SPA
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Admin Client running on port ${PORT}`);
  watchdog.start(10_000);
  console.log('[Watchdog] Service-Monitor gestartet (Intervall: 10 s)');
});
