import { gapi } from 'gapi-script';
import { Milestone, Task } from '../utils/dateUtils';
import { Project, TimelineData } from '../utils/projectStorage';
import { logger } from '../utils/logger';

interface SpreadsheetInfo {
  id: string;
  name: string;
  url: string;
}

export class GoogleSheetsService {
  private static instance: GoogleSheetsService;
  private isInitialized = false;
  private accessToken: string | null = null;

  private constructor() {}

  static getInstance(): GoogleSheetsService {
    if (!GoogleSheetsService.instance) {
      GoogleSheetsService.instance = new GoogleSheetsService();
    }
    return GoogleSheetsService.instance;
  }

  async initialize(clientId: string): Promise<void> {
    if (this.isInitialized) {
      logger.debug('Google Sheets service already initialized', { 
        module: 'GoogleSheets', 
        action: 'initialize' 
      });
      return;
    }

    logger.info('Initializing Google Sheets service', { 
      module: 'GoogleSheets', 
      action: 'initialize',
      clientId: clientId.substring(0, 20) + '...', // Partial client ID for logging
      currentOrigin: window.location.origin,
      currentHref: window.location.href
    });

    try {
      // Load Google APIs
      await logger.logApiCall('gapi.load', () => 
        new Promise<void>((resolve, reject) => {
          gapi.load('client:auth2', {
            callback: () => {
              logger.debug('Google APIs loaded successfully', { 
                module: 'GoogleSheets', 
                action: 'initialize' 
              });
              resolve();
            },
            onerror: () => {
              logger.error('Failed to load Google APIs', undefined, { 
                module: 'GoogleSheets', 
                action: 'initialize' 
              });
              reject(new Error('Failed to load Google APIs'));
            }
          });
        })
      );

      // Initialize Google client with better configuration
      await logger.logApiCall('gapi.client.init', () => 
        gapi.client.init({
          clientId: clientId,
          discoveryDocs: [
            'https://sheets.googleapis.com/$discovery/rest?version=v4',
            'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
          ],
          scope: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file',
            'openid',
            'profile',
            'email'
          ].join(' '),
          // Add plugin name for better OAuth tracking
          plugin_name: 'timeline-milestones'
        })
      );

      this.isInitialized = true;
      logger.info('Google Sheets service initialized successfully', { 
        module: 'GoogleSheets', 
        action: 'initialize' 
      });
    } catch (error) {
      logger.error('Failed to initialize Google Sheets integration', error as Error, { 
        module: 'GoogleSheets', 
        action: 'initialize' 
      });
      throw new Error('Failed to initialize Google Sheets integration');
    }
  }

  async signIn(): Promise<void> {
    if (!this.isInitialized) {
      logger.error('Attempted to sign in before initialization', undefined, { 
        module: 'GoogleSheets', 
        action: 'signIn' 
      });
      throw new Error('Google Sheets service not initialized');
    }

    logger.info('Starting Google sign-in process', { 
      module: 'GoogleSheets', 
      action: 'signIn' 
    });

    try {
      const authInstance = gapi.auth2.getAuthInstance();
      logger.debug('Got auth instance, initiating sign-in', { 
        module: 'GoogleSheets', 
        action: 'signIn' 
      });

      const user = await logger.logApiCall('authInstance.signIn', () => authInstance.signIn());
      const authResponse = user.getAuthResponse();
      this.accessToken = authResponse.access_token;

      logger.info('Google sign-in successful', { 
        module: 'GoogleSheets', 
        action: 'signIn',
        userEmail: user.getBasicProfile()?.getEmail(),
        hasAccessToken: !!this.accessToken,
        tokenLength: this.accessToken?.length
      });
    } catch (error) {
      logger.error('Google sign-in failed', error as Error, { 
        module: 'GoogleSheets', 
        action: 'signIn' 
      });
      throw new Error('Failed to sign in to Google');
    }
  }

  signOut(): void {
    logger.info('Signing out from Google', { 
      module: 'GoogleSheets', 
      action: 'signOut' 
    });

    if (this.isInitialized) {
      const authInstance = gapi.auth2.getAuthInstance();
      authInstance.signOut();
      this.accessToken = null;
      
      logger.info('Google sign-out completed', { 
        module: 'GoogleSheets', 
        action: 'signOut' 
      });
    } else {
      logger.warn('Attempted to sign out without initialization', { 
        module: 'GoogleSheets', 
        action: 'signOut' 
      });
    }
  }

  isAuthenticated(): boolean {
    if (!this.isInitialized) {
      logger.debug('Not authenticated - service not initialized', { 
        module: 'GoogleSheets', 
        action: 'isAuthenticated' 
      });
      return false;
    }
    
    const authInstance = gapi.auth2.getAuthInstance();
    const isSignedIn = authInstance.isSignedIn.get();
    
    logger.debug('Authentication status checked', { 
      module: 'GoogleSheets', 
      action: 'isAuthenticated',
      isSignedIn,
      isInitialized: this.isInitialized
    });
    
    return isSignedIn;
  }

  async createSpreadsheet(title: string): Promise<SpreadsheetInfo> {
    if (!this.isAuthenticated()) {
      logger.error('Attempted to create spreadsheet without authentication', undefined, { 
        module: 'GoogleSheets', 
        action: 'createSpreadsheet',
        title
      });
      throw new Error('Not authenticated');
    }

    logger.info('Creating new spreadsheet', { 
      module: 'GoogleSheets', 
      action: 'createSpreadsheet',
      title
    });

    try {
      // Create spreadsheet
      const response = await logger.logApiCall('sheets.spreadsheets.create', () =>
        gapi.client.sheets.spreadsheets.create({
          properties: {
            title: title,
          },
          sheets: [
            {
              properties: {
                title: 'ProjectInfo',
                index: 0,
              },
            },
            {
              properties: {
                title: 'Milestones',
                index: 1,
              },
            },
            {
              properties: {
                title: 'Tasks',
                index: 2,
              },
            },
          ],
        }), { spreadsheetTitle: title }
      );

      const spreadsheet = response.result;
      const spreadsheetId = spreadsheet.spreadsheetId!;

      logger.info('Spreadsheet created successfully', { 
        module: 'GoogleSheets', 
        action: 'createSpreadsheet',
        spreadsheetId,
        title,
        url: spreadsheet.spreadsheetUrl
      });

      // Initialize headers
      await this.initializeSheetHeaders(spreadsheetId);

      const result = {
        id: spreadsheetId,
        name: title,
        url: spreadsheet.spreadsheetUrl!,
      };

      logger.info('Spreadsheet creation completed with headers', { 
        module: 'GoogleSheets', 
        action: 'createSpreadsheet',
        spreadsheetId,
        result
      });

      return result;
    } catch (error) {
      logger.error('Failed to create spreadsheet', error as Error, { 
        module: 'GoogleSheets', 
        action: 'createSpreadsheet',
        title
      });
      throw new Error('Failed to create spreadsheet');
    }
  }

  private async initializeSheetHeaders(spreadsheetId: string): Promise<void> {
    logger.debug('Initializing sheet headers', { 
      module: 'GoogleSheets', 
      action: 'initializeSheetHeaders',
      spreadsheetId
    });

    const requests = [
      // ProjectInfo headers
      {
        range: 'ProjectInfo!A1:D1',
        values: [['projectName', 'projectStartDate', 'lastModified', 'createdAt']],
      },
      // Milestones headers
      {
        range: 'Milestones!A1:E1',
        values: [['milestoneId', 'milestoneName', 'startDate', 'endDate', 'orderIndex']],
      },
      // Tasks headers
      {
        range: 'Tasks!A1:K1',
        values: [
          [
            'taskId',
            'milestoneId',
            'name',
            'description',
            'team',
            'sprint',
            'durationDays',
            'dependsOn',
            'startDate',
            'endDate',
            'orderIndex',
          ],
        ],
      },
    ];

    await logger.logApiCall('sheets.spreadsheets.values.batchUpdate', () =>
      gapi.client.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: {
          valueInputOption: 'RAW',
          data: requests,
        },
      }), { 
        spreadsheetId, 
        operation: 'initializeHeaders',
        requestCount: requests.length 
      }
    );

    logger.info('Sheet headers initialized successfully', { 
      module: 'GoogleSheets', 
      action: 'initializeSheetHeaders',
      spreadsheetId,
      sheetsInitialized: ['ProjectInfo', 'Milestones', 'Tasks']
    });
  }

  async saveProjectToSheet(spreadsheetId: string, project: Project): Promise<void> {
    if (!this.isAuthenticated()) {
      logger.error('Attempted to save project without authentication', undefined, { 
        module: 'GoogleSheets', 
        action: 'saveProjectToSheet',
        spreadsheetId,
        projectId: project.id
      });
      throw new Error('Not authenticated');
    }

    logger.info('Saving project to spreadsheet', { 
      module: 'GoogleSheets', 
      action: 'saveProjectToSheet',
      spreadsheetId,
      projectId: project.id,
      projectName: project.name,
      milestoneCount: project.timelineData.milestones.length,
      taskCount: project.timelineData.milestones.reduce((acc, m) => acc + m.tasks.length, 0)
    });

    try {
      // Prepare project info data
      const projectInfoData = [
        [
          project.name,
          project.timelineData.projectStartDate,
          project.lastModified.toString(),
          project.createdAt.toString(),
        ],
      ];

      logger.logDataTransform('prepareProjectInfo', 1, { projectId: project.id });

      // Prepare milestones data
      const milestonesData = project.timelineData.milestones.map((milestone, index) => [
        milestone.milestoneId,
        milestone.milestoneName,
        milestone.startDate || '',
        milestone.endDate || '',
        (project.timelineData.milestoneOrder?.indexOf(milestone.milestoneId) ?? index).toString(),
      ]);

      logger.logDataTransform('prepareMilestones', milestonesData.length, { 
        projectId: project.id, 
        spreadsheetId 
      });

      // Prepare tasks data
      const tasksData: any[] = [];
      project.timelineData.milestones.forEach((milestone) => {
        milestone.tasks.forEach((task, taskIndex) => {
          tasksData.push([
            task.taskId,
            milestone.milestoneId,
            task.name,
            task.description,
            task.team,
            task.sprint || '',
            task.durationDays.toString(),
            Array.isArray(task.dependsOn) ? task.dependsOn.join(',') : '',
            task.startDate || '',
            task.endDate || '',
            taskIndex.toString(),
          ]);
        });
      });

      logger.logDataTransform('prepareTasks', tasksData.length, { 
        projectId: project.id, 
        spreadsheetId 
      });

      // Clear existing data first
      await logger.logApiCall('sheets.spreadsheets.values.batchClear', () =>
        gapi.client.sheets.spreadsheets.values.batchClear({
          spreadsheetId,
          resource: {
            ranges: ['ProjectInfo!A2:D1000', 'Milestones!A2:E1000', 'Tasks!A2:K1000'],
          },
        }), { 
          spreadsheetId, 
          operation: 'clearExistingData',
          ranges: 3
        }
      );

      // Write new data
      const requests = [
        {
          range: 'ProjectInfo!A2:D' + (projectInfoData.length + 1),
          values: projectInfoData,
        },
        {
          range: 'Milestones!A2:E' + (milestonesData.length + 1),
          values: milestonesData,
        },
        {
          range: 'Tasks!A2:K' + (tasksData.length + 1),
          values: tasksData,
        },
      ];

      await logger.logApiCall('sheets.spreadsheets.values.batchUpdate', () =>
        gapi.client.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          resource: {
            valueInputOption: 'RAW',
            data: requests,
          },
        }), { 
          spreadsheetId, 
          operation: 'saveProjectData',
          requestCount: requests.length,
          dataRows: projectInfoData.length + milestonesData.length + tasksData.length
        }
      );

      logger.info('Project saved to spreadsheet successfully', { 
        module: 'GoogleSheets', 
        action: 'saveProjectToSheet',
        spreadsheetId,
        projectId: project.id,
        projectName: project.name,
        dataSaved: {
          projectInfoRows: projectInfoData.length,
          milestoneRows: milestonesData.length,
          taskRows: tasksData.length
        }
      });
    } catch (error) {
      logger.error('Failed to save project to spreadsheet', error as Error, { 
        module: 'GoogleSheets', 
        action: 'saveProjectToSheet',
        spreadsheetId,
        projectId: project.id
      });
      throw new Error('Failed to save project to spreadsheet');
    }
  }

  async loadProjectFromSheet(spreadsheetId: string): Promise<Project> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    try {
      // Get all data from the spreadsheet
      const response = await gapi.client.sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: ['ProjectInfo!A2:D1000', 'Milestones!A2:E1000', 'Tasks!A2:K1000'],
      });

      const valueRanges = response.result.valueRanges || [];
      const projectInfoData = valueRanges[0]?.values || [];
      const milestonesData = valueRanges[1]?.values || [];
      const tasksData = valueRanges[2]?.values || [];

      // Parse project info
      const projectInfo = projectInfoData[0] || [];
      const projectName = projectInfo[0] || 'Untitled Project';
      const projectStartDate = projectInfo[1] || new Date().toISOString();
      const lastModified = projectInfo[2] ? parseInt(projectInfo[2]) : Date.now();
      const createdAt = projectInfo[3] ? parseInt(projectInfo[3]) : Date.now();

      // Parse milestones
      const milestones: Milestone[] = milestonesData.map((row: string[]) => ({
        milestoneId: row[0] || '',
        milestoneName: row[1] || '',
        startDate: row[2] || undefined,
        endDate: row[3] || undefined,
        tasks: [], // Will be populated below
      }));

      // Create milestone map for efficient lookup
      const milestoneMap = new Map<string, Milestone>();
      milestones.forEach((milestone) => {
        milestoneMap.set(milestone.milestoneId, milestone);
      });

      // Parse tasks and assign to milestones
      tasksData.forEach((row: string[]) => {
        const task: Task = {
          taskId: row[0] || '',
          name: row[2] || '',
          description: row[3] || '',
          team: row[4] || '',
          sprint: row[5] || undefined,
          durationDays: parseInt(row[6]) || 1,
          dependsOn: row[7] ? row[7].split(',').filter((dep: string) => dep.trim()) : [],
          startDate: row[8] || undefined,
          endDate: row[9] || undefined,
        };

        const milestoneId = row[1];
        const milestone = milestoneMap.get(milestoneId);
        if (milestone) {
          milestone.tasks.push(task);
        }
      });

      // Parse milestone order
      const milestoneOrder = milestonesData
        .map((row: string[], index: number) => ({
          id: row[0],
          order: parseInt(row[4]) || index,
        }))
        .sort((a, b) => a.order - b.order)
        .map((item) => item.id);

      const timelineData: TimelineData = {
        milestones: milestones.filter((m) => m.milestoneId), // Remove any empty milestones
        projectStartDate,
        expandedMilestones: [],
        milestoneOrder,
      };

      const project: Project = {
        id: `sheets_${spreadsheetId}`,
        name: projectName,
        createdAt,
        lastModified,
        timelineData,
      };

      return project;
    } catch (error) {
      console.error('Error loading project from sheet:', error);
      throw new Error('Failed to load project from spreadsheet');
    }
  }

  async listSpreadsheets(): Promise<SpreadsheetInfo[]> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await gapi.client.drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        fields: 'files(id, name, webViewLink)',
        orderBy: 'modifiedTime desc',
      });

      const files = response.result.files || [];
      return files.map((file: any) => ({
        id: file.id!,
        name: file.name!,
        url: file.webViewLink!,
      }));
    } catch (error) {
      console.error('Error listing spreadsheets:', error);
      throw new Error('Failed to list spreadsheets');
    }
  }

  async getSpreadsheetInfo(spreadsheetId: string): Promise<SpreadsheetInfo> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await gapi.client.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'properties(title),spreadsheetUrl',
      });

      const spreadsheet = response.result;
      return {
        id: spreadsheetId,
        name: spreadsheet.properties?.title || 'Untitled',
        url: spreadsheet.spreadsheetUrl || '',
      };
    } catch (error) {
      console.error('Error getting spreadsheet info:', error);
      throw new Error('Failed to get spreadsheet information');
    }
  }

  disconnect(): void {
    this.signOut();
  }
}

// Export singleton instance
export const googleSheetsService = GoogleSheetsService.getInstance();