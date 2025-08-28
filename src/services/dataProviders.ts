import { Project, TimelineData } from '../utils/projectStorage';
import { googleSheetsService } from './googleSheetsService';
import * as localStorage from '../utils/projectStorage';
import { logger } from '../utils/logger';

export interface DataProvider {
  // Project management
  createProject(name: string, timelineData: TimelineData): Promise<Project>;
  saveProject(projectId: string, timelineData: TimelineData): Promise<void>;
  loadProject(projectId: string): Promise<Project | null>;
  deleteProject(projectId: string): Promise<void>;
  renameProject(projectId: string, newName: string): Promise<void>;
  listProjects(): Promise<Project[]>;
  getCurrentProject(): Promise<Project | null>;
  setCurrentProject(projectId: string): Promise<void>;
  
  // Provider metadata
  getProviderType(): 'localStorage' | 'googleSheets';
  isConnected(): boolean;
  getConnectionInfo(): any;
}

export class LocalStorageProvider implements DataProvider {
  getProviderType(): 'localStorage' {
    return 'localStorage';
  }

  isConnected(): boolean {
    return true; // localStorage is always available
  }

  getConnectionInfo() {
    return { type: 'localStorage', status: 'connected' };
  }

  async createProject(name: string, timelineData: TimelineData): Promise<Project> {
    logger.debug('Creating project in localStorage', { 
      module: 'DataProvider', 
      action: 'createProject',
      name,
      milestonesCount: timelineData.milestones.length
    });
    return localStorage.createProject(name, timelineData);
  }

  async saveProject(projectId: string, timelineData: TimelineData): Promise<void> {
    logger.debug('Saving project to localStorage', { 
      module: 'DataProvider', 
      action: 'saveProject',
      projectId,
      milestonesCount: timelineData.milestones.length
    });
    localStorage.saveProject(projectId, timelineData);
  }

  async loadProject(projectId: string): Promise<Project | null> {
    logger.debug('Loading project from localStorage', { 
      module: 'DataProvider', 
      action: 'loadProject',
      projectId
    });
    return localStorage.loadProject(projectId);
  }

  async deleteProject(projectId: string): Promise<void> {
    localStorage.deleteProject(projectId);
  }

  async renameProject(projectId: string, newName: string): Promise<void> {
    localStorage.renameProject(projectId, newName);
  }

  async listProjects(): Promise<Project[]> {
    return localStorage.listProjects();
  }

  async getCurrentProject(): Promise<Project | null> {
    return localStorage.getCurrentProject();
  }

  async setCurrentProject(projectId: string): Promise<void> {
    localStorage.setCurrentProject(projectId);
  }
}

export class GoogleSheetsProvider implements DataProvider {
  private connectedSpreadsheets: Map<string, string> = new Map(); // projectId -> spreadsheetId

  getProviderType(): 'googleSheets' {
    return 'googleSheets';
  }

  isConnected(): boolean {
    return googleSheetsService.isAuthenticated();
  }

  getConnectionInfo() {
    return { 
      type: 'googleSheets', 
      status: this.isConnected() ? 'connected' : 'disconnected',
      spreadsheetCount: this.connectedSpreadsheets.size
    };
  }

  async createProject(name: string, timelineData: TimelineData): Promise<Project> {
    if (!this.isConnected()) {
      const error = 'Google Sheets not connected';
      logger.error(error, undefined, { 
        module: 'DataProvider', 
        action: 'createProject' 
      });
      throw new Error(error);
    }

    logger.info('Creating project in Google Sheets', { 
      module: 'DataProvider', 
      action: 'createProject',
      name,
      milestonesCount: timelineData.milestones.length
    });

    // Create new spreadsheet
    const spreadsheetInfo = await googleSheetsService.createSpreadsheet(name);
    
    // Create project object
    const project: Project = {
      id: `sheets_${spreadsheetInfo.id}`,
      name,
      createdAt: Date.now(),
      lastModified: Date.now(),
      timelineData,
    };

    // Save project to spreadsheet
    await googleSheetsService.saveProjectToSheet(spreadsheetInfo.id, project);
    
    // Track the connection
    this.connectedSpreadsheets.set(project.id, spreadsheetInfo.id);
    
    logger.info('Project created successfully in Google Sheets', { 
      module: 'DataProvider', 
      action: 'createProject',
      projectId: project.id,
      spreadsheetId: spreadsheetInfo.id
    });
    
    return project;
  }

  async saveProject(projectId: string, timelineData: TimelineData): Promise<void> {
    if (!this.isConnected()) {
      const error = 'Google Sheets not connected';
      logger.error(error, undefined, { 
        module: 'DataProvider', 
        action: 'saveProject',
        projectId 
      });
      throw new Error(error);
    }

    logger.debug('Saving project to Google Sheets', { 
      module: 'DataProvider', 
      action: 'saveProject',
      projectId,
      milestonesCount: timelineData.milestones.length
    });

    const spreadsheetId = this.getSpreadsheetId(projectId);
    if (!spreadsheetId) {
      const error = `Spreadsheet not found for project ${projectId}`;
      logger.error(error, undefined, { 
        module: 'DataProvider', 
        action: 'saveProject',
        projectId 
      });
      throw new Error(error);
    }

    // Load current project to preserve metadata
    const currentProject = await this.loadProject(projectId);
    if (!currentProject) {
      const error = `Project ${projectId} not found`;
      logger.error(error, undefined, { 
        module: 'DataProvider', 
        action: 'saveProject',
        projectId 
      });
      throw new Error(error);
    }

    const updatedProject: Project = {
      ...currentProject,
      timelineData,
      lastModified: Date.now(),
    };

    await googleSheetsService.saveProjectToSheet(spreadsheetId, updatedProject);
    
    logger.debug('Project saved successfully to Google Sheets', { 
      module: 'DataProvider', 
      action: 'saveProject',
      projectId,
      spreadsheetId
    });
  }

  async loadProject(projectId: string): Promise<Project | null> {
    if (!this.isConnected()) {
      const error = 'Google Sheets not connected';
      logger.error(error, undefined, { 
        module: 'DataProvider', 
        action: 'loadProject',
        projectId 
      });
      throw new Error(error);
    }

    logger.debug('Loading project from Google Sheets', { 
      module: 'DataProvider', 
      action: 'loadProject',
      projectId
    });

    const spreadsheetId = this.getSpreadsheetId(projectId);
    if (!spreadsheetId) {
      logger.debug('Spreadsheet ID not found for project', { 
        module: 'DataProvider', 
        action: 'loadProject',
        projectId
      });
      return null;
    }

    try {
      const project = await googleSheetsService.loadProjectFromSheet(spreadsheetId);
      logger.debug('Project loaded successfully from Google Sheets', { 
        module: 'DataProvider', 
        action: 'loadProject',
        projectId,
        spreadsheetId
      });
      return project;
    } catch (error) {
      logger.error('Failed to load project from sheets', error as Error, { 
        module: 'DataProvider', 
        action: 'loadProject',
        projectId,
        spreadsheetId
      });
      return null;
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    // Note: We don't actually delete the spreadsheet, just remove our tracking
    // Users can manually delete the spreadsheet if they want
    this.connectedSpreadsheets.delete(projectId);
  }

  async renameProject(projectId: string, newName: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Google Sheets not connected');
    }

    const project = await this.loadProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const updatedProject: Project = {
      ...project,
      name: newName,
      lastModified: Date.now(),
    };

    const spreadsheetId = this.getSpreadsheetId(projectId);
    if (spreadsheetId) {
      await googleSheetsService.saveProjectToSheet(spreadsheetId, updatedProject);
    }
  }

  async listProjects(): Promise<Project[]> {
    if (!this.isConnected()) {
      return [];
    }

    try {
      // Get all spreadsheets and try to load them as projects
      const spreadsheets = await googleSheetsService.listSpreadsheets();
      const projects: Project[] = [];

      for (const spreadsheet of spreadsheets) {
        try {
          const project = await googleSheetsService.loadProjectFromSheet(spreadsheet.id);
          projects.push(project);
          // Track the connection
          this.connectedSpreadsheets.set(project.id, spreadsheet.id);
        } catch (error) {
          // Skip spreadsheets that aren't valid projects
          console.debug(`Skipping spreadsheet ${spreadsheet.name} - not a valid project`);
        }
      }

      return projects.sort((a, b) => b.lastModified - a.lastModified);
    } catch (error) {
      console.error('Failed to list projects from sheets:', error);
      return [];
    }
  }

  async getCurrentProject(): Promise<Project | null> {
    // For Google Sheets, we'll need to implement a way to track current project
    // For now, we'll just return null and rely on external state management
    return null;
  }

  async setCurrentProject(projectId: string): Promise<void> {
    // For Google Sheets, we'll need to implement a way to track current project
    // For now, we'll just ensure the project exists
    const project = await this.loadProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
  }

  // Helper method to get spreadsheet ID from project ID
  private getSpreadsheetId(projectId: string): string | null {
    // First check our cache
    const cached = this.connectedSpreadsheets.get(projectId);
    if (cached) {
      return cached;
    }

    // Extract from project ID if it follows our convention
    if (projectId.startsWith('sheets_')) {
      const spreadsheetId = projectId.replace('sheets_', '');
      this.connectedSpreadsheets.set(projectId, spreadsheetId);
      return spreadsheetId;
    }

    return null;
  }

  // Method to connect to an existing spreadsheet
  async connectToSpreadsheet(spreadsheetId: string): Promise<Project> {
    if (!this.isConnected()) {
      throw new Error('Google Sheets not connected');
    }

    try {
      const project = await googleSheetsService.loadProjectFromSheet(spreadsheetId);
      this.connectedSpreadsheets.set(project.id, spreadsheetId);
      return project;
    } catch (error) {
      throw new Error(`Failed to connect to spreadsheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Data provider manager
export class DataProviderManager {
  private localProvider = new LocalStorageProvider();
  private sheetsProvider = new GoogleSheetsProvider();
  private currentProvider: DataProvider;

  constructor() {
    this.currentProvider = this.localProvider;
  }

  switchToLocalStorage(): void {
    logger.info('Switching to localStorage provider', { 
      module: 'DataProvider', 
      action: 'switchToLocalStorage',
      previousProvider: this.currentProvider.getProviderType()
    });
    this.currentProvider = this.localProvider;
  }

  switchToGoogleSheets(): void {
    if (!this.sheetsProvider.isConnected()) {
      const error = 'Google Sheets is not connected';
      logger.error(error, undefined, { 
        module: 'DataProvider', 
        action: 'switchToGoogleSheets'
      });
      throw new Error(error);
    }
    
    logger.info('Switching to Google Sheets provider', { 
      module: 'DataProvider', 
      action: 'switchToGoogleSheets',
      previousProvider: this.currentProvider.getProviderType()
    });
    this.currentProvider = this.sheetsProvider;
  }

  getCurrentProvider(): DataProvider {
    return this.currentProvider;
  }

  getLocalProvider(): LocalStorageProvider {
    return this.localProvider;
  }

  getSheetsProvider(): GoogleSheetsProvider {
    return this.sheetsProvider;
  }

  isUsingGoogleSheets(): boolean {
    return this.currentProvider === this.sheetsProvider;
  }

  isUsingLocalStorage(): boolean {
    return this.currentProvider === this.localProvider;
  }

  async migrateToSheets(projectId: string): Promise<Project> {
    logger.info('Starting migration to Google Sheets', { 
      module: 'DataProvider', 
      action: 'migrateToSheets',
      projectId
    });

    // Load project from localStorage
    const project = await this.localProvider.loadProject(projectId);
    if (!project) {
      const error = `Project ${projectId} not found in localStorage`;
      logger.error(error, undefined, { 
        module: 'DataProvider', 
        action: 'migrateToSheets',
        projectId
      });
      throw new Error(error);
    }

    // Create new project in Google Sheets
    const sheetsProject = await this.sheetsProvider.createProject(project.name, project.timelineData);
    
    logger.info('Migration to Google Sheets completed', { 
      module: 'DataProvider', 
      action: 'migrateToSheets',
      originalProjectId: projectId,
      newProjectId: sheetsProject.id
    });
    
    return sheetsProject;
  }

  async migrateToLocal(projectId: string): Promise<Project> {
    logger.info('Starting migration to localStorage', { 
      module: 'DataProvider', 
      action: 'migrateToLocal',
      projectId
    });

    // Load project from Google Sheets
    const project = await this.sheetsProvider.loadProject(projectId);
    if (!project) {
      const error = `Project ${projectId} not found in Google Sheets`;
      logger.error(error, undefined, { 
        module: 'DataProvider', 
        action: 'migrateToLocal',
        projectId
      });
      throw new Error(error);
    }

    // Create new project in localStorage
    const localProject = await this.localProvider.createProject(project.name, project.timelineData);
    
    logger.info('Migration to localStorage completed', { 
      module: 'DataProvider', 
      action: 'migrateToLocal',
      originalProjectId: projectId,
      newProjectId: localProject.id
    });
    
    return localProject;
  }
}

// Singleton instance
export const dataProviderManager = new DataProviderManager();