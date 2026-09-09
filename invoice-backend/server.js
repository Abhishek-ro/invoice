import express from 'express';
import cors from 'cors';
import { requireActor } from './lib/errors.js';
import documentsRoutes from './routes/documents.js';
import reconciliationsRoutes from './routes/reconciliations.js';
import settingsRoutes from './routes/settings.js';
import exceptionsRoutes from './routes/exceptions.js';
import dashboardRoutes from './routes/dashboard.js';

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors()); // wide open — this is a localhost dev stand-in, not a deployment
app.use(express.json());

// §0: every mutating request carries X-Actor-Id / X-Actor-Name, or 400.
app.use('/api/v1', (req, res, next) => {
  if (req.method === 'GET') return next();
  return requireActor(req, res, next);
});

const api = express.Router();
api.use(documentsRoutes);
api.use(reconciliationsRoutes);
api.use(settingsRoutes);
api.use(exceptionsRoutes);
api.use(dashboardRoutes);
app.use('/api/v1', api);

app.use((req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } });
});

// Single error handler — every ApiError becomes the §0 envelope. Anything
// else (a bug in this mock) becomes a generic 500 in that same shape
// rather than leaking a stack trace to the frontend.
app.use((err, req, res, _next) => {
  if (err.status && err.code) {
    return res.status(err.status).json(err.toBody());
  }
  // eslint-disable-next-line no-console
  console.error('[invoice-backend] unhandled error:', err);
  res.status(500).json({ error: { code: 'internal_error', message: 'Internal error.' } });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[invoice-backend] listening on http://localhost:${PORT} — API base: http://localhost:${PORT}/api/v1`);
});
