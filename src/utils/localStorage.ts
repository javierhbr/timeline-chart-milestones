import { Milestone } from './dateUtils';

const STORAGE_KEY = 'gantt-timeline-data';

interface TimelineData {
  milestones: Milestone[];
  projectStartDate: string;
  expandedMilestones: string[];
  lastModified: number;
}

export function saveTimelineData(
  milestones: Milestone[],
  projectStartDate: Date,
  expandedMilestones: Set<string>
): void {
  try {
    const data: TimelineData = {
      milestones,
      projectStartDate: projectStartDate.toISOString(),
      expandedMilestones: Array.from(expandedMilestones),
      lastModified: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save timeline data to localStorage:', error);
  }
}

export function loadTimelineData(): TimelineData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const data: TimelineData = JSON.parse(stored);
    
    // Validate the structure
    if (
      !data.milestones ||
      !Array.isArray(data.milestones) ||
      !data.projectStartDate ||
      !data.expandedMilestones ||
      !Array.isArray(data.expandedMilestones)
    ) {
      console.warn('Invalid timeline data structure in localStorage');
      clearTimelineData();
      return null;
    }
    
    return data;
  } catch (error) {
    console.warn('Failed to load timeline data from localStorage:', error);
    clearTimelineData();
    return null;
  }
}

export function clearTimelineData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear timeline data from localStorage:', error);
  }
}

export function hasTimelineData(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}