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

interface Member {
  id: string;
  name: string;
  email: string;
}

export function Board() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [todayLimitMessage, setTodayLimitMessage] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ column: Column; position: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [searchQuery, assigneeFilter]);

  const fetchMembers = async () => {
    try {
      const response = await fetch('/api/account/members', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }

      const data = await response.json();
      setMembers(data.members || []);
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      if (assigneeFilter) {
        params.append('assignee', assigneeFilter);
      }

      const url = `/api/tasks${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, {
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

  const handleDragStart = (task: Task) => (e: React.DragEvent) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDropTarget(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (targetColumn: Column, targetPosition?: number) => {
    if (!draggedTask) return;

    // Use provided position or append to end of column
    const columnTasks = getTasksForColumn(targetColumn);
    const newPosition = targetPosition !== undefined ? targetPosition : columnTasks.length;

    // Don't do anything if dropping in same position
    if (draggedTask.column === targetColumn && draggedTask.position === newPosition) {
      setDraggedTask(null);
      setDropTarget(null);
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${draggedTask.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          to_column: targetColumn,
          to_position: newPosition,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.code === 'TODAY_LIMIT_REACHED') {
          setTodayLimitMessage(data.error);
          setTimeout(() => setTodayLimitMessage(null), 4000);
        } else {
          throw new Error(data.error || 'Failed to move task');
        }
      } else {
        // Refresh tasks to get updated positions
        await fetchTasks();
      }
    } catch (err) {
      console.error('Error moving task:', err);
      setError(err instanceof Error ? err.message : 'Failed to move task');
    } finally {
      setDraggedTask(null);
      setDropTarget(null);
    }
  };

  const handleTaskDragOver = (task: Task) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedTask || draggedTask.id === task.id) return;

    // Determine if we should drop above or below this task
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const dropAbove = e.clientY < midpoint;

    // Calculate target position
    const columnTasks = getTasksForColumn(task.column);
    const taskIndex = columnTasks.findIndex(t => t.id === task.id);
    const targetPosition = dropAbove ? taskIndex : taskIndex + 1;

    setDropTarget({ column: task.column, position: targetPosition });
  };

  const handleTaskDrop = (task: Task) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedTask || !dropTarget) return;

    handleDrop(dropTarget.column, dropTarget.position);
  };

  if (loading) {
    return <div className="board-loading">Loading board...</div>;
  }

  if (error) {
    return <div className="board-error">Error: {error}</div>;
  }

  return (
    <div className="board">
      {todayLimitMessage && (
        <div className="today-limit-message">
          {todayLimitMessage}
        </div>
      )}

      <div className="board-topbar">
        <input
          type="text"
          placeholder="Search tasks by title..."
          className="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select
          className="assignee-filter"
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
        >
          <option value="">All Assignees</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </div>

      <div className="board-columns">
        {COLUMNS.map(column => {
          const columnTasks = getTasksForColumn(column.id);
          return (
            <div
              key={column.id}
              className="board-column"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(column.id)}
            >
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
                  columnTasks.map((task, index) => {
                    const showDropIndicator =
                      dropTarget &&
                      dropTarget.column === column.id &&
                      dropTarget.position === index;

                    return (
                      <div key={task.id}>
                        {showDropIndicator && (
                          <div className="drop-indicator" />
                        )}
                        <TaskCard
                          task={task}
                          onClick={() => setSelectedTask(task)}
                          onDragStart={handleDragStart(task)}
                          onDragEnd={handleDragEnd}
                          onDragOver={handleTaskDragOver(task)}
                          onDrop={handleTaskDrop(task)}
                        />
                      </div>
                    );
                  })
                )}
                {/* Drop indicator at end of column */}
                {dropTarget &&
                  dropTarget.column === column.id &&
                  dropTarget.position === columnTasks.length && (
                    <div className="drop-indicator" />
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
          onTaskUpdated={fetchTasks}
        />
      )}
    </div>
  );
}
