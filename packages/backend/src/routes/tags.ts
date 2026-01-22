import { Router, Response } from 'express';
import pool from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Helper to validate hex color format
const isValidHexColor = (color: string): boolean => {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
};

// GET /tags - Get all tags for user's account
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  try {
    const result = await pool.query(
      `SELECT t.id, t.name, t.color, t.created_at,
              (SELECT COUNT(*) FROM task_tags tt WHERE tt.tag_id = t.id) as usage_count
       FROM tags t
       INNER JOIN account_members am ON am.account_id = t.account_id
       WHERE am.user_id = $1
       ORDER BY t.name`,
      [userId]
    );

    return res.status(200).json({
      tags: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        color: row.color,
        created_at: row.created_at,
        usage_count: parseInt(row.usage_count, 10)
      }))
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    return res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// GET /tags/search - Search tags by name (for autocomplete)
router.get('/search', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const result = await pool.query(
      `SELECT t.id, t.name, t.color
       FROM tags t
       INNER JOIN account_members am ON am.account_id = t.account_id
       WHERE am.user_id = $1 AND t.name ILIKE $2
       ORDER BY t.name
       LIMIT 10`,
      [userId, `%${q}%`]
    );

    return res.status(200).json({
      tags: result.rows
    });
  } catch (error) {
    console.error('Error searching tags:', error);
    return res.status(500).json({ error: 'Failed to search tags' });
  }
});

// POST /tags - Create a new tag
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { name, color } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Tag name is required' });
  }

  const trimmedName = name.trim();
  if (trimmedName.length > 100) {
    return res.status(400).json({ error: 'Tag name must be 100 characters or less' });
  }

  const tagColor = color || '#3b82f6';
  if (!isValidHexColor(tagColor)) {
    return res.status(400).json({ error: 'Invalid color format. Use hex format like #3b82f6' });
  }

  try {
    // Get user's account
    const accountResult = await pool.query(
      `SELECT account_id FROM account_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of any account' });
    }

    const accountId = accountResult.rows[0].account_id;

    // Check if tag with same name already exists
    const existingTag = await pool.query(
      `SELECT id FROM tags WHERE account_id = $1 AND LOWER(name) = LOWER($2)`,
      [accountId, trimmedName]
    );

    if (existingTag.rows.length > 0) {
      return res.status(400).json({ error: 'A tag with this name already exists' });
    }

    // Create the tag
    const result = await pool.query(
      `INSERT INTO tags (account_id, name, color)
       VALUES ($1, $2, $3)
       RETURNING id, name, color, created_at`,
      [accountId, trimmedName, tagColor]
    );

    return res.status(201).json({
      tag: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating tag:', error);
    return res.status(500).json({ error: 'Failed to create tag' });
  }
});

// PATCH /tags/:id - Update a tag (name and/or color)
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const tagId = parseInt(req.params.id, 10);
  const { name, color } = req.body;

  if (isNaN(tagId)) {
    return res.status(400).json({ error: 'Invalid tag ID' });
  }

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return res.status(400).json({ error: 'Tag name cannot be empty' });
  }

  if (name && name.trim().length > 100) {
    return res.status(400).json({ error: 'Tag name must be 100 characters or less' });
  }

  if (color !== undefined && !isValidHexColor(color)) {
    return res.status(400).json({ error: 'Invalid color format. Use hex format like #3b82f6' });
  }

  try {
    // Verify tag belongs to user's account
    const tagResult = await pool.query(
      `SELECT t.id, t.account_id, t.name, t.color
       FROM tags t
       INNER JOIN account_members am ON am.account_id = t.account_id
       WHERE t.id = $1 AND am.user_id = $2`,
      [tagId, userId]
    );

    if (tagResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    const tag = tagResult.rows[0];

    // Check for duplicate name if name is being changed
    if (name && name.trim().toLowerCase() !== tag.name.toLowerCase()) {
      const duplicateCheck = await pool.query(
        `SELECT id FROM tags WHERE account_id = $1 AND LOWER(name) = LOWER($2) AND id != $3`,
        [tag.account_id, name.trim(), tagId]
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({ error: 'A tag with this name already exists' });
      }
    }

    // Update the tag
    const updates: string[] = [];
    const values: (string | number)[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name.trim());
      paramIndex++;
    }

    if (color !== undefined) {
      updates.push(`color = $${paramIndex}`);
      values.push(color);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(tagId);

    const result = await pool.query(
      `UPDATE tags SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, color, created_at`,
      values
    );

    return res.status(200).json({
      tag: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating tag:', error);
    return res.status(500).json({ error: 'Failed to update tag' });
  }
});

// DELETE /tags/:id - Delete a tag
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const tagId = parseInt(req.params.id, 10);

  if (isNaN(tagId)) {
    return res.status(400).json({ error: 'Invalid tag ID' });
  }

  try {
    // Verify tag belongs to user's account
    const tagResult = await pool.query(
      `SELECT t.id
       FROM tags t
       INNER JOIN account_members am ON am.account_id = t.account_id
       WHERE t.id = $1 AND am.user_id = $2`,
      [tagId, userId]
    );

    if (tagResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    // Delete the tag (task_tags entries will be deleted by CASCADE)
    await pool.query(`DELETE FROM tags WHERE id = $1`, [tagId]);

    return res.status(200).json({ message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return res.status(500).json({ error: 'Failed to delete tag' });
  }
});

export default router;
