import express from 'express';
import multer from 'multer';
import { query } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { uploadFile, deleteFile, getKeyFromUrl } from '../services/storage.js';
import { getPdfMetadata, generateCoverImage, validatePdf } from '../services/pdfProcessor.js';

const router = express.Router();

// Configure multer for memory storage (files go to buffer, then to S3)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Alleen PDF bestanden zijn toegestaan'), false);
    }
  }
});

/**
 * GET /api/magazines
 * Get all magazines for a client (public)
 * Query params: client (required), limit, offset
 */
router.get('/', async (req, res) => {
  try {
    const { client, limit = 50, offset = 0 } = req.query;

    if (!client) {
      return res.status(400).json({ error: 'Client parameter is verplicht' });
    }

    const result = await query(
      `SELECT id, client_slug, title, pdf_url, cover_url, page_count, 
              file_size, sort_order, created_at, published_at
       FROM magazines 
       WHERE client_slug = $1 AND is_published = true
       ORDER BY sort_order ASC, created_at DESC
       LIMIT $2 OFFSET $3`,
      [client, parseInt(limit), parseInt(offset)]
    );

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM magazines 
       WHERE client_slug = $1 AND is_published = true`,
      [client]
    );

    res.json({
      magazines: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get magazines error:', error);
    res.status(500).json({ error: 'Er is een fout opgetreden' });
  }
});

/**
 * GET /api/magazines/latest
 * Get the most recent magazine for a client (public)
 */
router.get('/latest', async (req, res) => {
  try {
    const { client } = req.query;

    if (!client) {
      return res.status(400).json({ error: 'Client parameter is verplicht' });
    }

    const result = await query(
      `SELECT id, client_slug, title, pdf_url, cover_url, page_count, 
              file_size, created_at, published_at
       FROM magazines 
       WHERE client_slug = $1 AND is_published = true
       ORDER BY created_at DESC
       LIMIT 1`,
      [client]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Geen magazine gevonden' });
    }

    res.json({ magazine: result.rows[0] });
  } catch (error) {
    console.error('Get latest magazine error:', error);
    res.status(500).json({ error: 'Er is een fout opgetreden' });
  }
});

/**
 * GET /api/magazines/:id
 * Get a specific magazine by ID (public)
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT id, client_slug, title, pdf_url, cover_url, page_count, 
              file_size, created_at, published_at
       FROM magazines 
       WHERE id = $1 AND is_published = true`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Magazine niet gevonden' });
    }

    res.json({ magazine: result.rows[0] });
  } catch (error) {
    console.error('Get magazine error:', error);
    res.status(500).json({ error: 'Er is een fout opgetreden' });
  }
});

/**
 * POST /api/magazines
 * Upload a new magazine (protected)
 */
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  let pdfUrl = null;
  let coverUrl = null;

  try {
    const { title, client_slug } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'PDF bestand is verplicht' });
    }

    if (!title || !client_slug) {
      return res.status(400).json({ error: 'Titel en client_slug zijn verplicht' });
    }

    // Validate PDF
    const isValidPdf = await validatePdf(file.buffer);
    if (!isValidPdf) {
      return res.status(400).json({ error: 'Ongeldig PDF bestand' });
    }

    // Get PDF metadata
    const metadata = await getPdfMetadata(file.buffer);

    // Upload PDF to S3
    const pdfResult = await uploadFile(
      file.buffer,
      file.originalname,
      'application/pdf',
      `magazines/${client_slug}`
    );
    pdfUrl = pdfResult.url;

    // Generate and upload cover image
    try {
      const coverBuffer = await generateCoverImage(file.buffer);
      const coverResult = await uploadFile(
        coverBuffer,
        `cover-${Date.now()}.jpg`,
        'image/jpeg',
        `covers/${client_slug}`
      );
      coverUrl = coverResult.url;
    } catch (coverError) {
      console.error('Cover generation failed, continuing without cover:', coverError);
      // Continue without cover - not critical
    }

    // Insert into database
    const result = await query(
      `INSERT INTO magazines (client_slug, title, pdf_url, cover_url, page_count, file_size)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, client_slug, title, pdf_url, cover_url, page_count, file_size, created_at`,
      [client_slug, title, pdfUrl, coverUrl, metadata.pageCount, file.size]
    );

    res.status(201).json({
      success: true,
      message: 'Magazine succesvol geüpload',
      magazine: result.rows[0]
    });
  } catch (error) {
    console.error('Upload magazine error:', error);

    // Cleanup uploaded files on error
    if (pdfUrl) {
      try {
        const pdfKey = getKeyFromUrl(pdfUrl);
        if (pdfKey) await deleteFile(pdfKey);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
    if (coverUrl) {
      try {
        const coverKey = getKeyFromUrl(coverUrl);
        if (coverKey) await deleteFile(coverKey);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }

    res.status(500).json({ error: 'Er is een fout opgetreden bij het uploaden' });
  }
});

/**
 * PATCH /api/magazines/:id
 * Update magazine (title, published status) (protected)
 */
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, is_published } = req.body;

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount}`);
      values.push(title);
      paramCount++;
    }

    if (is_published !== undefined) {
      updates.push(`is_published = $${paramCount}`);
      values.push(is_published);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Geen updates opgegeven' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const result = await query(
      `UPDATE magazines SET ${updates.join(', ')} 
       WHERE id = $${paramCount}
       RETURNING id, client_slug, title, pdf_url, cover_url, page_count, 
                 file_size, is_published, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Magazine niet gevonden' });
    }

    res.json({
      success: true,
      message: 'Magazine bijgewerkt',
      magazine: result.rows[0]
    });
  } catch (error) {
    console.error('Update magazine error:', error);
    res.status(500).json({ error: 'Er is een fout opgetreden' });
  }
});

/**
 * DELETE /api/magazines/:id
 * Delete a magazine (protected)
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Get magazine to find file URLs
    const magazine = await query(
      'SELECT pdf_url, cover_url FROM magazines WHERE id = $1',
      [id]
    );

    if (magazine.rows.length === 0) {
      return res.status(404).json({ error: 'Magazine niet gevonden' });
    }

    const { pdf_url, cover_url } = magazine.rows[0];

    // Delete from database first
    await query('DELETE FROM magazines WHERE id = $1', [id]);

    // Delete files from S3 (non-blocking, errors logged but not thrown)
    if (pdf_url) {
      try {
        const pdfKey = getKeyFromUrl(pdf_url);
        if (pdfKey) await deleteFile(pdfKey);
      } catch (error) {
        console.error('Error deleting PDF from storage:', error);
      }
    }

    if (cover_url) {
      try {
        const coverKey = getKeyFromUrl(cover_url);
        if (coverKey) await deleteFile(coverKey);
      } catch (error) {
        console.error('Error deleting cover from storage:', error);
      }
    }

    res.json({ success: true, message: 'Magazine verwijderd' });
  } catch (error) {
    console.error('Delete magazine error:', error);
    res.status(500).json({ error: 'Er is een fout opgetreden' });
  }
});

/**
 * PATCH /api/magazines/reorder
 * Reorder magazines (protected)
 */
router.patch('/reorder', authMiddleware, async (req, res) => {
  try {
    const { order } = req.body;

    if (!order || !Array.isArray(order)) {
      return res.status(400).json({ error: 'Order array is verplicht' });
    }

    // Update sort_order for each magazine
    for (const item of order) {
      await query(
        'UPDATE magazines SET sort_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [item.sort_order, item.id]
      );
    }

    res.json({ success: true, message: 'Volgorde bijgewerkt' });
  } catch (error) {
    console.error('Reorder magazines error:', error);
    res.status(500).json({ error: 'Er is een fout opgetreden' });
  }
});

/**
 * GET /api/magazines/admin/all
 * Get all magazines including unpublished (protected)
 */
router.get('/admin/all', authMiddleware, async (req, res) => {
  try {
    const { client } = req.query;

    let queryText = `
      SELECT id, client_slug, title, pdf_url, cover_url, page_count, 
             file_size, is_published, created_at, updated_at
      FROM magazines
    `;
    const values = [];

    if (client) {
      queryText += ' WHERE client_slug = $1';
      values.push(client);
    }

    queryText += ' ORDER BY sort_order ASC, created_at DESC';

    const result = await query(queryText, values);

    res.json({ magazines: result.rows });
  } catch (error) {
    console.error('Get all magazines error:', error);
    res.status(500).json({ error: 'Er is een fout opgetreden' });
  }
});

export default router;
