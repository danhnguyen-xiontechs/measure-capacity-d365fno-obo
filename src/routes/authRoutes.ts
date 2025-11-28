import { Router, Request, Response } from 'express';
import { D365Connector } from '../core/D365Connector';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const d365 = new D365Connector();

router.post('/api/auth/login', (req: Request, res: Response) => {
    const params = new URLSearchParams({
      client_id: process.env.API_CLIENT_ID!,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      requested_token_use: "on_behalf_of",
      scope: `api://${process.env.API_EAS_CLIENT_ID}/.default`,
    });

    const tokenResp = fetch(`https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    return res.json(tokenResp);
});

// Get auth config
router.get('/api/auth/config', (req: Request, res: Response) => {
  res.json({
    tenantId: process.env.TENANT_ID,
    clientId: process.env.API_CLIENT_ID,
    apiAppId: process.env.API_EAS_CLIENT_ID,
  });
});

// Serve login page
router.get('/', (req: Request, res: Response) => {
  const filePath = path.join(__dirname, '../public/index.html');
  res.sendFile(filePath);
});

// Callback from Microsoft
router.get('/auth/callback', (req: Request, res: Response) => {
  // Microsoft sends the token in URL fragment, not query
  // The frontend will handle this
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Get user info from token
router.get('/api/auth/user-info', async (req: Request, res: Response) => {
  try {
    console.log('Getting user info...');
    const auth = req.headers['authorization'];
    if (!auth) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const match = /^Bearer\s+(.+)$/i.exec(auth);
    if (!match) {
      return res.status(401).json({ error: 'Invalid authorization header' });
    }

    const token = match[1];
    
    // Decode JWT without verification (for user info only)
    // In production, you should verify the token
    const parts = token.split('.');
    if (parts.length !== 3) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    
    res.json({
      name: payload.name || payload.email || 'User',
      email: payload.email,
      oid: payload.oid
    });
  } catch (error: any) {
    console.error('Error getting user info:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
