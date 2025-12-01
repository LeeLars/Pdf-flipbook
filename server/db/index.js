import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Database verbonden');
});

pool.on('error', (err) => {
  console.error('❌ Database fout:', err);
});

export const query = (text, params) => pool.query(text, params);

export default pool;
