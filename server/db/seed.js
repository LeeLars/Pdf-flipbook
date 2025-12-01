import { query } from './index.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const seed = async () => {
  try {
    console.log('🌱 Database seeding starten...');

    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'admin123';

    // Check if admin already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length === 0) {
      // Create admin user
      const passwordHash = await bcrypt.hash(password, 12);
      await query(
        `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)`,
        [email, passwordHash, 'admin']
      );
      console.log(`✅ Admin gebruiker aangemaakt: ${email}`);
    } else {
      console.log(`ℹ️ Admin gebruiker bestaat al: ${email}`);
    }

    // Create default client
    const existingClient = await query(
      'SELECT id FROM clients WHERE slug = $1',
      ['vrije-tijd']
    );

    if (existingClient.rows.length === 0) {
      await query(
        `INSERT INTO clients (slug, name, settings) VALUES ($1, $2, $3)`,
        ['vrije-tijd', 'Vrije Tijd Magazine', JSON.stringify({
          primaryColor: '#1a365d',
          accentColor: '#3182ce'
        })]
      );
      console.log('✅ Default client aangemaakt: vrije-tijd');
    }

    console.log('🎉 Database seeding voltooid!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding fout:', error);
    process.exit(1);
  }
};

seed();
