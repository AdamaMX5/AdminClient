import 'dotenv/config';
import express from 'express';
import path from 'path';

import { performHealthCheck } from './lib/health';

const app = express();
const PORT = process.env.PORT ?? 3000;

// ---------------------------------------------------------------------------
// Public Health Endpoint (no auth required) — consumed e.g. by VirtualOffice's
// /api/services/status proxy to display service status.
// ---------------------------------------------------------------------------

app.get('/health', async (_req, res) => {
  res.json(await performHealthCheck());
});

// ---------------------------------------------------------------------------
// Static Frontend
// ---------------------------------------------------------------------------

const PUBLIC = path.join(__dirname, 'public');
app.use(express.static(PUBLIC));

// All other routes → SPA
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Admin Client running on port ${PORT}`);
});
