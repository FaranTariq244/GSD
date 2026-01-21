import { useEffect, useRef, useState } from 'react';
import { useProjects } from '../context/ProjectContext';
import './CreateProjectModal.css';

interface CreateProjectModalProps {
  onClose: () => void;
}

export function CreateProjectModal({ onClose }: CreateProjectModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const { createProject } = useProjects();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await createProject(name.trim(), description.trim() || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="create-project-overlay" ref={modalRef}>
      <div className="create-project-modal">
        <div className="create-project-header">
          <h2 className="create-project-title">Create New Project</h2>
          <button className="create-project-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="create-project-form">
          {error && <div className="create-project-error">{error}</div>}

          <div className="create-project-field">
            <label htmlFor="project-name" className="create-project-label">
              Project Name *
            </label>
            <input
              id="project-name"
              type="text"
              className="create-project-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name"
              autoFocus
              disabled={isSaving}
            />
          </div>

          <div className="create-project-field">
            <label htmlFor="project-description" className="create-project-label">
              Description (optional)
            </label>
            <textarea
              id="project-description"
              className="create-project-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter project description"
              rows={3}
              disabled={isSaving}
            />
          </div>

          <div className="create-project-actions">
            <button
              type="button"
              className="create-project-btn create-project-btn-cancel"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="create-project-btn create-project-btn-submit"
              disabled={isSaving || !name.trim()}
            >
              {isSaving ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
