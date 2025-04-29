// Local development proxy server for GitHub authentication
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// GitHub OAuth configuration
const CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Ov23li62SpDD7SKp9Kjb';
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'ba02cd6b5f0bd8667e79a6d49a2e43eb88aa2e8b';
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://golden-kheer-6876e9.netlify.app/auth/callback';

// GitHub token exchange endpoint
app.post('/auth/github/token', async (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }
  
  try {
    console.log('Exchanging code for token with GitHub');
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    
    const data = await response.json();
    console.log('GitHub response:', data.error ? 'Error' : 'Success');
    res.json(data);
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Auth proxy server running on port ${PORT}`);
});

// Export for Netlify dev
module.exports = app; 