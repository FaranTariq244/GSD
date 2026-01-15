import { Router, Response } from 'express';
import crypto from 'crypto';
import pool from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// POST /account/invite - Invite a member to the account
router.post('/invite', authenticate, async (req: AuthRequest, res: Response) => {
  const { email } = req.body;
  const userId = req.userId!;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Get the user's account and verify they are a member
    const accountResult = await pool.query(
      `SELECT a.id, a.name, am.role
       FROM accounts a
       INNER JOIN account_members am ON a.id = am.account_id
       WHERE am.user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of any account' });
    }

    const account = accountResult.rows[0];
    const accountId = account.id;

    // Check if user with this email already exists and is already a member
    const existingUserResult = await pool.query(
      `SELECT u.id
       FROM users u
       INNER JOIN account_members am ON u.id = am.user_id
       WHERE u.email = $1 AND am.account_id = $2`,
      [normalizedEmail, accountId]
    );

    if (existingUserResult.rows.length > 0) {
      return res.status(400).json({ error: 'User is already a member of this account' });
    }

    // Check for existing unused invite
    const existingInviteResult = await pool.query(
      `SELECT id FROM invites
       WHERE email = $1 AND account_id = $2 AND used_at IS NULL AND expires_at > NOW()`,
      [normalizedEmail, accountId]
    );

    if (existingInviteResult.rows.length > 0) {
      return res.status(400).json({ error: 'An active invite already exists for this email' });
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex');

    // Create invite with 7 day expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const inviteResult = await pool.query(
      `INSERT INTO invites (account_id, email, token, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, token, created_at, expires_at`,
      [accountId, normalizedEmail, token, userId, expiresAt]
    );

    const invite = inviteResult.rows[0];

    return res.status(201).json({
      invite: {
        id: invite.id,
        email: invite.email,
        token: invite.token,
        created_at: invite.created_at,
        expires_at: invite.expires_at
      }
    });
  } catch (error) {
    console.error('Error creating invite:', error);
    return res.status(500).json({ error: 'Failed to create invite' });
  }
});

export default router;
