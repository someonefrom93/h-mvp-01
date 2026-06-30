import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { PORT, DB_PATH } from './config.js';
import { openDatabase } from './db.js';
import { migrate } from './migrate.js';
import ordersRouter from './routes/orders.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Creates and returns an Express app, optionally with a custom db (for testing).
 * Does NOT start listening — caller calls app.listen().
 */
function createApp({ db } = {}) {
  const app = express();

  app.use(express.json());

  // Attach db to req for use in routes
  app.use((req, res, next) => {
    req.db = db;
    next();
  });

  // Routes
  app.use('/api/orders', ordersRouter);

  // Static files served from repo root
  app.use(express.static(join(__dirname, '..')));

  return app;
}

/**
 * Boot the server for development.
 * Creates its own DB connection and runs migrations.
 */
function boot() {
  const dataDir = join(__dirname, 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const db = openDatabase();
  migrate(db);

  const app = createApp({ db });

  const server = app.listen(PORT, () => {
    console.log(`Burger King server on http://localhost:${PORT}`);
  });

  return server;
}

// When run directly (node index.js), boot
boot();

export { createApp };
