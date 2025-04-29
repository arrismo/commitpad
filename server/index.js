import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Database connection
const sql = neon(process.env.DATABASE_URL);

// Middleware
app.use(cors());
app.use(express.json());

// GitHub OAuth endpoints
app.post('/auth/github', async (req, res) => {
  const { code } = req.body;
  
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Database setup
async function setupDatabase() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        github_id TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        access_token TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        title TEXT NOT NULL,
        content TEXT,
        path TEXT NOT NULL,
        repository TEXT NOT NULL,
        last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        synced BOOLEAN DEFAULT false
      )
    `;
    
    console.log('Database tables created successfully');
  } catch (error) {
    console.error('Error setting up database:', error);
  }
}

setupDatabase();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});