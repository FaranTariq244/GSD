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

// GET /account/invite/:token - Get invite info by token (no auth required to view)
router.get('/invite/:token', async (req, res: Response) => {
  const token = req.params.token;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    const result = await pool.query(
      `SELECT i.id, i.email, i.expires_at, i.used_at,
              a.name as account_name,
              u.name as invited_by_name
       FROM invites i
       INNER JOIN accounts a ON a.id = i.account_id
       INNER JOIN users u ON u.id = i.invited_by
       WHERE i.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    const invite = result.rows[0];

    // Check if already used
    if (invite.used_at !== null) {
      return res.status(400).json({ error: 'This invite has already been used' });
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This invite has expired' });
    }

    return res.status(200).json({
      invite: {
        email: invite.email,
        account_name: invite.account_name,
        invited_by: invite.invited_by_name,
        expires_at: invite.expires_at
      }
    });
  } catch (error) {
    console.error('Error fetching invite:', error);
    return res.status(500).json({ error: 'Failed to fetch invite' });
  }
});

// GET /account/invites - List all pending invites for user's account
router.get('/invites', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  try {
    const result = await pool.query(
      `SELECT i.id, i.email, i.token, i.created_at, i.expires_at, i.used_at
       FROM invites i
       INNER JOIN account_members am ON am.account_id = i.account_id
       WHERE am.user_id = $1
       ORDER BY i.created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      invites: result.rows
    });
  } catch (error) {
    console.error('Error fetching invites:', error);
    return res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

// GET /account/members - Get all members of the user's account
router.get('/members', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  try {
    // Get all members of the user's account
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, am.role, am.created_at as joined_at
       FROM users u
       INNER JOIN account_members am ON u.id = am.user_id
       WHERE am.account_id = (
         SELECT account_id FROM account_members WHERE user_id = $1 LIMIT 1
       )
       ORDER BY u.name`,
      [userId]
    );

    return res.status(200).json({
      members: result.rows
    });
  } catch (error) {
    console.error('Error fetching account members:', error);
    return res.status(500).json({ error: 'Failed to fetch account members' });
  }
});

// POST /account/join - Join an account using an invite token
router.post('/join', authenticate, async (req: AuthRequest, res: Response) => {
  const { token } = req.body;
  const userId = req.userId!;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get the invite and validate it
    const inviteResult = await client.query(
      `SELECT id, account_id, email, expires_at, used_at
       FROM invites
       WHERE token = $1`,
      [token]
    );

    if (inviteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invalid invite token' });
    }

    const invite = inviteResult.rows[0];

    // Check if invite is already used
    if (invite.used_at !== null) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This invite has already been used' });
    }

    // Check if invite is expired
    if (new Date(invite.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This invite has expired' });
    }

    // Get the current user's email
    const userResult = await client.query(
      `SELECT email FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const userEmail = userResult.rows[0].email;

    // Verify that the user's email matches the invite email
    if (userEmail.toLowerCase() !== invite.email.toLowerCase()) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'This invite is for a different email address' });
    }

    // Check if user is already a member of this account
    const memberResult = await client.query(
      `SELECT user_id FROM account_members
       WHERE account_id = $1 AND user_id = $2`,
      [invite.account_id, userId]
    );

    if (memberResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You are already a member of this account' });
    }

    // Add user to account as member
    await client.query(
      `INSERT INTO account_members (account_id, user_id, role)
       VALUES ($1, $2, 'member')`,
      [invite.account_id, userId]
    );

    // Mark invite as used
    await client.query(
      `UPDATE invites
       SET used_at = NOW()
       WHERE id = $1`,
      [invite.id]
    );

    // Get account details to return
    const accountResult = await client.query(
      `SELECT id, name, owner_id, created_at
       FROM accounts
       WHERE id = $1`,
      [invite.account_id]
    );

    await client.query('COMMIT');

    const account = accountResult.rows[0];
    return res.status(200).json({
      account: {
        id: account.id,
        name: account.name,
        owner_id: account.owner_id,
        created_at: account.created_at
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error joining account:', error);
    return res.status(500).json({ error: 'Failed to join account' });
  } finally {
    client.release();
  }
});

export default router;
