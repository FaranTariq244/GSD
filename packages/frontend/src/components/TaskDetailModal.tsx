import { useEffect, useRef } from 'react';
import './TaskDetailModal.css';

interface Task {
  id: string;
  title: string;
  description: string | null;
  column: string;
  position: number;
  priority: 'hot' | 'warm' | 'normal' | 'cold';
  due_date: string | null;
  assignees: Array<{ id: string; name: string; email: string }>;
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
}

const PRIORITY_COLORS = {
  hot: '#dc2626',
  warm: '#f59e0b',
  normal: '#6b7280',
  cold: '#3b82f6',
};

const PRIORITY_LABELS = {
  hot: 'Hot',
  warm: 'Warm',
  normal: 'Normal',
  cold: 'Cold',
};

export function TaskDetailModal({ task, onClose }: TaskDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current === e.target) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="modal-overlay" ref={modalRef}>
      <div className="modal-container">
        <div className="modal-header">
          <h2 className="modal-title">{task.title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* Description Section */}
          <section className="modal-section">
            <h3 className="section-title">Description</h3>
            <div className="description-content">
              {task.description || <span className="text-muted">No description</span>}
            </div>
          </section>

          {/* Metadata Section */}
          <section className="modal-section">
            <h3 className="section-title">Details</h3>
            <div className="details-grid">
              {/* Priority */}
              <div className="detail-item">
                <label className="detail-label">Priority</label>
                <div className="detail-value">
                  <span
                    className="priority-indicator"
                    style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
                  />
                  {PRIORITY_LABELS[task.priority]}
                </div>
              </div>

              {/* Due Date */}
              <div className="detail-item">
                <label className="detail-label">Due Date</label>
                <div className="detail-value">
                  {task.due_date ? formatDate(task.due_date) : <span className="text-muted">Not set</span>}
                </div>
              </div>

              {/* Tags */}
              <div className="detail-item">
                <label className="detail-label">Tags</label>
                <div className="detail-value">
                  {task.tags.length > 0 ? (
                    <div className="tags-list">
                      {task.tags.map(tag => (
                        <span key={tag} className="tag-chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted">No tags</span>
                  )}
                </div>
              </div>

              {/* Assignees */}
              <div className="detail-item">
                <label className="detail-label">Assignees</label>
                <div className="detail-value">
                  {task.assignees.length > 0 ? (
                    <div className="assignees-list">
                      {task.assignees.map(assignee => (
                        <div key={assignee.id} className="assignee-item">
                          <div className="assignee-avatar">{getInitials(assignee.name)}</div>
                          <span className="assignee-name">{assignee.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted">Not assigned</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Attachments Section (placeholder) */}
          <section className="modal-section">
            <h3 className="section-title">Attachments</h3>
            <div className="text-muted">No attachments</div>
          </section>

          {/* Comments Section (placeholder) */}
          <section className="modal-section">
            <h3 className="section-title">Comments</h3>
            <div className="text-muted">No comments yet</div>
          </section>

          {/* Metadata Footer */}
          <div className="modal-footer">
            <div className="metadata-text">
              Created {formatDateTime(task.created_at)}
            </div>
            {task.updated_at !== task.created_at && (
              <div className="metadata-text">
                Updated {formatDateTime(task.updated_at)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
