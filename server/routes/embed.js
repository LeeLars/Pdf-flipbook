import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * GET /embed/:clientSlug
 * Serve the embed page for a specific client
 * This is the URL you use in your iframe
 */
router.get('/:clientSlug', (req, res) => {
  const { clientSlug } = req.params;
  
  // In production, serve the built React app
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  } else {
    // In development, redirect to Vite dev server
    const viteUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${viteUrl}/${clientSlug}`);
  }
});

export default router;
