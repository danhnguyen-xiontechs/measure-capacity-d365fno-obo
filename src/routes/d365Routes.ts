import { Router, Request, Response } from 'express';
import { D365Connector } from '../core/D365Connector';

const router = Router();
const d365 = new D365Connector();

// Auth middleware - extract token từ Authorization header
const extractTokenMiddleware = (req: Request, res: Response, next: Function) => {
  const auth = req.headers['authorization'];
  if (!auth || Array.isArray(auth)) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const match = /^Bearer\s+(.+)$/i.exec(auth);
  if (!match || !match[1]) {
    return res.status(401).json({ error: 'Invalid Authorization header' });
  }

  // Set token vào request context
  //d365.setUserAssertion(match[1]);
  next();
};

router.use(extractTokenMiddleware);

/**
 * @swagger
 * /api/d365/verify-token:
 *   get:
 *     summary: Verify JWT token and get user info
 *     description: Decode and display user information from the JWT token
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid: 
 *                   type: boolean
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 oid:
 *                   type: string
 *                 appid:
 *                   type: string
 *       401:
 *         description: Unauthorized - Invalid or missing token
 */
router.get('/verify-token', (req: Request, res: Response) => {
  try {
    const auth = req.headers['authorization'];
    if (!auth || Array.isArray(auth)) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const match = /^Bearer\s+(.+)$/i.exec(auth);
    if (!match || !match[1]) {
      return res.status(401).json({ error: 'Invalid Authorization header' });
    }

    const token = match[1];
    
    // Decode JWT without verification (for inspection only)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return res.status(400).json({ error: 'Invalid token format' });
    }

    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return res.status(200).json({
        valid: true,
        name: payload.name || payload.unique_name,
        email: payload.email,
        oid: payload.oid,
        appid: payload.appid,
        upn: payload.upn,
        aud: payload.aud,
        iss: payload.iss,
        exp: new Date(payload.exp * 1000).toISOString(),
        iat: new Date(payload.iat * 1000).toISOString(),
      });
    } catch (decodeError) {
      return res.status(400).json({ error: 'Failed to decode token', details: String(decodeError) });
    }
  } catch (error: any) {
    console.error('Error verifying token:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/d365/records/{entityName}:
 *   get:
 *     summary: Read records from D365 entity
 *     description: Fetch records from a specific D365 Finance and Operations entity using OData query
 *     parameters:
 *       - in: path
 *         name: entityName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the D365 entity (e.g., EmployeesV2)
 *       - in: query
 *         name: query
 *         required: false
 *         schema:
 *           type: string
 *         description: OData query parameters (e.g., $top=10&$filter=...)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 value:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 */
router.get('/records/:entityName', async (req: Request, res: Response) => {
  try {
    const { entityName } = req.params;
    const { query } = req.query;
    const auth = req.headers['authorization'];
    
    if (!entityName) {
      return res.status(400).json({ error: 'Entity name is required' });
    }

    if (!auth || Array.isArray(auth)) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const match = /^Bearer\s+(.+)$/i.exec(auth);
    if (!match || !match[1]) {
      return res.status(401).json({ error: 'Invalid Authorization header' });
    }

    const userToken = match[1];
    d365.setToken(userToken);
    const response = await d365.readRecord(entityName, query as string);
    const data = await response.json();

    res.status(200).json(data);
  } catch (error: any) {
    console.error('Error reading record:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/d365/records/{entityName}:
 *   post:
 *     summary: Create a new record in D365 entity
 *     description: Create a new record in a specific D365 Finance and Operations entity
 *     parameters:
 *       - in: path
 *         name: entityName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the D365 entity
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             example:
 *               PersonnelNumber: "123"
 *               WorkerName: "John Doe"
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully created record
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error
 */
router.post('/records/:entityName', async (req: Request, res: Response) => {
  try {
    const { entityName } = req.params;
    const data = req.body;
    const auth = req.headers['authorization'];

    if (!entityName) {
      return res.status(400).json({ error: 'Entity name is required' });
    }

    if (!auth || Array.isArray(auth)) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    const match = /^Bearer\s+(.+)$/i.exec(auth);
    if (!match || !match[1]) {
      return res.status(401).json({ error: 'Invalid Authorization header' });
    }

    const userToken = match[1];
    const result = await d365.createRecord(entityName, data);
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Error creating record:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
