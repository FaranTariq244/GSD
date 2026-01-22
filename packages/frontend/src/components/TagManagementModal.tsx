import { useEffect, useRef, useState } from 'react';
import './TagManagementModal.css';
import { ColorPicker } from './ColorPicker';
import { DEFAULT_TAG_COLOR } from '../constants/colors';

interface Tag {
  id: number;
  name: string;
  color: string;
  usage_count: number;
}

interface TagManagementModalProps {
  onClose: () => void;
  onTagsUpdated: () => void;
}

export function TagManagementModal({ onClose, onTagsUpdated }: TagManagementModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLOR);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingTagId !== null) {
          setEditingTagId(null);
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
  }, [onClose, editingTagId]);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/tags', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setTags(data.tags || []);
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEdit = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const handleCancelEdit = () => {
    setEditingTagId(null);
    setEditName('');
    setEditColor('');
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || editingTagId === null) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/tags/${editingTagId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: editName.trim(),
          color: editColor,
        }),
      });

      if (response.ok) {
        setTags(prev =>
          prev.map(tag =>
            tag.id === editingTagId
              ? { ...tag, name: editName.trim(), color: editColor }
              : tag
          )
        );
        setEditingTagId(null);
        onTagsUpdated();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update tag');
      }
    } catch (error) {
      console.error('Failed to update tag:', error);
      alert('Failed to update tag');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTag = async (tagId: number, tagName: string, usageCount: number) => {
    const message = usageCount > 0
      ? `This tag is used on ${usageCount} task(s). Are you sure you want to delete "${tagName}"?`
      : `Are you sure you want to delete "${tagName}"?`;

    if (!confirm(message)) return;

    try {
      const response = await fetch(`/api/tags/${tagId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setTags(prev => prev.filter(tag => tag.id !== tagId));
        onTagsUpdated();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete tag');
      }
    } catch (error) {
      console.error('Failed to delete tag:', error);
      alert('Failed to delete tag');
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newTagName.trim(),
          color: newTagColor,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTags(prev => [...prev, { ...data.tag, usage_count: 0 }]);
        setNewTagName('');
        setNewTagColor(DEFAULT_TAG_COLOR);
        onTagsUpdated();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create tag');
      }
    } catch (error) {
      console.error('Failed to create tag:', error);
      alert('Failed to create tag');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="modal-overlay" ref={modalRef}>
      <div className="modal-container tag-management-modal">
        <div className="modal-header">
          <h2 className="modal-title">Manage Tags</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="modal-body">
          {/* Create New Tag */}
          <section className="tag-create-section">
            <h3 className="section-title">Create New Tag</h3>
            <div className="tag-create-form">
              <input
                type="text"
                className="tag-name-input"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name"
                maxLength={100}
              />
              <div className="tag-color-preview">
                <span
                  className="tag-color-dot"
                  style={{ backgroundColor: newTagColor }}
                />
                <span>Color</span>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleCreateTag}
                disabled={isCreating || !newTagName.trim()}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
            <div className="tag-color-picker-section">
              <ColorPicker
                selectedColor={newTagColor}
                onColorChange={setNewTagColor}
              />
            </div>
          </section>

          {/* Tags List */}
          <section className="tag-list-section">
            <h3 className="section-title">All Tags ({tags.length})</h3>

            {isLoading ? (
              <div className="loading-text">Loading tags...</div>
            ) : tags.length === 0 ? (
              <div className="empty-text">No tags yet. Create your first tag above.</div>
            ) : (
              <div className="tags-table">
                <div className="tags-table-header">
                  <span className="tag-col-color">Color</span>
                  <span className="tag-col-name">Name</span>
                  <span className="tag-col-usage">Used</span>
                  <span className="tag-col-actions">Actions</span>
                </div>
                {tags.map(tag => (
                  <div key={tag.id} className={`tags-table-row ${editingTagId === tag.id ? 'editing' : ''}`}>
                    {editingTagId === tag.id ? (
                      <>
                        <div className="tag-col-color">
                          <span
                            className="tag-color-dot large"
                            style={{ backgroundColor: editColor }}
                          />
                        </div>
                        <div className="tag-col-name">
                          <input
                            type="text"
                            className="tag-edit-input"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            maxLength={100}
                            autoFocus
                          />
                        </div>
                        <div className="tag-col-usage">{tag.usage_count}</div>
                        <div className="tag-col-actions">
                          <button
                            className="btn btn-small btn-primary"
                            onClick={handleSaveEdit}
                            disabled={isSaving || !editName.trim()}
                          >
                            Save
                          </button>
                          <button
                            className="btn btn-small btn-secondary"
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                          >
                            Cancel
                          </button>
                        </div>
                        <div className="tag-edit-color-row">
                          <span className="tag-edit-color-label">Choose color:</span>
                          <ColorPicker
                            selectedColor={editColor}
                            onColorChange={setEditColor}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="tag-col-color">
                          <span
                            className="tag-color-dot large"
                            style={{ backgroundColor: tag.color }}
                          />
                        </div>
                        <div className="tag-col-name">
                          <span
                            className="tag-name-preview"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color,
                              borderColor: tag.color
                            }}
                          >
                            {tag.name}
                          </span>
                        </div>
                        <div className="tag-col-usage">{tag.usage_count}</div>
                        <div className="tag-col-actions">
                          <button
                            className="btn btn-small btn-secondary"
                            onClick={() => handleStartEdit(tag)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-small btn-danger"
                            onClick={() => handleDeleteTag(tag.id, tag.name, tag.usage_count)}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
