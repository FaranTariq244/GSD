import { useState } from 'react';
import { useProjects } from '../context/ProjectContext';
import { CreateProjectModal } from './CreateProjectModal';
import './ProjectSidebar.css';

export function ProjectSidebar() {
  const { projects, currentProject, setCurrentProject, loading } = useProjects();
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (loading) {
    return (
      <div className="project-sidebar">
        <div className="sidebar-header">
          <h2 className="sidebar-title">Projects</h2>
        </div>
        <div className="sidebar-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="project-sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Projects</h2>
      </div>

      <div className="project-list">
        {projects.map((project) => (
          <button
            key={project.id}
            className={`project-item ${currentProject?.id === project.id ? 'active' : ''}`}
            onClick={() => setCurrentProject(project)}
          >
            <span className="project-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
            </span>
            <span className="project-name">{project.name}</span>
          </button>
        ))}
      </div>

      <button className="add-project-btn" onClick={() => setShowCreateModal(true)}>
        <span className="add-icon">+</span>
        <span>Add Project</span>
      </button>

      {showCreateModal && (
        <CreateProjectModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
