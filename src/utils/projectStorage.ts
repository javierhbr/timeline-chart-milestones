import { Milestone } from './dateUtils';

export interface TimelineData {
  milestones: Milestone[];
  projectStartDate: string;
  expandedMilestones: string[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  lastModified: number;
  timelineData: TimelineData;
}

export interface ProjectsStorage {
  projects: Record<string, Project>;
  currentProjectId: string | null;
  lastAccessedProjectIds: string[];
}

const PROJECTS_STORAGE_KEY = 'gantt-projects';
const OLD_STORAGE_KEY = 'gantt-timeline-data';
const MAX_RECENT_PROJECTS = 5;

export function generateProjectId(): string {
  return (
    'project_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  );
}

export function generateDefaultProjectName(): string {
  const timestamp = new Date().toLocaleDateString();
  return `Project ${timestamp}`;
}

export function getProjectsStorage(): ProjectsStorage {
  try {
    const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!stored) {
      return {
        projects: {},
        currentProjectId: null,
        lastAccessedProjectIds: [],
      };
    }

    const data: ProjectsStorage = JSON.parse(stored);

    // Validate the structure
    if (
      typeof data !== 'object' ||
      !data.projects ||
      typeof data.projects !== 'object' ||
      !Array.isArray(data.lastAccessedProjectIds)
    ) {
      console.warn('Invalid projects storage structure in localStorage');
      return {
        projects: {},
        currentProjectId: null,
        lastAccessedProjectIds: [],
      };
    }

    return data;
  } catch (error) {
    console.warn('Failed to load projects storage from localStorage:', error);
    return {
      projects: {},
      currentProjectId: null,
      lastAccessedProjectIds: [],
    };
  }
}

export function saveProjectsStorage(storage: ProjectsStorage): void {
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(storage));
  } catch (error) {
    console.warn('Failed to save projects storage to localStorage:', error);
  }
}

export function createProject(
  name: string,
  timelineData: TimelineData,
  makeActive: boolean = true
): Project {
  const now = Date.now();
  const project: Project = {
    id: generateProjectId(),
    name: name,
    createdAt: now,
    lastModified: now,
    timelineData: timelineData,
  };

  const storage = getProjectsStorage();
  storage.projects[project.id] = project;

  if (makeActive) {
    storage.currentProjectId = project.id;
  }

  // Update recent projects list
  updateRecentProjects(storage, project.id);

  saveProjectsStorage(storage);
  return project;
}

export function saveProject(
  projectId: string,
  timelineData: TimelineData
): void {
  const storage = getProjectsStorage();
  const project = storage.projects[projectId];

  if (!project) {
    console.warn(`Project with id ${projectId} not found`);
    return;
  }

  project.timelineData = timelineData;
  project.lastModified = Date.now();

  // Update recent projects list
  updateRecentProjects(storage, projectId);

  saveProjectsStorage(storage);
}

export function loadProject(projectId: string): Project | null {
  const storage = getProjectsStorage();
  const project = storage.projects[projectId];

  if (!project) {
    console.warn(`Project with id ${projectId} not found`);
    return null;
  }

  // Update current project and recent projects
  storage.currentProjectId = projectId;
  updateRecentProjects(storage, projectId);
  saveProjectsStorage(storage);

  return project;
}

export function deleteProject(projectId: string): void {
  const storage = getProjectsStorage();

  if (!storage.projects[projectId]) {
    console.warn(`Project with id ${projectId} not found`);
    return;
  }

  delete storage.projects[projectId];

  // Remove from recent projects
  storage.lastAccessedProjectIds = storage.lastAccessedProjectIds.filter(
    id => id !== projectId
  );

  // If this was the current project, clear current project
  if (storage.currentProjectId === projectId) {
    storage.currentProjectId = null;
  }

  saveProjectsStorage(storage);
}

export function renameProject(projectId: string, newName: string): void {
  const storage = getProjectsStorage();
  const project = storage.projects[projectId];

  if (!project) {
    console.warn(`Project with id ${projectId} not found`);
    return;
  }

  project.name = newName;
  project.lastModified = Date.now();
  saveProjectsStorage(storage);
}

export function duplicateProject(
  projectId: string,
  newName?: string
): Project | null {
  const storage = getProjectsStorage();
  const originalProject = storage.projects[projectId];

  if (!originalProject) {
    console.warn(`Project with id ${projectId} not found`);
    return null;
  }

  const duplicatedName = newName || `${originalProject.name} (Copy)`;
  return createProject(duplicatedName, originalProject.timelineData, false);
}

export function listProjects(): Project[] {
  const storage = getProjectsStorage();
  return Object.values(storage.projects).sort(
    (a, b) => b.lastModified - a.lastModified
  );
}

export function getCurrentProject(): Project | null {
  const storage = getProjectsStorage();

  if (!storage.currentProjectId) {
    return null;
  }

  return storage.projects[storage.currentProjectId] || null;
}

export function getRecentProjects(): Project[] {
  const storage = getProjectsStorage();
  return storage.lastAccessedProjectIds
    .map(id => storage.projects[id])
    .filter(Boolean)
    .slice(0, MAX_RECENT_PROJECTS);
}

export function setCurrentProject(projectId: string): void {
  const storage = getProjectsStorage();

  if (!storage.projects[projectId]) {
    console.warn(`Project with id ${projectId} not found`);
    return;
  }

  storage.currentProjectId = projectId;
  updateRecentProjects(storage, projectId);
  saveProjectsStorage(storage);
}

function updateRecentProjects(
  storage: ProjectsStorage,
  projectId: string
): void {
  // Remove if already in list
  storage.lastAccessedProjectIds = storage.lastAccessedProjectIds.filter(
    id => id !== projectId
  );

  // Add to beginning
  storage.lastAccessedProjectIds.unshift(projectId);

  // Keep only the most recent projects
  storage.lastAccessedProjectIds = storage.lastAccessedProjectIds.slice(
    0,
    MAX_RECENT_PROJECTS
  );
}

// Migration functions
export function migrateOldData(): void {
  try {
    const oldData = localStorage.getItem(OLD_STORAGE_KEY);

    if (!oldData) {
      return; // No old data to migrate
    }

    const storage = getProjectsStorage();

    // Only migrate if no projects exist yet
    if (Object.keys(storage.projects).length > 0) {
      return; // Projects already exist, don't migrate
    }

    const oldTimelineData = JSON.parse(oldData);

    // Validate old data structure
    if (
      !oldTimelineData.milestones ||
      !Array.isArray(oldTimelineData.milestones) ||
      !oldTimelineData.projectStartDate ||
      !oldTimelineData.expandedMilestones ||
      !Array.isArray(oldTimelineData.expandedMilestones)
    ) {
      console.warn('Invalid old timeline data structure, skipping migration');
      return;
    }

    // Convert old format to new format
    const timelineData: TimelineData = {
      milestones: oldTimelineData.milestones,
      projectStartDate: oldTimelineData.projectStartDate,
      expandedMilestones: oldTimelineData.expandedMilestones,
    };

    // Create default project from old data
    createProject('Default Project', timelineData, true);

    console.log(
      'Successfully migrated old timeline data to new project structure'
    );

    // Remove old data after successful migration
    localStorage.removeItem(OLD_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to migrate old timeline data:', error);
  }
}

export function clearAllProjects(): void {
  try {
    localStorage.removeItem(PROJECTS_STORAGE_KEY);
    console.log('All projects cleared from localStorage');
  } catch (error) {
    console.warn('Failed to clear all projects from localStorage:', error);
  }
}

export function hasAnyProjects(): boolean {
  const storage = getProjectsStorage();
  return Object.keys(storage.projects).length > 0;
}

// Export functions for backward compatibility
export function exportProjectAsJSON(projectId: string): string | null {
  const storage = getProjectsStorage();
  const project = storage.projects[projectId];

  if (!project) {
    return null;
  }

  return JSON.stringify(project.timelineData.milestones, null, 2);
}

export function exportAllProjectsAsJSON(): string {
  const storage = getProjectsStorage();
  return JSON.stringify(storage, null, 2);
}
