import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  console.warn('[db] DATABASE_URL is not set — database queries will fail.');
}

const databaseUrl = process.env.DATABASE_URL ?? '';

// Enable SSL when running in production OR when the connection string explicitly
// requests it (e.g. pointing a local dev machine at the Azure cloud DB).
const useSSL =
  process.env.NODE_ENV === 'production' || databaseUrl.includes('sslmode=require');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSSL ? { rejectUnauthorized: true } : undefined,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client', err);
});

export default pool;
