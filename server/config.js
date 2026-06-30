import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = 3000;
const DB_PATH = join(__dirname, 'data', 'orders.db');
const BUSINESS_PHONE = '5215512345678'; // digits-only, validated at boot

if (!/^\d{10,15}$/.test(BUSINESS_PHONE)) {
  throw new Error('BUSINESS_PHONE must be 10-15 digits, no + or spaces');
}

export { PORT, DB_PATH, BUSINESS_PHONE };
