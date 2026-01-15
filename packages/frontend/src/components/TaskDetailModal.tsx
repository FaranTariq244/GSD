import { useEffect, useRef, useState } from 'react';
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

interface Member {
  id: string;
  name: string;
  email: string;
}

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  onTaskUpdated: () => void;
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

export function TaskDetailModal({ task, onClose, onTaskUpdated }: TaskDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);

  // Edit form state
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || '');
  const [editPriority, setEditPriority] = useState(task.priority);
  const [editDueDate, setEditDueDate] = useState(task.due_date || '');
  const [editTags, setEditTags] = useState(task.tags.join(', '));
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>(
    task.assignees.map(a => a.id)
  );

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false);
        } else {
          onClose();
        }
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
  }, [onClose, isEditing]);

  useEffect(() => {
    // Fetch account members for assignee selection
    const fetchMembers = async () => {
      try {
        const response = await fetch('/api/account/members', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setMembers(data.members || []);
        }
      } catch (error) {
        console.error('Failed to fetch members:', error);
      }
    };

    fetchMembers();
  }, []);

  const handleSave = async () => {
    if (!editTitle.trim()) {
      alert('Title is required');
      return;
    }

    setIsSaving(true);
    try {
      const tags = editTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          priority: editPriority,
          due_date: editDueDate || null,
          tags,
          assignee_ids: editAssigneeIds,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      setIsEditing(false);
      onTaskUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original values
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority);
    setEditDueDate(task.due_date || '');
    setEditTags(task.tags.join(', '));
    setEditAssigneeIds(task.assignees.map(a => a.id));
    setIsEditing(false);
  };

  const toggleAssignee = (memberId: string) => {
    setEditAssigneeIds(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

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
          {isEditing ? (
            <input
              type="text"
              className="modal-title-input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Task title"
            />
          ) : (
            <h2 className="modal-title">{task.title}</h2>
          )}
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* Description Section */}
          <section className="modal-section">
            <h3 className="section-title">Description</h3>
            {isEditing ? (
              <textarea
                className="description-textarea"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Add a description..."
                rows={4}
              />
            ) : (
              <div className="description-content">
                {task.description || <span className="text-muted">No description</span>}
              </div>
            )}
          </section>

          {/* Metadata Section */}
          <section className="modal-section">
            <h3 className="section-title">Details</h3>
            <div className="details-grid">
              {/* Priority */}
              <div className="detail-item">
                <label className="detail-label">Priority</label>
                {isEditing ? (
                  <select
                    className="detail-select"
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as Task['priority'])}
                  >
                    <option value="hot">Hot</option>
                    <option value="warm">Warm</option>
                    <option value="normal">Normal</option>
                    <option value="cold">Cold</option>
                  </select>
                ) : (
                  <div className="detail-value">
                    <span
                      className="priority-indicator"
                      style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
                    />
                    {PRIORITY_LABELS[task.priority]}
                  </div>
                )}
              </div>

              {/* Due Date */}
              <div className="detail-item">
                <label className="detail-label">Due Date</label>
                {isEditing ? (
                  <input
                    type="date"
                    className="detail-input"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                  />
                ) : (
                  <div className="detail-value">
                    {task.due_date ? formatDate(task.due_date) : <span className="text-muted">Not set</span>}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="detail-item">
                <label className="detail-label">Tags</label>
                {isEditing ? (
                  <input
                    type="text"
                    className="detail-input"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="tag1, tag2, tag3"
                  />
                ) : (
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
                )}
              </div>

              {/* Assignees */}
              <div className="detail-item">
                <label className="detail-label">Assignees</label>
                {isEditing ? (
                  <div className="assignees-select">
                    {members.map(member => (
                      <label key={member.id} className="assignee-checkbox-label">
                        <input
                          type="checkbox"
                          checked={editAssigneeIds.includes(member.id)}
                          onChange={() => toggleAssignee(member.id)}
                        />
                        <span>{member.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
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
                )}
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

          {/* Edit/Save Buttons */}
          {isEditing ? (
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          ) : (
            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={() => setIsEditing(true)}
              >
                Edit Task
              </button>
            </div>
          )}

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
