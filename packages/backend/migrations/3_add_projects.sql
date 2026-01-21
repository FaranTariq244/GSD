-- Migration: Add projects support
-- Each account can have multiple projects, each with its own kanban board

-- Create projects table
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add project_id to boards table
ALTER TABLE boards ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE;

-- Remove the UNIQUE constraint on account_id (allows multiple boards per account)
ALTER TABLE boards DROP CONSTRAINT boards_account_id_key;

-- Create indexes for faster lookups
CREATE INDEX idx_projects_account_id ON projects(account_id);
CREATE INDEX idx_boards_project_id ON boards(project_id);
