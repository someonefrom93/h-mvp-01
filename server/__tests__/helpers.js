import { openDatabase } from '../db.js';
import { migrate } from '../migrate.js';
import { createApp } from '../index.js';

function makeApp() {
  const db = openDatabase(':memory:');
  migrate(db);
  return createApp({ db });
}

export { makeApp };
