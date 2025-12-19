import { query } from './index.js';
import dotenv from 'dotenv';

dotenv.config();

const migrate = async () => {
  try {
    console.log('🔄 Database migratie starten...');

    // Enable UUID extension
    await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users tabel aangemaakt');

    // Create magazines table
    await query(`
      CREATE TABLE IF NOT EXISTS magazines (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        client_slug VARCHAR(255) NOT NULL,
        title VARCHAR(500) NOT NULL,
        pdf_url TEXT NOT NULL,
        cover_url TEXT,
        page_count INTEGER DEFAULT 0,
        file_size BIGINT DEFAULT 0,
        is_published BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Magazines tabel aangemaakt');
    
    // Add sort_order column if it doesn't exist (for existing databases)
    await query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name='magazines' AND column_name='sort_order') THEN
          ALTER TABLE magazines ADD COLUMN sort_order INTEGER DEFAULT 0;
        END IF;
      END $$;
    `);

    // Create index for faster queries
    await query(`
      CREATE INDEX IF NOT EXISTS idx_magazines_client_slug 
      ON magazines(client_slug);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_magazines_created_at 
      ON magazines(created_at DESC);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_magazines_published 
      ON magazines(client_slug, is_published, created_at DESC);
    `);
    console.log('✅ Indexen aangemaakt');

    // Create clients table for multi-tenant support
    await query(`
      CREATE TABLE IF NOT EXISTS clients (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        slug VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(500) NOT NULL,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Clients tabel aangemaakt');

    console.log('🎉 Database migratie voltooid!');
  } catch (error) {
    console.error('❌ Migratie fout:', error);
    throw error;
  }
};

await migrate();
