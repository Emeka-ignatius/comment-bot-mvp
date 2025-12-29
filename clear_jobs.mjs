import { drizzle } from 'drizzle-orm/mysql2';
import { jobs } from './drizzle/schema.js';

const db = drizzle(process.env.DATABASE_URL);

async function clearJobs() {
  try {
    const result = await db.delete(jobs).execute();
    console.log('Deleted', result.affectedRows, 'jobs');
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

clearJobs();
