// Explicitly use node-fetch v2
const fetch = require('node-fetch');

exports.handler = async (event) => {
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Check if the request body is valid
  let code;
  try {
    const body = JSON.parse(event.body);
    code = body.code;
    if (!code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No authorization code provided' })
      };
    }
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid request body' })
    };
  }

  // Use environment variables or hardcoded values as fallback (for development only)
  const clientId = process.env.GITHUB_CLIENT_ID || 'Ov23li62SpDD7SKp9Kjb';
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || 'ba02cd6b5f0bd8667e79a6d49a2e43eb88aa2e8b';
  const redirectUri = process.env.REDIRECT_URI || 'https://golden-kheer-6876e9.netlify.app/auth/callback';

  try {
    console.log('Fetching token from GitHub with code:', code.substring(0, 5) + '...');
    
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data = await response.json();
    console.log('GitHub response:', data.error ? 'Error' : 'Success');
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('GitHub auth error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
}; 