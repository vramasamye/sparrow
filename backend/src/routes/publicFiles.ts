import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger'; // Assuming logger is correctly pathed

const router = Router();

// UPLOAD_DIR needs to be accessible here. Define it or import from a config.
// For simplicity, hardcoding relative to this file's expected final location.
const UPLOAD_DIR_FROM_ROOT = 'backend/uploads'; // Relative to project root
const UPLOAD_DIR = path.resolve(UPLOAD_DIR_FROM_ROOT);


// GET /api/public-files/view/:uniqueFilename (e.g., for avatars)
router.get('/view/:uniqueFilename', async (req, res) => {
  try {
    const { uniqueFilename } = req.params;

    // Basic sanitization for filename to prevent path traversal, though uniqueFilename should be safe.
    if (uniqueFilename.includes('..') || uniqueFilename.includes('/')) {
        return res.status(400).json({ error: 'Invalid filename.' });
    }

    let mimetype = 'application/octet-stream'; // Default
    const ext = path.extname(uniqueFilename).toLowerCase();
    if (['.jpg', '.jpeg'].includes(ext)) mimetype = 'image/jpeg';
    else if (ext === '.png') mimetype = 'image/png';
    else if (ext === '.gif') mimetype = 'image/gif';
    else if (ext === '.webp') mimetype = 'image/webp';
    // Add other types if this viewer is used for more than just images

    // Check in 'uploads/avatars/' then 'uploads/'
    const avatarFilePath = path.join(UPLOAD_DIR, 'avatars', uniqueFilename);
    const generalFilePath = path.join(UPLOAD_DIR, uniqueFilename);

    let finalPathToServe: string | null = null;

    if (fs.existsSync(avatarFilePath)) {
        finalPathToServe = avatarFilePath;
    } else if (fs.existsSync(generalFilePath)) {
        finalPathToServe = generalFilePath;
    }

    if (finalPathToServe) {
      res.setHeader('Content-Type', mimetype);
      const fileStream = fs.createReadStream(finalPathToServe);
      fileStream.on('error', (err) => {
        logger.error(`Error streaming file ${finalPathToServe}:`, err);
        res.status(500).json({ error: 'Failed to stream file.' });
      });
      fileStream.pipe(res);
    } else {
      logger.warn(`Public file not found on disk: ${uniqueFilename} (checked ${avatarFilePath} and ${generalFilePath})`);
      return res.status(404).json({ error: 'File not found.' });
    }
  } catch (error) {
    logger.error('Public file serving error:', error);
    res.status(500).json({ error: 'Failed to serve file.' });
  }
});

export default router;
