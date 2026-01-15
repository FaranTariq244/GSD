import { useEffect, useRef, useState } from 'react';
import './TaskDetailModal.css';
import { RichTextEditor, MarkdownContent } from './RichTextEditor';
import './RichTextEditor.css';

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

interface Comment {
  id: string;
  task_id: string;
  body: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
  created_at: string;
}

interface Attachment {
  id: string;
  task_id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  storage_key: string;
  download_url: string;
  thumbnail_url: string | null;
  uploader: {
    id: string;
    name: string;
    email: string;
  };
  created_at: string;
}

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  onTaskUpdated: () => void;
  onTaskDeleted?: () => void;
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

export function TaskDetailModal({ task, onClose, onTaskUpdated, onTaskDeleted }: TaskDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [newCommentBody, setNewCommentBody] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(true);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setIsLoadingMembers(true);
        const response = await fetch('/api/account/members', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setMembers(data.members || []);
        }
      } catch (error) {
        console.error('Failed to fetch members:', error);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    fetchMembers();
  }, []);

  useEffect(() => {
    // Fetch comments for the task
    const fetchComments = async () => {
      try {
        setIsLoadingComments(true);
        const response = await fetch(`/api/tasks/${task.id}/comments`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setComments(data.comments || []);
        }
      } catch (error) {
        console.error('Failed to fetch comments:', error);
      } finally {
        setIsLoadingComments(false);
      }
    };

    fetchComments();
  }, [task.id]);

  useEffect(() => {
    // Fetch attachments for the task
    const fetchAttachments = async () => {
      try {
        setIsLoadingAttachments(true);
        const response = await fetch(`/api/tasks/${task.id}/attachments`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setAttachments(data.attachments || []);
        }
      } catch (error) {
        console.error('Failed to fetch attachments:', error);
      } finally {
        setIsLoadingAttachments(false);
      }
    };

    fetchAttachments();
  }, [task.id]);

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

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      if (onTaskDeleted) {
        onTaskDeleted();
      }
      onTaskUpdated();
      onClose();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newCommentBody.trim()) {
      return;
    }

    setIsSubmittingComment(true);
    try {
      const response = await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          body: newCommentBody.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to post comment');
      }

      const data = await response.json();
      setComments(prev => [...prev, data.comment]);
      setNewCommentBody('');
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Failed to post comment. Please try again.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/tasks/${task.id}/attachments`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload attachment');
      }

      const data = await response.json();
      setAttachments(prev => [...prev, data.attachment]);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading attachment:', error);
      alert('Failed to upload attachment. Please try again.');
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to delete this attachment?')) {
      return;
    }

    try {
      const response = await fetch(`/api/attachments/${attachmentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete attachment');
      }

      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
    } catch (error) {
      console.error('Error deleting attachment:', error);
      alert('Failed to delete attachment. Please try again.');
    }
  };

  const isImage = (mimeType: string) => {
    return mimeType.startsWith('image/');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
              <RichTextEditor
                value={editDescription}
                onChange={setEditDescription}
                placeholder="Add a description... You can paste or drag images here!"
                taskId={task.id}
              />
            ) : (
              <div className="description-content">
                <MarkdownContent content={task.description} />
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
                  isLoadingMembers ? (
                    <div className="loading-text">Loading...</div>
                  ) : (
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
                  )
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

          {/* Attachments Section */}
          <section className="modal-section">
            <h3 className="section-title">Attachments</h3>

            {isLoadingAttachments ? (
              <div className="loading-text">Loading attachments...</div>
            ) : attachments.length === 0 ? (
              <div className="text-muted">No attachments</div>
            ) : (
              <div className="attachments-grid">
                {attachments.map(attachment => (
                  <div key={attachment.id} className="attachment-item">
                    {isImage(attachment.mime_type) ? (
                      <div className="attachment-image-preview">
                        <img
                          src={attachment.thumbnail_url || attachment.download_url}
                          alt={attachment.original_filename}
                          className="attachment-image"
                        />
                        <div className="attachment-overlay">
                          <a
                            href={attachment.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="attachment-action"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View
                          </a>
                          <button
                            className="attachment-action attachment-delete"
                            onClick={() => handleDeleteAttachment(attachment.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="attachment-file">
                        <div className="attachment-file-icon">📄</div>
                        <div className="attachment-file-info">
                          <div className="attachment-file-name">{attachment.original_filename}</div>
                          <div className="attachment-file-size">{formatFileSize(attachment.size_bytes)}</div>
                        </div>
                        <div className="attachment-file-actions">
                          <a
                            href={attachment.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="attachment-action"
                          >
                            Download
                          </a>
                          <button
                            className="attachment-action attachment-delete"
                            onClick={() => handleDeleteAttachment(attachment.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="attachment-uploader">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                disabled={isUploadingAttachment}
              />
              <button
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAttachment}
              >
                {isUploadingAttachment ? 'Uploading...' : 'Add Attachment'}
              </button>
            </div>
          </section>

          {/* Comments Section */}
          <section className="modal-section">
            <h3 className="section-title">Comments</h3>

            {isLoadingComments ? (
              <div className="loading-text">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="text-muted">No comments yet</div>
            ) : (
              <div className="comments-list">
                {comments.map(comment => (
                  <div key={comment.id} className="comment-item">
                    <div className="comment-header">
                      <div className="comment-avatar">
                        {getInitials(comment.author.name)}
                      </div>
                      <div className="comment-meta">
                        <span className="comment-author">{comment.author.name}</span>
                        <span className="comment-date">{formatDateTime(comment.created_at)}</span>
                      </div>
                    </div>
                    <div className="comment-body">{comment.body}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="comment-composer">
              <textarea
                className="comment-textarea"
                value={newCommentBody}
                onChange={(e) => setNewCommentBody(e.target.value)}
                placeholder="Write a comment..."
                rows={3}
              />
              <button
                className="btn btn-primary"
                onClick={handleSubmitComment}
                disabled={isSubmittingComment || !newCommentBody.trim()}
              >
                {isSubmittingComment ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </section>

          {/* Edit/Save Buttons */}
          {isEditing ? (
            <div className="modal-actions">
              <div></div>
              <div className="modal-actions-right">
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
            </div>
          ) : (
            <div className="modal-actions">
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Task'}
              </button>
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
