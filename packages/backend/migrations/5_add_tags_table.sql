-- Migration: Add tags table with color support
-- Transform task_tags from string-based to ID-based with foreign key to tags table

-- Create tags table with color support
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, name)
);

CREATE INDEX idx_tags_account_id ON tags(account_id);
CREATE INDEX idx_tags_name ON tags(name);

-- Migrate existing tags from task_tags to new tags table
INSERT INTO tags (account_id, name)
SELECT DISTINCT b.account_id, tt.tag
FROM task_tags tt
INNER JOIN tasks t ON t.id = tt.task_id
INNER JOIN boards b ON b.id = t.board_id
WHERE tt.tag IS NOT NULL AND tt.tag != '';

-- Create new task_tags table with foreign key to tags
CREATE TABLE task_tags_new (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

-- Migrate data from old task_tags to new structure
INSERT INTO task_tags_new (task_id, tag_id)
SELECT tt.task_id, tg.id
FROM task_tags tt
INNER JOIN tasks t ON t.id = tt.task_id
INNER JOIN boards b ON b.id = t.board_id
INNER JOIN tags tg ON tg.name = tt.tag AND tg.account_id = b.account_id;

-- Drop old table and rename new
DROP TABLE task_tags;
ALTER TABLE task_tags_new RENAME TO task_tags;

CREATE INDEX idx_task_tags_tag_id ON task_tags(tag_id);
