-- Add comment_id column to attachments table to support comment attachments
-- Attachments with only task_id are task attachments
-- Attachments with both task_id and comment_id are comment attachments

ALTER TABLE attachments ADD COLUMN comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE;

-- Create index for faster queries on comment attachments
CREATE INDEX idx_attachments_comment_id ON attachments(comment_id);
