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

    const passwordHash = await bcrypt.hash(password, 12);
    
    if (existingUser.rows.length === 0) {
      // Create admin user
      await query(
        `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)`,
        [email, passwordHash, 'admin']
      );
      console.log(`✅ Admin gebruiker aangemaakt: ${email}`);
    } else {
      // Update existing user password
      await query(
        `UPDATE users SET password_hash = $1, email = $2 WHERE email = 'admin@example.com' OR email = $2`,
        [passwordHash, email]
      );
      console.log(`✅ Admin wachtwoord bijgewerkt voor: ${email}`);
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
    console.error(error.message);
    process.exit(1);
  }
};

await seed();
