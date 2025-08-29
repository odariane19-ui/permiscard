import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

import { storage } from "./storage";
import { generateQRPayload, verifyQRSignature, getPublicKey } from "./services/qr-crypto";
import { generatePermitCard, generateBatchCards } from "./services/pdf-generator";
import { createPermitSchema } from "@shared/schema";
import { z } from "zod";

const upload = multer({ storage: multer.memoryStorage() });
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Authentication middleware
const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await storage.getUser(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Identifiants incorrects' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Identifiants incorrects' });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
      
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Erreur de connexion' });
    }
  });

  // Public key endpoint
  app.get('/api/public-key', (req, res) => {
    res.json({ publicKey: getPublicKey() });
  });

  // Statistics endpoint
  app.get('/api/stats', requireAuth, async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get statistics' });
    }
  });

  // Config management
  app.get('/api/configs', requireAuth, async (req, res) => {
    try {
      const configs = await storage.getConfigs();
      res.json(configs);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get configs' });
    }
  });

  app.get('/api/configs/:type', requireAuth, async (req, res) => {
    try {
      const configs = await storage.getConfigsByType(req.params.type);
      res.json(configs);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get configs' });
    }
  });

  app.post('/api/configs', requireAuth, requireAdmin, async (req, res) => {
    try {
      const config = await storage.createConfig(req.body);
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create config' });
    }
  });

  app.delete('/api/configs/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteConfig(req.params.id);
      if (!success) {
        return res.status(404).json({ message: 'Config not found' });
      }
      res.json({ message: 'Config deleted' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete config' });
    }
  });

  // User management
  app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get users' });
    }
  });

  app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
    try {
      const user = await storage.createUser(req.body);
      res.json({ ...user, password: '[HIDDEN]' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to create user' });
    }
  });

  // Create permit
  app.post('/api/permits', requireAuth, upload.single('photo'), async (req: MulterRequest, res) => {
    try {
      const permitData = JSON.parse(req.body.permitData);
      
      if (req.file) {
        permitData.photo = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }

      const validatedData = createPermitSchema.parse(permitData);
      const permit = await storage.createPermit(validatedData);
      
      const { payload, signature } = generateQRPayload(permit.id);
      const card = await storage.createCard({
        permitId: permit.id,
        qrPayload: payload,
        qrSignature: signature,
        version: 1
      });

      res.json({ ...permit, card });
    } catch (error) {
      console.error('Error creating permit:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Validation error', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to create permit' });
      }
    }
  });

  // Get permits
  app.get('/api/permits', requireAuth, async (req, res) => {
    try {
      const { zone, status, search, limit = '50', offset = '0' } = req.query;
      
      const permits = await storage.getPermits({
        zone: zone as string,
        status: status as string,
        search: search as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      res.json(permits);
    } catch (error) {
      console.error('Error getting permits:', error);
      res.status(500).json({ message: 'Failed to get permits' });
    }
  });

  // Get single permit
  app.get('/api/permits/:id', requireAuth, async (req, res) => {
    try {
      const permit = await storage.getPermit(req.params.id);
      if (!permit) {
        return res.status(404).json({ message: 'Permit not found' });
      }
      res.json(permit);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get permit' });
    }
  });

  // Generate card PDF
  app.get('/api/cards/:permitId/pdf', requireAuth, async (req, res) => {
    try {
      const permit = await storage.getPermit(req.params.permitId);
      if (!permit) {
        return res.status(404).json({ message: 'Permit not found' });
      }

      const card = await storage.getCardByPermitId(req.params.permitId);
      if (!card) {
        return res.status(404).json({ message: 'Card not found' });
      }

      const qrPayload = `peche://verify?d=${card.qrPayload}&s=${card.qrSignature}`;
      const pdfBuffer = await generatePermitCard(permit, qrPayload);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="permit-${permit.numSerie}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ message: 'Failed to generate PDF' });
    }
  });

  // Generate batch PDF
  app.post('/api/cards/batch-pdf', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { permitIds } = req.body;
      
      if (!Array.isArray(permitIds) || permitIds.length === 0) {
        return res.status(400).json({ message: 'Invalid permit IDs' });
      }

      const permits = [];
      const qrPayloads = [];

      for (const permitId of permitIds) {
        const permit = await storage.getPermit(permitId);
        const card = await storage.getCardByPermitId(permitId);
        
        if (permit && card) {
          permits.push(permit);
          qrPayloads.push(`peche://verify?d=${card.qrPayload}&s=${card.qrSignature}`);
        }
      }

      if (permits.length === 0) {
        return res.status(404).json({ message: 'No valid permits found' });
      }

      const pdfBuffer = await generateBatchCards(permits, qrPayloads);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="permits-batch.pdf"');
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating batch PDF:', error);
      res.status(500).json({ message: 'Failed to generate batch PDF' });
    }
  });

  // Verify QR code
  app.post('/api/scans/verify', async (req, res) => {
    try {
      const { qrData } = req.body;
      
      const url = new URL(qrData);
      if (url.protocol !== 'peche:' || url.hostname !== 'verify') {
        return res.status(400).json({ message: 'Invalid QR code format' });
      }

      const payload = url.searchParams.get('d');
      const signature = url.searchParams.get('s');

      if (!payload || !signature) {
        return res.status(400).json({ message: 'Missing QR code data' });
      }

      const qrPayload = verifyQRSignature(payload, signature);
      if (!qrPayload) {
        return res.status(400).json({ 
          message: 'Invalid QR code signature',
          result: 'invalid'
        });
      }

      const permit = await storage.getPermit(qrPayload.id);
      if (!permit) {
        return res.status(404).json({ 
          message: 'Permit not found',
          result: 'invalid'
        });
      }

      const now = new Date();
      const expiration = new Date(permit.dateExpiration);
      const isExpired = expiration <= now;

      await storage.createScanLog({
        cardId: permit.card?.id || null,
        agentId: null,
        result: isExpired ? 'expired' : 'valid',
        mode: 'online'
      });

      res.json({
        result: isExpired ? 'expired' : 'valid',
        permit: {
          fisher: permit.fisher,
          numSerie: permit.numSerie,
          zonePeche: permit.zonePeche,
          dateExpiration: permit.dateExpiration,
          typePeche: permit.typePeche
        },
        isExpired,
        message: isExpired ? 'Permit has expired' : 'Valid permit'
      });
    } catch (error) {
      console.error('Error verifying QR:', error);
      res.status(500).json({ message: 'Failed to verify QR code' });
    }
  });

  // Export data
  app.get('/api/export/csv', requireAuth, requireAdmin, async (req, res) => {
    try {
      const permits = await storage.getPermits();
      
      const headers = [
        'Serial Number', 'Fisher Name', 'Phone', 'Zone', 'Type', 
        'Issue Date', 'Expiration Date', 'Status'
      ];
      
      const rows = permits.map(permit => {
        const isExpired = new Date(permit.dateExpiration) <= new Date();
        return [
          permit.numSerie,
          `${permit.fisher.nom} ${permit.fisher.prenoms}`,
          permit.fisher.telephone,
          permit.zonePeche,
          permit.typePeche,
          permit.dateDelivrance,
          permit.dateExpiration,
          isExpired ? 'Expired' : 'Active'
        ];
      });

      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="permits-export.csv"');
      res.send(csvContent);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      res.status(500).json({ message: 'Failed to export data' });
    }
  });

  // Serve media files
  app.get('/api/media/:id', requireAuth, async (req, res) => {
    try {
      const media = await storage.getMediaByPermitId(req.params.id);
      const photo = media.find(m => m.type === 'photo_identite');
      
      if (!photo || !photo.base64Data) {
        return res.status(404).json({ message: 'Photo not found' });
      }

      const [header, data] = photo.base64Data.split(',');
      const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
      const buffer = Buffer.from(data, 'base64');

      res.setHeader('Content-Type', mimeType);
      res.send(buffer);
    } catch (error) {
      res.status(500).json({ message: 'Failed to serve media' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}