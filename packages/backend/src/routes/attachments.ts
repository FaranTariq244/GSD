import express from 'express';
import multer from 'multer';
import pool from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { uploadFile, generateStorageKey } from '../storage.js';

const router = express.Router();

// Configure multer for memory storage (we'll upload to S3, not disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
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

export default router;
