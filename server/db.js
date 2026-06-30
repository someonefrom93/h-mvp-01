import Database from 'better-sqlite3';
import { DB_PATH } from './config.js';

function openDatabase(dbPath = DB_PATH) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

export { openDatabase };
