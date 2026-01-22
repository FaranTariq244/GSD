import { Router, Response } from 'express';
import multer from 'multer';
import pool from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { uploadFile, generateStorageKey, getDownloadUrl, deleteFile, generateThumbnail } from '../storage.js';

const router = Router();

// Configure multer for memory storage (we'll upload to S3, not disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// GET /tasks/:id/comments - Get all comments for a task
router.get('/tasks/:id/comments', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const taskId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  try {
    // Verify the task exists and user has access to it (via board membership)
    const taskResult = await pool.query(
      `SELECT t.id
       FROM tasks t
       INNER JOIN boards b ON t.board_id = b.id
       INNER JOIN account_members am ON b.account_id = am.account_id
       WHERE t.id = $1 AND am.user_id = $2`,
      [taskId, userId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Fetch all comments for the task with author information
    const commentsResult = await pool.query(
      `SELECT c.id, c.task_id, c.body, c.created_at,
              u.id as author_id, u.name as author_name, u.email as author_email
       FROM comments c
       INNER JOIN users u ON c.author_id = u.id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
      [taskId]
    );

    // Fetch attachments for all comments
    const commentIds = commentsResult.rows.map(row => row.id);
    let attachmentsByCommentId: Record<number, any[]> = {};

    if (commentIds.length > 0) {
      const attachmentsResult = await pool.query(
        `SELECT a.id, a.comment_id, a.original_filename, a.mime_type, a.size_bytes, a.storage_key, a.thumbnail_key, a.created_at,
                u.id as uploader_id, u.name as uploader_name, u.email as uploader_email
         FROM attachments a
         INNER JOIN users u ON u.id = a.uploader_id
         WHERE a.comment_id = ANY($1)
         ORDER BY a.created_at ASC`,
        [commentIds]
      );

      // Group attachments by comment_id and generate presigned URLs
      for (const row of attachmentsResult.rows) {
        if (!attachmentsByCommentId[row.comment_id]) {
          attachmentsByCommentId[row.comment_id] = [];
        }
        const downloadUrl = await getDownloadUrl(row.storage_key);
        const thumbnailUrl = row.thumbnail_key ? await getDownloadUrl(row.thumbnail_key) : null;
        attachmentsByCommentId[row.comment_id].push({
          id: row.id,
          original_filename: row.original_filename,
          mime_type: row.mime_type,
          size_bytes: row.size_bytes,
          download_url: downloadUrl,
          thumbnail_url: thumbnailUrl,
          uploader: {
            id: row.uploader_id,
            name: row.uploader_name,
            email: row.uploader_email,
          },
          created_at: row.created_at,
        });
      }
    }

    const comments = commentsResult.rows.map((row) => ({
      id: row.id,
      task_id: row.task_id,
      body: row.body,
      author: {
        id: row.author_id,
        name: row.author_name,
        email: row.author_email
      },
      attachments: attachmentsByCommentId[row.id] || [],
      created_at: row.created_at
    }));

    return res.status(200).json({ comments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /tasks/:id/comments - Create a new comment on a task
router.post('/tasks/:id/comments', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const taskId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const { body } = req.body;

  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    return res.status(400).json({ error: 'Comment body is required' });
  }

  try {
    // Verify the task exists and user has access to it (via board membership)
    const taskResult = await pool.query(
      `SELECT t.id
       FROM tasks t
       INNER JOIN boards b ON t.board_id = b.id
       INNER JOIN account_members am ON b.account_id = am.account_id
       WHERE t.id = $1 AND am.user_id = $2`,
      [taskId, userId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Insert the comment
    const insertResult = await pool.query(
      `INSERT INTO comments (task_id, author_id, body, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, task_id, body, created_at`,
      [taskId, userId, body.trim()]
    );

    // Fetch author information
    const userResult = await pool.query(
      `SELECT id, name, email FROM users WHERE id = $1`,
      [userId]
    );

    const comment = {
      id: insertResult.rows[0].id,
      task_id: insertResult.rows[0].task_id,
      body: insertResult.rows[0].body,
      author: {
        id: userResult.rows[0].id,
        name: userResult.rows[0].name,
        email: userResult.rows[0].email
      },
      attachments: [],
      created_at: insertResult.rows[0].created_at
    };

    return res.status(201).json({ comment });
  } catch (error) {
    console.error('Error creating comment:', error);
    return res.status(500).json({ error: 'Failed to create comment' });
  }
});

// POST /comments/:id/attachments - Upload a file attachment to a comment
router.post('/comments/:id/attachments', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const commentId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

  if (isNaN(commentId)) {
    return res.status(400).json({ error: 'Invalid comment ID' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Verify the comment exists and user has access to it (via board membership)
    const commentResult = await pool.query(
      `SELECT c.id, c.task_id
       FROM comments c
       INNER JOIN tasks t ON c.task_id = t.id
       INNER JOIN boards b ON t.board_id = b.id
       INNER JOIN account_members am ON b.account_id = am.account_id
       WHERE c.id = $1 AND am.user_id = $2`,
      [commentId, userId]
    );

    if (commentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const taskId = commentResult.rows[0].task_id;

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

    // Insert attachment record into database with comment_id
    const insertResult = await pool.query(
      `INSERT INTO attachments (task_id, comment_id, uploader_id, original_filename, mime_type, size_bytes, storage_key, thumbnail_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, task_id, comment_id, original_filename, mime_type, size_bytes, storage_key, thumbnail_key, created_at`,
      [taskId, commentId, userId, req.file.originalname, req.file.mimetype, req.file.size, storageKey, thumbnailKey]
    );

    // Fetch uploader information
    const uploaderResult = await pool.query(
      `SELECT id, name, email FROM users WHERE id = $1`,
      [userId]
    );

    // Generate presigned URLs
    const downloadUrl = await getDownloadUrl(storageKey);
    const thumbnailUrl = thumbnailKey ? await getDownloadUrl(thumbnailKey) : null;

    const attachment = {
      id: insertResult.rows[0].id,
      original_filename: insertResult.rows[0].original_filename,
      mime_type: insertResult.rows[0].mime_type,
      size_bytes: insertResult.rows[0].size_bytes,
      download_url: downloadUrl,
      thumbnail_url: thumbnailUrl,
      uploader: uploaderResult.rows[0],
      created_at: insertResult.rows[0].created_at,
    };

    return res.status(201).json({ attachment });
  } catch (error) {
    console.error('Error uploading comment attachment:', error);
    return res.status(500).json({ error: 'Failed to upload attachment' });
  }
});

// DELETE /comments/:commentId/attachments/:attachmentId - Delete a comment attachment
router.delete('/comments/:commentId/attachments/:attachmentId', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const commentId = parseInt(Array.isArray(req.params.commentId) ? req.params.commentId[0] : req.params.commentId);
  const attachmentId = parseInt(Array.isArray(req.params.attachmentId) ? req.params.attachmentId[0] : req.params.attachmentId);

  if (isNaN(commentId) || isNaN(attachmentId)) {
    return res.status(400).json({ error: 'Invalid comment or attachment ID' });
  }

  try {
    // Verify the attachment exists and user has access to it
    const attachmentResult = await pool.query(
      `SELECT a.id, a.storage_key, a.thumbnail_key
       FROM attachments a
       INNER JOIN comments c ON a.comment_id = c.id
       INNER JOIN tasks t ON c.task_id = t.id
       INNER JOIN boards b ON t.board_id = b.id
       INNER JOIN account_members am ON b.account_id = am.account_id
       WHERE a.id = $1 AND a.comment_id = $2 AND am.user_id = $3`,
      [attachmentId, commentId, userId]
    );

    if (attachmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = attachmentResult.rows[0];

    // Delete file from storage
    await deleteFile(attachment.storage_key);

    // Delete thumbnail from storage if it exists
    if (attachment.thumbnail_key) {
      await deleteFile(attachment.thumbnail_key);
    }

    // Delete attachment record from database
    await pool.query('DELETE FROM attachments WHERE id = $1', [attachmentId]);

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting comment attachment:', error);
    return res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

export default router;
