-- Migration: Update column values from old structure to new structure
-- Old columns: goals, inbox, today, wait, finished, someday
-- New columns: backlog, ready, in_progress, review, blocked, ready_to_ship, done, archive

-- Map old column values to new ones
UPDATE tasks SET "column" = 'backlog' WHERE "column" IN ('goals', 'inbox', 'someday');
UPDATE tasks SET "column" = 'in_progress' WHERE "column" = 'today';
UPDATE tasks SET "column" = 'blocked' WHERE "column" = 'wait';
UPDATE tasks SET "column" = 'done' WHERE "column" = 'finished';
