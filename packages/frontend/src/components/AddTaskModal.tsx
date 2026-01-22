import { useEffect, useRef, useState } from 'react';
import './TaskDetailModal.css';
import { RichTextEditor } from './RichTextEditor';
import './RichTextEditor.css';
import { useProjects } from '../context/ProjectContext';
import { TagPicker, type Tag } from './TagPicker';
import { DEFAULT_TAG_COLOR } from '../constants/colors';

type Column = 'backlog' | 'ready' | 'in_progress' | 'review' | 'blocked' | 'ready_to_ship' | 'done' | 'archive';

interface Member {
  id: string;
  name: string;
  email: string;
}

interface AddTaskModalProps {
  targetColumn: Column;
  onClose: () => void;
  onTaskCreated: () => void;
}

export function AddTaskModal({ targetColumn, onClose, onTaskCreated }: AddTaskModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const { currentProject } = useProjects();
  const [isSaving, setIsSaving] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'hot' | 'warm' | 'normal' | 'cold'>('normal');
  const [dueDate, setDueDate] = useState('');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

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

  useEffect(() => {
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
    const fetchTags = async () => {
      try {
        const response = await fetch('/api/tags', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setAvailableTags(data.tags || []);
        }
      } catch (error) {
        console.error('Failed to fetch tags:', error);
      }
    };

    fetchTags();
  }, []);

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Title is required');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          column: targetColumn,
          priority,
          due_date: dueDate || null,
          tags: selectedTags.map(t => t.id),
          assignee_ids: assigneeIds,
          projectId: currentProject?.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create task');
      }

      onTaskCreated();
      onClose();
    } catch (error) {
      console.error('Error creating task:', error);
      alert(error instanceof Error ? error.message : 'Failed to create task. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAssignee = (memberId: string) => {
    setAssigneeIds(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleCreateTag = async (name: string): Promise<Tag | null> => {
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ name, color: DEFAULT_TAG_COLOR }),
      });

      if (response.ok) {
        const data = await response.json();
        const newTag = data.tag;
        setAvailableTags(prev => [...prev, newTag]);
        return newTag;
      }
    } catch (error) {
      console.error('Failed to create tag:', error);
    }
    return null;
  };

  const getColumnLabel = (col: Column) => {
    const labels: Record<Column, string> = {
      backlog: 'Backlog',
      ready: 'Ready',
      in_progress: 'In Progress',
      review: 'Review / QA',
      blocked: 'Blocked',
      ready_to_ship: 'Ready to Ship',
      done: 'Live / Done',
      archive: 'Archive',
    };
    return labels[col];
  };

  return (
    <div className="modal-overlay" ref={modalRef}>
      <div className="modal-container">
        <div className="modal-header">
          <input
            type="text"
            className="modal-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            autoFocus
          />
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="add-task-column-info">
            Adding to: <strong>{getColumnLabel(targetColumn)}</strong>
          </div>

          {/* Description Section */}
          <section className="modal-section">
            <h3 className="section-title">Description</h3>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Add a description... You can paste or drag images here!"
            />
          </section>

          {/* Metadata Section */}
          <section className="modal-section">
            <h3 className="section-title">Details</h3>
            <div className="details-grid">
              {/* Priority */}
              <div className="detail-item">
                <label className="detail-label">Priority</label>
                <select
                  className="detail-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'hot' | 'warm' | 'normal' | 'cold')}
                >
                  <option value="hot">Hot</option>
                  <option value="warm">Warm</option>
                  <option value="normal">Normal</option>
                  <option value="cold">Cold</option>
                </select>
              </div>

              {/* Due Date */}
              <div className="detail-item">
                <label className="detail-label">Due Date</label>
                <input
                  type="date"
                  className="detail-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              {/* Tags */}
              <div className="detail-item">
                <label className="detail-label">Tags</label>
                <TagPicker
                  selectedTags={selectedTags}
                  onTagsChange={setSelectedTags}
                  availableTags={availableTags}
                  onCreateTag={handleCreateTag}
                  placeholder="Search or create tags..."
                />
              </div>

              {/* Assignees */}
              <div className="detail-item">
                <label className="detail-label">Assignees</label>
                {isLoadingMembers ? (
                  <div className="loading-text">Loading...</div>
                ) : (
                  <div className="assignees-select">
                    {members.map(member => (
                      <label key={member.id} className="assignee-checkbox-label">
                        <input
                          type="checkbox"
                          checked={assigneeIds.includes(member.id)}
                          onChange={() => toggleAssignee(member.id)}
                        />
                        <span>{member.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Action Buttons */}
          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
            >
              {isSaving ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
