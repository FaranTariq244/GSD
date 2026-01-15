import { Router, Response } from 'express';
import pool from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

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

    const comments = commentsResult.rows.map((row) => ({
      id: row.id,
      task_id: row.task_id,
      body: row.body,
      author: {
        id: row.author_id,
        name: row.author_name,
        email: row.author_email
      },
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
      created_at: insertResult.rows[0].created_at
    };

    return res.status(201).json({ comment });
  } catch (error) {
    console.error('Error creating comment:', error);
    return res.status(500).json({ error: 'Failed to create comment' });
  }
});

export default router;
