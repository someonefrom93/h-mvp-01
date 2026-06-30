/**
 * Idempotent schema migration.
 * Current version: 1 — creates orders and order_items tables if missing.
 * Future migrations would insert a new version row and apply forward.
 */
function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name  TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      address        TEXT NOT NULL,
      notes          TEXT,
      subtotal       REAL NOT NULL,
      created_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_name TEXT NOT NULL,
      unit_price   REAL NOT NULL,
      quantity     INTEGER NOT NULL,
      line_total   REAL NOT NULL
    );
  `);

  const row = db.prepare('SELECT version FROM schema_version WHERE version = 1').get();
  if (!row) {
    db.prepare("INSERT INTO schema_version (version, applied_at) VALUES (1, datetime('now'))").run();
  }
}

export { migrate };
