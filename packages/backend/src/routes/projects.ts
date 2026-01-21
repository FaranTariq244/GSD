import { Router, Response } from 'express';
import pool from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /projects - List all projects for user's account
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;

  try {
    // Get user's account_id first
    const accountResult = await pool.query(
      `SELECT account_id FROM account_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'No account found for user' });
    }

    const accountId = accountResult.rows[0].account_id;

    // Get all projects for this account
    const projectsResult = await pool.query(
      `SELECT p.id, p.name, p.description, p.created_by, p.created_at, p.updated_at,
              u.name as creator_name
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.account_id = $1
       ORDER BY p.created_at ASC`,
      [accountId]
    );

    return res.status(200).json({ projects: projectsResult.rows });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST /projects - Create a new project
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { name, description = null } = req.body;

  // Validate required fields
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get user's account_id
    const accountResult = await client.query(
      `SELECT account_id FROM account_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (accountResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No account found for user' });
    }

    const accountId = accountResult.rows[0].account_id;

    // Create the project
    const projectResult = await client.query(
      `INSERT INTO projects (account_id, name, description, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, account_id, name, description, created_by, created_at, updated_at`,
      [accountId, name.trim(), description, userId]
    );

    const project = projectResult.rows[0];

    // Create a board for this project
    await client.query(
      `INSERT INTO boards (account_id, project_id, name, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [accountId, project.id, `${name.trim()} Board`]
    );

    await client.query('COMMIT');

    return res.status(201).json({ project });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating project:', error);
    return res.status(500).json({ error: 'Failed to create project' });
  } finally {
    client.release();
  }
});

// GET /projects/:id - Get a single project
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const projectId = parseInt(req.params.id);

  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    // Get the project and verify user has access
    const projectResult = await pool.query(
      `SELECT p.id, p.name, p.description, p.created_by, p.created_at, p.updated_at,
              u.name as creator_name
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.id
       INNER JOIN account_members am ON p.account_id = am.account_id
       WHERE p.id = $1 AND am.user_id = $2`,
      [projectId, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.status(200).json({ project: projectResult.rows[0] });
  } catch (error) {
    console.error('Error fetching project:', error);
    return res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// PATCH /projects/:id - Update a project
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const projectId = parseInt(req.params.id);
  const { name, description } = req.body;

  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    // Verify user has access to this project
    const accessResult = await pool.query(
      `SELECT p.id
       FROM projects p
       INNER JOIN account_members am ON p.account_id = am.account_id
       WHERE p.id = $1 AND am.user_id = $2`,
      [projectId, userId]
    );

    if (accessResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Project name cannot be empty' });
      }
      updates.push(`name = $${paramIndex}`);
      params.push(name.trim());
      paramIndex++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(description);
      paramIndex++;
    }

    // Always update updated_at
    updates.push(`updated_at = NOW()`);

    if (updates.length > 1) {
      params.push(projectId);
      const updateQuery = `
        UPDATE projects
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, account_id, name, description, created_by, created_at, updated_at
      `;
      const result = await pool.query(updateQuery, params);
      return res.status(200).json({ project: result.rows[0] });
    }

    // No changes - just return the existing project
    const projectResult = await pool.query(
      `SELECT id, account_id, name, description, created_by, created_at, updated_at
       FROM projects WHERE id = $1`,
      [projectId]
    );
    return res.status(200).json({ project: projectResult.rows[0] });
  } catch (error) {
    console.error('Error updating project:', error);
    return res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /projects/:id - Delete a project
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const projectId = parseInt(req.params.id);

  if (isNaN(projectId)) {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  try {
    // Verify user has access to this project
    const accessResult = await pool.query(
      `SELECT p.id, p.account_id
       FROM projects p
       INNER JOIN account_members am ON p.account_id = am.account_id
       WHERE p.id = $1 AND am.user_id = $2`,
      [projectId, userId]
    );

    if (accessResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const accountId = accessResult.rows[0].account_id;

    // Check if this is the last project in the account
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM projects WHERE account_id = $1`,
      [accountId]
    );

    if (parseInt(countResult.rows[0].count) <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last project. Create another project first.' });
    }

    // Delete the project (cascade will handle board and tasks)
    await pool.query(`DELETE FROM projects WHERE id = $1`, [projectId]);

    return res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    return res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
