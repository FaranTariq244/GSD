import express from 'express';
import multer from 'multer';
import pool from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { uploadFile, generateStorageKey, getDownloadUrl, deleteFile, generateThumbnail } from '../storage.js';

const router = express.Router();

// Configure multer for memory storage (we'll upload to S3, not disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/**
 * GET /tasks/:id/attachments
 * List all attachments for a task
 */
router.get('/tasks/:id/attachments', authenticate, async (req: AuthRequest, res) => {
  const taskId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const userId = req.userId!;

  try {
    // Verify user has access to this task via board membership
    const accessCheck = await pool.query(
      `SELECT t.id, t.board_id
       FROM tasks t
       INNER JOIN boards b ON b.id = t.board_id
       INNER JOIN account_members am ON am.account_id = b.account_id
       WHERE t.id = $1 AND am.user_id = $2`,
      [taskId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Fetch all attachments for the task with uploader information
    const result = await pool.query(
      `SELECT a.id, a.task_id, a.uploader_id, a.original_filename, a.mime_type, a.size_bytes, a.storage_key, a.thumbnail_key, a.created_at,
              u.id as uploader_user_id, u.name as uploader_name, u.email as uploader_email
       FROM attachments a
       INNER JOIN users u ON u.id = a.uploader_id
       WHERE a.task_id = $1
       ORDER BY a.created_at ASC`,
      [taskId]
    );

    // Generate presigned URLs for all attachments
    const attachments = await Promise.all(
      result.rows.map(async (row) => {
        const downloadUrl = await getDownloadUrl(row.storage_key);
        const thumbnailUrl = row.thumbnail_key ? await getDownloadUrl(row.thumbnail_key) : null;
        return {
          id: row.id,
          task_id: row.task_id,
          uploader_id: row.uploader_id,
          original_filename: row.original_filename,
          mime_type: row.mime_type,
          size_bytes: row.size_bytes,
          storage_key: row.storage_key,
          thumbnail_key: row.thumbnail_key,
          created_at: row.created_at,
          download_url: downloadUrl,
          thumbnail_url: thumbnailUrl,
          uploader: {
            id: row.uploader_user_id,
            name: row.uploader_name,
            email: row.uploader_email,
          },
        };
      })
    );

    res.json({ attachments });
  } catch (error) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

/**
 * POST /tasks/:id/attachments
 * Upload a file attachment to a task
 */
router.post('/tasks/:id/attachments', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
  const taskId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const userId = req.userId!;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Verify user has access to this task via board membership
    const accessCheck = await pool.query(
      `SELECT t.id, t.board_id
       FROM tasks t
       INNER JOIN boards b ON b.id = t.board_id
       INNER JOIN account_members am ON am.account_id = b.account_id
       WHERE t.id = $1 AND am.user_id = $2`,
      [taskId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Generate storage key and upload to S3
    const storageKey = generateStorageKey(req.file.originalname);
    await uploadFile(req.file.buffer, storageKey, req.file.mimetype);

    // Generate and upload thumbnail if it's an image
    let thumbnailKey: string | null = null;
    const thumbnail = await generateThumbnail(req.file.buffer, storageKey, req.file.mimetype);
    if (thumbnail) {
      thumbnailKey = thumbnail.storageKey;
      await uploadFile(thumbnail.buffer, thumbnailKey, 'image/jpeg');
    }

    // Insert attachment record into database
    const result = await pool.query(
      `INSERT INTO attachments (task_id, uploader_id, original_filename, mime_type, size_bytes, storage_key, thumbnail_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, task_id, uploader_id, original_filename, mime_type, size_bytes, storage_key, thumbnail_key, created_at`,
      [taskId, userId, req.file.originalname, req.file.mimetype, req.file.size, storageKey, thumbnailKey]
    );

    // Fetch uploader information
    const uploaderResult = await pool.query(
      `SELECT id, name, email FROM users WHERE id = $1`,
      [userId]
    );

    const attachment = {
      ...result.rows[0],
      uploader: uploaderResult.rows[0],
    };

    res.status(201).json({ attachment });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
});

/**
 * GET /attachments/:id
 * Get an attachment's metadata and download URL
 */
router.get('/attachments/:id', authenticate, async (req: AuthRequest, res) => {
  const attachmentId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const userId = req.userId!;

  try {
    // Fetch attachment and verify user has access to the task via board membership
    const result = await pool.query(
      `SELECT a.id, a.task_id, a.uploader_id, a.original_filename, a.mime_type, a.size_bytes, a.storage_key, a.thumbnail_key, a.created_at,
              u.id as uploader_user_id, u.name as uploader_name, u.email as uploader_email
       FROM attachments a
       INNER JOIN tasks t ON t.id = a.task_id
       INNER JOIN boards b ON b.id = t.board_id
       INNER JOIN account_members am ON am.account_id = b.account_id
       INNER JOIN users u ON u.id = a.uploader_id
       WHERE a.id = $1 AND am.user_id = $2`,
      [attachmentId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const row = result.rows[0];

    // Generate presigned download URL
    const downloadUrl = await getDownloadUrl(row.storage_key);
    const thumbnailUrl = row.thumbnail_key ? await getDownloadUrl(row.thumbnail_key) : null;

    const attachment = {
      id: row.id,
      task_id: row.task_id,
      uploader_id: row.uploader_id,
      original_filename: row.original_filename,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
      storage_key: row.storage_key,
      thumbnail_key: row.thumbnail_key,
      created_at: row.created_at,
      download_url: downloadUrl,
      thumbnail_url: thumbnailUrl,
      uploader: {
        id: row.uploader_user_id,
        name: row.uploader_name,
        email: row.uploader_email,
      },
    };

    res.json({ attachment });
  } catch (error) {
    console.error('Error fetching attachment:', error);
    res.status(500).json({ error: 'Failed to fetch attachment' });
  }
});

/**
 * GET /attachments/:id/view
 * Redirect to a fresh presigned URL for viewing an attachment
 * This endpoint is used for embedding images in markdown content
 */
router.get('/attachments/:id/view', authenticate, async (req: AuthRequest, res) => {
  const attachmentId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const userId = req.userId!;

  try {
    // Fetch attachment and verify user has access
    const result = await pool.query(
      `SELECT a.storage_key
       FROM attachments a
       INNER JOIN tasks t ON t.id = a.task_id
       INNER JOIN boards b ON b.id = t.board_id
       INNER JOIN account_members am ON am.account_id = b.account_id
       WHERE a.id = $1 AND am.user_id = $2`,
      [attachmentId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const downloadUrl = await getDownloadUrl(result.rows[0].storage_key);
    return res.redirect(downloadUrl);
  } catch (error) {
    console.error('Error fetching attachment for view:', error);
    return res.status(500).json({ error: 'Failed to fetch attachment' });
  }
});

/**
 * POST /attachments/temp
 * Upload a temporary image (for use before task is created)
 * These images are stored directly and the URL can be embedded in markdown
 */
router.post('/attachments/temp', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
  const userId = req.userId!;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Only allow images for temp uploads
  if (!req.file.mimetype.startsWith('image/')) {
    return res.status(400).json({ error: 'Only image files are allowed for inline uploads' });
  }

  try {
    // Verify user belongs to an account
    const accountCheck = await pool.query(
      `SELECT account_id FROM account_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (accountCheck.rows.length === 0) {
      return res.status(403).json({ error: 'User is not part of any account' });
    }

    const accountId = accountCheck.rows[0].account_id;

    // Generate storage key with account prefix for organization
    const storageKey = `accounts/${accountId}/images/${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    await uploadFile(req.file.buffer, storageKey, req.file.mimetype);

    // Generate download URL (permanent for embedded images)
    const downloadUrl = await getDownloadUrl(storageKey);

    res.status(201).json({
      url: downloadUrl,
      storage_key: storageKey,
      filename: req.file.originalname,
      mime_type: req.file.mimetype,
      size_bytes: req.file.size,
    });
  } catch (error) {
    console.error('Error uploading temp image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

/**
 * DELETE /attachments/:id
 * Delete an attachment
 */
router.delete('/attachments/:id', authenticate, async (req: AuthRequest, res) => {
  const attachmentId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const userId = req.userId!;

  try {
    // Fetch attachment and verify user has access to the task via board membership
    const result = await pool.query(
      `SELECT a.id, a.storage_key, a.thumbnail_key
       FROM attachments a
       INNER JOIN tasks t ON t.id = a.task_id
       INNER JOIN boards b ON b.id = t.board_id
       INNER JOIN account_members am ON am.account_id = b.account_id
       WHERE a.id = $1 AND am.user_id = $2`,
      [attachmentId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = result.rows[0];

    // Delete file from storage
    await deleteFile(attachment.storage_key);

    // Delete thumbnail from storage if it exists
    if (attachment.thumbnail_key) {
      await deleteFile(attachment.thumbnail_key);
    }

    // Delete attachment record from database
    await pool.query('DELETE FROM attachments WHERE id = $1', [attachmentId]);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

export default router;
