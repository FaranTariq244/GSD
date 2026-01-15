import express from 'express';
import multer from 'multer';
import pool from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { uploadFile, generateStorageKey, getDownloadUrl, deleteFile } from '../storage.js';

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

    // Insert attachment record into database
    const result = await pool.query(
      `INSERT INTO attachments (task_id, uploader_id, original_filename, mime_type, size_bytes, storage_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, task_id, uploader_id, original_filename, mime_type, size_bytes, storage_key, thumbnail_key, created_at`,
      [taskId, userId, req.file.originalname, req.file.mimetype, req.file.size, storageKey]
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
 * DELETE /attachments/:id
 * Delete an attachment
 */
router.delete('/attachments/:id', authenticate, async (req: AuthRequest, res) => {
  const attachmentId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const userId = req.userId!;

  try {
    // Fetch attachment and verify user has access to the task via board membership
    const result = await pool.query(
      `SELECT a.id, a.storage_key
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

    // Delete attachment record from database
    await pool.query('DELETE FROM attachments WHERE id = $1', [attachmentId]);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

export default router;
