const fetch = require('node-fetch');

exports.handler = async (event) => {
  const { code } = JSON.parse(event.body);

  // Use environment variables or hardcoded values as fallback (for development only)
  const clientId = process.env.GITHUB_CLIENT_ID || 'Ov23li62SpDD7SKp9Kjb';
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || 'ba02cd6b5f0bd8667e79a6d49a2e43eb88aa2e8b';
  const redirectUri = process.env.REDIRECT_URI || 'https://golden-kheer-6876e9.netlify.app/auth/callback';

  try {
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
    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('GitHub auth error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
}; 