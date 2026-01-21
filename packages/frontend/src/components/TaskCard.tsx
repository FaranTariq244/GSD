interface TaskCardProps {
  task: {
    id: string;
    title: string;
    priority: 'hot' | 'warm' | 'normal' | 'cold';
    due_date: string | null;
    assignees: Array<{ id: string; name: string; email: string }>;
    tags: string[];
  };
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

const PRIORITY_COLORS = {
  hot: '#dc2626',
  warm: '#f59e0b',
  normal: '#6b7280',
  cold: '#3b82f6',
};

export function TaskCard({ task, onClick, onDragStart, onDragEnd, onDragOver, onDrop }: TaskCardProps) {
  const visibleTags = task.tags.slice(0, 2);
  const remainingTagCount = task.tags.length - 2;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(date);
    dueDate.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)}d ago`, isOverdue: true };
    } else if (diffDays === 0) {
      return { text: 'Today', isOverdue: false };
    } else if (diffDays === 1) {
      return { text: 'Tomorrow', isOverdue: false };
    } else if (diffDays <= 7) {
      return { text: `${diffDays}d`, isOverdue: false };
    } else {
      return { text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), isOverdue: false };
    }
  };

  const dueDateInfo = task.due_date ? formatDueDate(task.due_date) : null;

  return (
    <div
      className="task-card"
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="task-priority-bar" style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
      <div className="task-card-content">
        <div className="task-card-header">
          <h3 className="task-title">{task.title}</h3>
        </div>

      {(task.tags.length > 0 || task.assignees.length > 0 || dueDateInfo) && (
        <div className="task-card-footer">
          {task.tags.length > 0 && (
            <div className="task-tags">
              {visibleTags.map(tag => (
                <span key={tag} className="task-tag">
                  {tag}
                </span>
              ))}
              {remainingTagCount > 0 && (
                <span className="task-tag-more">+{remainingTagCount}</span>
              )}
            </div>
          )}

          <div className="task-card-meta">
            {dueDateInfo && (
              <span className={`task-due-date ${dueDateInfo.isOverdue ? 'overdue' : ''}`}>
                {dueDateInfo.text}
              </span>
            )}

            {task.assignees.length > 0 && (
              <div className="task-assignees">
                {task.assignees.slice(0, 3).map(assignee => (
                  <div key={assignee.id} className="task-assignee-avatar" title={assignee.name}>
                    {getInitials(assignee.name)}
                  </div>
                ))}
                {task.assignees.length > 3 && (
                  <div className="task-assignee-avatar task-assignee-more">
                    +{task.assignees.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
