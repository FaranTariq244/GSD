import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Board.css';
import { TaskCard } from './TaskCard';
import './TaskCard.css';
import { TaskDetailModal } from './TaskDetailModal';
import { AddTaskModal } from './AddTaskModal';
import { OnboardingHints } from './OnboardingHints';
import { ProjectSidebar } from './ProjectSidebar';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectContext';

type Column = 'backlog' | 'ready' | 'in_progress' | 'review' | 'blocked' | 'ready_to_ship' | 'done' | 'archive';

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

const COLUMNS: Array<{ id: Column; title: string; maxTasks?: number; emptyMessage: string }> = [
  { id: 'backlog', title: 'Backlog', emptyMessage: 'No tasks in backlog. Add tasks here for future work.' },
  { id: 'ready', title: 'Ready', emptyMessage: 'No tasks ready to start. Move tasks here when they are ready to be worked on.' },
  { id: 'in_progress', title: 'In Progress', emptyMessage: 'No tasks in progress. Drag tasks here when you start working on them.' },
  { id: 'review', title: 'Review / QA', emptyMessage: 'No tasks in review. Move tasks here when they need review or QA.' },
  { id: 'blocked', title: 'Blocked', emptyMessage: 'No blocked tasks. Move tasks here when they are blocked.' },
  { id: 'ready_to_ship', title: 'Ready to Ship', emptyMessage: 'No tasks ready to ship. Move tasks here when they are ready for deployment.' },
  { id: 'done', title: 'Live / Done', emptyMessage: 'No completed tasks. Tasks will appear here when they are live or done.' },
  { id: 'archive', title: 'Archive', emptyMessage: 'No archived tasks. Move completed tasks here to archive them.' },
];

interface Member {
  id: string;
  name: string;
  email: string;
}

export function Board() {
  const { user, logout } = useAuth();
  const { currentProject, loading: projectsLoading } = useProjects();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dropTarget, setDropTarget] = useState<{ column: Column; position: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [members, setMembers] = useState<Member[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [addTaskColumn, setAddTaskColumn] = useState<Column | null>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    if (currentProject) {
      fetchTasks();
    }
  }, [searchQuery, assigneeFilter, tagFilter, currentProject]);

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
    if (!currentProject) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('projectId', currentProject.id);
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      if (assigneeFilter) {
        params.append('assignee', assigneeFilter);
      }
      if (tagFilter) {
        params.append('tag', tagFilter);
      }

      const url = `/api/tasks?${params.toString()}`;
      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }

      const data = await response.json();
      setTasks(data.tasks || []);

      // Extract unique tags from all tasks for filter dropdown
      const tagsSet = new Set<string>();
      (data.tasks || []).forEach((task: Task) => {
        task.tags.forEach(tag => tagsSet.add(tag));
      });
      setAllTags(Array.from(tagsSet).sort());
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
        throw new Error(data.error || 'Failed to move task');
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

  const handleTaskDrop = (_task: Task) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedTask || !dropTarget) return;

    handleDrop(dropTarget.column, dropTarget.position);
  };

  if (projectsLoading) {
    return <div className="board-loading">Loading projects...</div>;
  }

  if (error) {
    return <div className="board-error">Error: {error}</div>;
  }

  return (
    <div className="board-layout">
      <ProjectSidebar />
      <div className="board">
        <header className="board-header">
          <h1 className="board-title">{currentProject?.name || 'GSD Board'}</h1>
        <nav className="board-nav">
          <button className="nav-link" onClick={() => navigate('/team')}>
            Team
          </button>
          <span className="user-name">{user?.name}</span>
          <button className="nav-link logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </nav>
      </header>

      <OnboardingHints />

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
        <select
          className="tag-filter"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
        >
          <option value="">All Tags</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="board-tasks-loading">Loading tasks...</div>
      )}

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
                <div className="column-header-actions">
                  {column.maxTasks && (
                    <span className="column-limit">
                      {columnTasks.length}/{column.maxTasks}
                    </span>
                  )}
                  <button
                    className="add-task-btn"
                    onClick={() => setAddTaskColumn(column.id)}
                    title="Add task"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="column-tasks">
                {columnTasks.length === 0 ? (
                  <div className="column-empty">{column.emptyMessage}</div>
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

      {addTaskColumn && (
        <AddTaskModal
          targetColumn={addTaskColumn}
          onClose={() => setAddTaskColumn(null)}
          onTaskCreated={fetchTasks}
        />
      )}
      </div>
    </div>
  );
}
