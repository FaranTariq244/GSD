import { useEffect, useState } from 'react';
import './Board.css';
import { TaskCard } from './TaskCard';
import './TaskCard.css';
import { TaskDetailModal } from './TaskDetailModal';

type Column = 'goals' | 'inbox' | 'today' | 'wait' | 'finished' | 'someday';

interface Task {
  id: string;
  title: string;
  description: string | null;
  column: Column;
  position: number;
  priority: 'hot' | 'warm' | 'normal' | 'cold';
  due_date: string | null;
  assignees: Array<{ id: string; name: string; email: string }>;
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

const COLUMNS: Array<{ id: Column; title: string; maxTasks?: number }> = [
  { id: 'goals', title: 'Goals / Projects / Top' },
  { id: 'inbox', title: 'Inbox' },
  { id: 'today', title: 'Today', maxTasks: 3 },
  { id: 'wait', title: 'Wait / In-Progress (TEMP)' },
  { id: 'finished', title: 'Finished (Archive)' },
  { id: 'someday', title: 'Someday / Maybe' },
];

export function Board() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/tasks', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }

      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const getTasksForColumn = (columnId: Column) => {
    return tasks
      .filter(task => task.column === columnId)
      .sort((a, b) => a.position - b.position);
  };

  if (loading) {
    return <div className="board-loading">Loading board...</div>;
  }

  if (error) {
    return <div className="board-error">Error: {error}</div>;
  }

  return (
    <div className="board">
      <div className="board-columns">
        {COLUMNS.map(column => {
          const columnTasks = getTasksForColumn(column.id);
          return (
            <div key={column.id} className="board-column">
              <div className="column-header">
                <h2 className="column-title">{column.title}</h2>
                {column.maxTasks && (
                  <span className="column-limit">
                    {columnTasks.length}/{column.maxTasks}
                  </span>
                )}
              </div>
              <div className="column-tasks">
                {columnTasks.length === 0 ? (
                  <div className="column-empty">No tasks</div>
                ) : (
                  columnTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => setSelectedTask(task)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
