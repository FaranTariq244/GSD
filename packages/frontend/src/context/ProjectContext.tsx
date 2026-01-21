import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  creator_name: string;
  created_at: string;
  updated_at: string;
}

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  setCurrentProject: (project: Project) => void;
  refreshProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project>;
  deleteProject: (projectId: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

const STORAGE_KEY = 'gsd-current-project-id';

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!user) {
      setProjects([]);
      setCurrentProjectState(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/projects', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const data = await response.json();
      const fetchedProjects: Project[] = data.projects || [];
      setProjects(fetchedProjects);

      // Restore last selected project from localStorage or select first project
      const savedProjectId = localStorage.getItem(STORAGE_KEY);
      const savedProject = savedProjectId
        ? fetchedProjects.find(p => p.id === savedProjectId)
        : null;

      if (savedProject) {
        setCurrentProjectState(savedProject);
      } else if (fetchedProjects.length > 0) {
        setCurrentProjectState(fetchedProjects[0]);
        localStorage.setItem(STORAGE_KEY, fetchedProjects[0].id);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const setCurrentProject = (project: Project) => {
    setCurrentProjectState(project);
    localStorage.setItem(STORAGE_KEY, project.id);
  };

  const refreshProjects = async () => {
    await fetchProjects();
  };

  const createProject = async (name: string, description?: string): Promise<Project> => {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, description }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to create project');
    }

    const data = await response.json();
    const newProject: Project = data.project;

    // Add the new project to the list and select it
    setProjects(prev => [...prev, newProject]);
    setCurrentProject(newProject);

    return newProject;
  };

  const deleteProject = async (projectId: string): Promise<void> => {
    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete project');
    }

    // Remove from local state
    setProjects(prev => prev.filter(p => p.id !== projectId));

    // If we deleted the current project, select the first available one
    if (currentProject?.id === projectId) {
      const remaining = projects.filter(p => p.id !== projectId);
      if (remaining.length > 0) {
        setCurrentProject(remaining[0]);
      } else {
        setCurrentProjectState(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        currentProject,
        loading,
        setCurrentProject,
        refreshProjects,
        createProject,
        deleteProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
}
