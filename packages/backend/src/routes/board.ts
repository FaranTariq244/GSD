import { Router, Response } from 'express';
import pool from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /board - Get the single board for the user's account
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  try {
    // Get the user's account and board
    const result = await pool.query(
      `SELECT b.id, b.name, b.created_at, b.account_id
       FROM boards b
       INNER JOIN account_members am ON b.account_id = am.account_id
       WHERE am.user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No board found for your account' });
    }

    const board = result.rows[0];

    return res.status(200).json({
      board: {
        id: board.id,
        account_id: board.account_id,
        name: board.name,
        created_at: board.created_at
      }
    });
  } catch (error) {
    console.error('Error fetching board:', error);
    return res.status(500).json({ error: 'Failed to fetch board' });
  }
});

export default router;
