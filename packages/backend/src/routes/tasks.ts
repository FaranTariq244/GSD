import { Router, Response } from 'express';
import pool from '../db.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Valid column values
const VALID_COLUMNS = ['goals', 'inbox', 'today', 'wait', 'finished', 'someday'];

// Valid priority values
const VALID_PRIORITIES = ['hot', 'warm', 'normal', 'cold'];

// GET /tasks - Get tasks with optional filters
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { column, assignee, tag, search } = req.query;

  try {
    // First, get the user's board
    const boardResult = await pool.query(
      `SELECT b.id
       FROM boards b
       INNER JOIN account_members am ON b.account_id = am.account_id
       WHERE am.user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (boardResult.rows.length === 0) {
      return res.status(404).json({ error: 'No board found for your account' });
    }

    const boardId = boardResult.rows[0].id;

    // Build the query dynamically based on filters
    let query = `
      SELECT DISTINCT t.id, t.board_id, t.title, t.description, t.column, t.position,
             t.priority, t.due_date, t.created_by, t.created_at, t.updated_at
      FROM tasks t
      WHERE t.board_id = $1
    `;
    const params: any[] = [boardId];
    let paramIndex = 2;

    // Filter by column
    if (column && typeof column === 'string') {
      query += ` AND t.column = $${paramIndex}`;
      params.push(column);
      paramIndex++;
    }

    // Filter by assignee
    if (assignee && typeof assignee === 'string') {
      query += ` AND EXISTS (
        SELECT 1 FROM task_assignees ta
        WHERE ta.task_id = t.id AND ta.user_id = $${paramIndex}
      )`;
      params.push(parseInt(assignee));
      paramIndex++;
    }

    // Filter by tag
    if (tag && typeof tag === 'string') {
      query += ` AND EXISTS (
        SELECT 1 FROM task_tags tt
        WHERE tt.task_id = t.id AND tt.tag = $${paramIndex}
      )`;
      params.push(tag);
      paramIndex++;
    }

    // Search by title
    if (search && typeof search === 'string') {
      query += ` AND t.title ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Order by column position
    query += ' ORDER BY t.column, t.position';

    const tasksResult = await pool.query(query, params);

    // For each task, get assignees and tags
    const tasks = await Promise.all(
      tasksResult.rows.map(async (task) => {
        // Get assignees
        const assigneesResult = await pool.query(
          `SELECT u.id, u.name, u.email
           FROM users u
           INNER JOIN task_assignees ta ON u.id = ta.user_id
           WHERE ta.task_id = $1`,
          [task.id]
        );

        // Get tags
        const tagsResult = await pool.query(
          `SELECT tag FROM task_tags WHERE task_id = $1`,
          [task.id]
        );

        return {
          id: task.id,
          board_id: task.board_id,
          title: task.title,
          description: task.description,
          column: task.column,
          position: task.position,
          priority: task.priority,
          due_date: task.due_date,
          assignees: assigneesResult.rows,
          tags: tagsResult.rows.map((row) => row.tag),
          created_by: task.created_by,
          created_at: task.created_at,
          updated_at: task.updated_at
        };
      })
    );

    return res.status(200).json({ tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /tasks - Create a new task
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const {
    title,
    description = null,
    column = 'inbox',
    priority = 'normal',
    due_date = null,
    assignee_ids = [],
    tags = []
  } = req.body;

  // Validate required fields
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: 'Title is required' });
  }

  // Validate column
  if (!VALID_COLUMNS.includes(column)) {
    return res.status(400).json({
      error: `Invalid column. Must be one of: ${VALID_COLUMNS.join(', ')}`
    });
  }

  // Validate priority
  if (!VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({
      error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`
    });
  }

  // Validate assignee_ids is an array
  if (!Array.isArray(assignee_ids)) {
    return res.status(400).json({ error: 'assignee_ids must be an array' });
  }

  // Validate tags is an array
  if (!Array.isArray(tags)) {
    return res.status(400).json({ error: 'tags must be an array' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get the user's board
    const boardResult = await client.query(
      `SELECT b.id
       FROM boards b
       INNER JOIN account_members am ON b.account_id = am.account_id
       WHERE am.user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (boardResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No board found for your account' });
    }

    const boardId = boardResult.rows[0].id;

    // Get the max position in the column to add at the end
    const positionResult = await client.query(
      `SELECT COALESCE(MAX(position), 0) + 1 as next_position
       FROM tasks
       WHERE board_id = $1 AND column = $2`,
      [boardId, column]
    );

    const position = positionResult.rows[0].next_position;

    // Create the task
    const taskResult = await client.query(
      `INSERT INTO tasks (board_id, title, description, column, position, priority, due_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, board_id, title, description, column, position, priority, due_date, created_by, created_at, updated_at`,
      [boardId, title.trim(), description, column, position, priority, due_date, userId]
    );

    const task = taskResult.rows[0];

    // Add assignees if provided
    if (assignee_ids.length > 0) {
      for (const assigneeId of assignee_ids) {
        await client.query(
          `INSERT INTO task_assignees (task_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [task.id, assigneeId]
        );
      }
    }

    // Add tags if provided
    if (tags.length > 0) {
      for (const tag of tags) {
        if (typeof tag === 'string' && tag.trim().length > 0) {
          await client.query(
            `INSERT INTO task_tags (task_id, tag)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [task.id, tag.trim()]
          );
        }
      }
    }

    await client.query('COMMIT');

    // Fetch the complete task with assignees and tags
    const assigneesResult = await pool.query(
      `SELECT u.id, u.name, u.email
       FROM users u
       INNER JOIN task_assignees ta ON u.id = ta.user_id
       WHERE ta.task_id = $1`,
      [task.id]
    );

    const tagsResult = await pool.query(
      `SELECT tag FROM task_tags WHERE task_id = $1`,
      [task.id]
    );

    const completeTask = {
      id: task.id,
      board_id: task.board_id,
      title: task.title,
      description: task.description,
      column: task.column,
      position: task.position,
      priority: task.priority,
      due_date: task.due_date,
      assignees: assigneesResult.rows,
      tags: tagsResult.rows.map((row) => row.tag),
      created_by: task.created_by,
      created_at: task.created_at,
      updated_at: task.updated_at
    };

    return res.status(201).json({ task: completeTask });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating task:', error);
    return res.status(500).json({ error: 'Failed to create task' });
  } finally {
    client.release();
  }
});

// PATCH /tasks/:id - Update a task
router.patch('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const taskId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const {
    title,
    description,
    priority,
    due_date,
    assignee_ids,
    tags
  } = req.body;

  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify the task exists and user has access to it (via board membership)
    const taskResult = await client.query(
      `SELECT t.id, t.board_id
       FROM tasks t
       INNER JOIN boards b ON t.board_id = b.id
       INNER JOIN account_members am ON b.account_id = am.account_id
       WHERE t.id = $1 AND am.user_id = $2`,
      [taskId, userId]
    );

    if (taskResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Task not found' });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Title cannot be empty' });
      }
      updates.push(`title = $${paramIndex}`);
      params.push(title.trim());
      paramIndex++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(description);
      paramIndex++;
    }

    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`
        });
      }
      updates.push(`priority = $${paramIndex}`);
      params.push(priority);
      paramIndex++;
    }

    if (due_date !== undefined) {
      updates.push(`due_date = $${paramIndex}`);
      params.push(due_date);
      paramIndex++;
    }

    // Always update updated_at
    updates.push(`updated_at = NOW()`);

    // Update the task if there are changes
    if (updates.length > 1) { // > 1 because updated_at is always there
      params.push(taskId);
      const updateQuery = `
        UPDATE tasks
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, board_id, title, description, column, position, priority, due_date, created_by, created_at, updated_at
      `;
      await client.query(updateQuery, params);
    }

    // Update assignees if provided
    if (assignee_ids !== undefined) {
      if (!Array.isArray(assignee_ids)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'assignee_ids must be an array' });
      }

      // Remove all existing assignees
      await client.query(`DELETE FROM task_assignees WHERE task_id = $1`, [taskId]);

      // Add new assignees
      for (const assigneeId of assignee_ids) {
        await client.query(
          `INSERT INTO task_assignees (task_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [taskId, assigneeId]
        );
      }
    }

    // Update tags if provided
    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'tags must be an array' });
      }

      // Remove all existing tags
      await client.query(`DELETE FROM task_tags WHERE task_id = $1`, [taskId]);

      // Add new tags
      for (const tag of tags) {
        if (typeof tag === 'string' && tag.trim().length > 0) {
          await client.query(
            `INSERT INTO task_tags (task_id, tag)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [taskId, tag.trim()]
          );
        }
      }
    }

    await client.query('COMMIT');

    // Fetch the updated task with assignees and tags
    const updatedTaskResult = await pool.query(
      `SELECT id, board_id, title, description, column, position, priority, due_date, created_by, created_at, updated_at
       FROM tasks
       WHERE id = $1`,
      [taskId]
    );

    const task = updatedTaskResult.rows[0];

    const assigneesResult = await pool.query(
      `SELECT u.id, u.name, u.email
       FROM users u
       INNER JOIN task_assignees ta ON u.id = ta.user_id
       WHERE ta.task_id = $1`,
      [taskId]
    );

    const tagsResult = await pool.query(
      `SELECT tag FROM task_tags WHERE task_id = $1`,
      [taskId]
    );

    const completeTask = {
      id: task.id,
      board_id: task.board_id,
      title: task.title,
      description: task.description,
      column: task.column,
      position: task.position,
      priority: task.priority,
      due_date: task.due_date,
      assignees: assigneesResult.rows,
      tags: tagsResult.rows.map((row) => row.tag),
      created_by: task.created_by,
      created_at: task.created_at,
      updated_at: task.updated_at
    };

    return res.status(200).json({ task: completeTask });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating task:', error);
    return res.status(500).json({ error: 'Failed to update task' });
  } finally {
    client.release();
  }
});

// DELETE /tasks/:id - Delete a task
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
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

    // Delete the task (cascade will handle assignees, tags, comments, attachments)
    await pool.query(`DELETE FROM tasks WHERE id = $1`, [taskId]);

    return res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    return res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
