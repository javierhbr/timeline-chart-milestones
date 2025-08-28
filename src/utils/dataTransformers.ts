import { Milestone, Task } from './dateUtils';
import { Project, TimelineData } from './projectStorage';

export interface SpreadsheetRow {
  [key: string]: string | number | boolean;
}

export interface ProjectInfoRow {
  projectName: string;
  projectStartDate: string;
  lastModified: number;
  createdAt: number;
}

export interface MilestoneRow {
  milestoneId: string;
  milestoneName: string;
  startDate: string;
  endDate: string;
  orderIndex: number;
}

export interface TaskRow {
  taskId: string;
  milestoneId: string;
  name: string;
  description: string;
  team: string;
  sprint: string;
  durationDays: number;
  dependsOn: string;
  startDate: string;
  endDate: string;
  orderIndex: number;
}

export class DataTransformers {
  /**
   * Transform Project to spreadsheet rows
   */
  static projectToSpreadsheetData(project: Project): {
    projectInfo: ProjectInfoRow;
    milestones: MilestoneRow[];
    tasks: TaskRow[];
  } {
    const projectInfo: ProjectInfoRow = {
      projectName: project.name,
      projectStartDate: project.timelineData.projectStartDate,
      lastModified: project.lastModified,
      createdAt: project.createdAt,
    };

    const milestones: MilestoneRow[] = project.timelineData.milestones.map((milestone, index) => ({
      milestoneId: milestone.milestoneId,
      milestoneName: milestone.milestoneName,
      startDate: milestone.startDate || '',
      endDate: milestone.endDate || '',
      orderIndex: project.timelineData.milestoneOrder?.indexOf(milestone.milestoneId) ?? index,
    }));

    const tasks: TaskRow[] = [];
    project.timelineData.milestones.forEach((milestone) => {
      milestone.tasks.forEach((task, taskIndex) => {
        tasks.push({
          taskId: task.taskId,
          milestoneId: milestone.milestoneId,
          name: task.name,
          description: task.description,
          team: task.team,
          sprint: task.sprint || '',
          durationDays: task.durationDays,
          dependsOn: Array.isArray(task.dependsOn) ? task.dependsOn.join(',') : '',
          startDate: task.startDate || '',
          endDate: task.endDate || '',
          orderIndex: taskIndex,
        });
      });
    });

    return { projectInfo, milestones, tasks };
  }

  /**
   * Transform spreadsheet rows to Project
   */
  static spreadsheetDataToProject(
    spreadsheetId: string,
    projectInfo: ProjectInfoRow,
    milestoneRows: MilestoneRow[],
    taskRows: TaskRow[]
  ): Project {
    // Create milestone map
    const milestoneMap = new Map<string, Milestone>();
    
    // Sort milestones by order index
    const sortedMilestones = [...milestoneRows].sort((a, b) => a.orderIndex - b.orderIndex);
    
    sortedMilestones.forEach((row) => {
      const milestone: Milestone = {
        milestoneId: row.milestoneId,
        milestoneName: row.milestoneName,
        startDate: row.startDate || undefined,
        endDate: row.endDate || undefined,
        tasks: [],
      };
      milestoneMap.set(row.milestoneId, milestone);
    });

    // Sort tasks by milestone and order index, then assign to milestones
    const sortedTasks = [...taskRows].sort((a, b) => {
      if (a.milestoneId !== b.milestoneId) {
        // Sort by milestone order first
        const milestoneAOrder = milestoneRows.find(m => m.milestoneId === a.milestoneId)?.orderIndex ?? 0;
        const milestoneBOrder = milestoneRows.find(m => m.milestoneId === b.milestoneId)?.orderIndex ?? 0;
        return milestoneAOrder - milestoneBOrder;
      }
      // Then by task order within milestone
      return a.orderIndex - b.orderIndex;
    });

    sortedTasks.forEach((row) => {
      const task: Task = {
        taskId: row.taskId,
        name: row.name,
        description: row.description,
        team: row.team,
        sprint: row.sprint || undefined,
        durationDays: row.durationDays,
        dependsOn: row.dependsOn ? row.dependsOn.split(',').map(dep => dep.trim()).filter(dep => dep) : [],
        startDate: row.startDate || undefined,
        endDate: row.endDate || undefined,
      };

      const milestone = milestoneMap.get(row.milestoneId);
      if (milestone) {
        milestone.tasks.push(task);
      }
    });

    // Create milestone order array
    const milestoneOrder = sortedMilestones.map((row) => row.milestoneId);

    const timelineData: TimelineData = {
      milestones: Array.from(milestoneMap.values()),
      projectStartDate: projectInfo.projectStartDate,
      expandedMilestones: [],
      milestoneOrder,
    };

    const project: Project = {
      id: `sheets_${spreadsheetId}`,
      name: projectInfo.projectName,
      createdAt: projectInfo.createdAt,
      lastModified: projectInfo.lastModified,
      timelineData,
    };

    return project;
  }

  /**
   * Transform spreadsheet values to typed rows
   */
  static rawValuesToProjectInfo(values: any[][]): ProjectInfoRow | null {
    if (!values || values.length === 0 || !values[0]) {
      return null;
    }

    const row = values[0];
    return {
      projectName: row[0] || 'Untitled Project',
      projectStartDate: row[1] || new Date().toISOString(),
      lastModified: row[2] ? parseInt(row[2]) : Date.now(),
      createdAt: row[3] ? parseInt(row[3]) : Date.now(),
    };
  }

  static rawValuesToMilestones(values: any[][]): MilestoneRow[] {
    if (!values || values.length === 0) {
      return [];
    }

    return values.map((row, index) => ({
      milestoneId: row[0] || `milestone_${index}`,
      milestoneName: row[1] || `Milestone ${index + 1}`,
      startDate: row[2] || '',
      endDate: row[3] || '',
      orderIndex: row[4] !== undefined ? parseInt(row[4]) : index,
    }));
  }

  static rawValuesToTasks(values: any[][]): TaskRow[] {
    if (!values || values.length === 0) {
      return [];
    }

    return values.map((row, index) => ({
      taskId: row[0] || `task_${index}`,
      milestoneId: row[1] || '',
      name: row[2] || `Task ${index + 1}`,
      description: row[3] || '',
      team: row[4] || '',
      sprint: row[5] || '',
      durationDays: row[6] ? parseInt(row[6]) : 1,
      dependsOn: row[7] || '',
      startDate: row[8] || '',
      endDate: row[9] || '',
      orderIndex: row[10] !== undefined ? parseInt(row[10]) : index,
    }));
  }

  /**
   * Transform typed rows to spreadsheet values
   */
  static projectInfoToRawValues(projectInfo: ProjectInfoRow): any[][] {
    return [[
      projectInfo.projectName,
      projectInfo.projectStartDate,
      projectInfo.lastModified,
      projectInfo.createdAt,
    ]];
  }

  static milestonesToRawValues(milestones: MilestoneRow[]): any[][] {
    return milestones.map((milestone) => [
      milestone.milestoneId,
      milestone.milestoneName,
      milestone.startDate,
      milestone.endDate,
      milestone.orderIndex,
    ]);
  }

  static tasksToRawValues(tasks: TaskRow[]): any[][] {
    return tasks.map((task) => [
      task.taskId,
      task.milestoneId,
      task.name,
      task.description,
      task.team,
      task.sprint,
      task.durationDays,
      task.dependsOn,
      task.startDate,
      task.endDate,
      task.orderIndex,
    ]);
  }

  /**
   * Validate spreadsheet data structure
   */
  static validateSpreadsheetData(
    projectInfo: ProjectInfoRow | null,
    milestones: MilestoneRow[],
    tasks: TaskRow[]
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate project info
    if (!projectInfo) {
      errors.push('Project information is missing');
    } else {
      if (!projectInfo.projectName || projectInfo.projectName.trim() === '') {
        errors.push('Project name is required');
      }
      if (!projectInfo.projectStartDate) {
        errors.push('Project start date is required');
      }
    }

    // Validate milestones
    const milestoneIds = new Set<string>();
    milestones.forEach((milestone, index) => {
      if (!milestone.milestoneId || milestone.milestoneId.trim() === '') {
        errors.push(`Milestone at row ${index + 1} is missing ID`);
      } else if (milestoneIds.has(milestone.milestoneId)) {
        errors.push(`Duplicate milestone ID: ${milestone.milestoneId}`);
      } else {
        milestoneIds.add(milestone.milestoneId);
      }

      if (!milestone.milestoneName || milestone.milestoneName.trim() === '') {
        errors.push(`Milestone ${milestone.milestoneId} is missing name`);
      }
    });

    // Validate tasks
    const taskIds = new Set<string>();
    tasks.forEach((task, index) => {
      if (!task.taskId || task.taskId.trim() === '') {
        errors.push(`Task at row ${index + 1} is missing ID`);
      } else if (taskIds.has(task.taskId)) {
        errors.push(`Duplicate task ID: ${task.taskId}`);
      } else {
        taskIds.add(task.taskId);
      }

      if (!task.milestoneId || !milestoneIds.has(task.milestoneId)) {
        errors.push(`Task ${task.taskId} references invalid milestone: ${task.milestoneId}`);
      }

      if (!task.name || task.name.trim() === '') {
        errors.push(`Task ${task.taskId} is missing name`);
      }

      if (task.durationDays <= 0) {
        errors.push(`Task ${task.taskId} must have positive duration`);
      }

      // Validate dependencies
      if (task.dependsOn) {
        const dependencies = task.dependsOn.split(',').map(dep => dep.trim()).filter(dep => dep);
        dependencies.forEach((depId) => {
          if (!taskIds.has(depId) && !tasks.some(t => t.taskId === depId)) {
            errors.push(`Task ${task.taskId} depends on non-existent task: ${depId}`);
          }
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate headers for spreadsheet initialization
   */
  static getSpreadsheetHeaders(): {
    projectInfo: string[];
    milestones: string[];
    tasks: string[];
  } {
    return {
      projectInfo: ['projectName', 'projectStartDate', 'lastModified', 'createdAt'],
      milestones: ['milestoneId', 'milestoneName', 'startDate', 'endDate', 'orderIndex'],
      tasks: [
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
    };
  }
}

// Utility functions for common transformations
export const transformProjectForSheets = (project: Project) => {
  return DataTransformers.projectToSpreadsheetData(project);
};

export const transformSheetsToProject = (
  spreadsheetId: string,
  projectInfoValues: any[][],
  milestoneValues: any[][],
  taskValues: any[][]
): Project | null => {
  const projectInfo = DataTransformers.rawValuesToProjectInfo(projectInfoValues);
  if (!projectInfo) {
    return null;
  }

  const milestones = DataTransformers.rawValuesToMilestones(milestoneValues);
  const tasks = DataTransformers.rawValuesToTasks(taskValues);

  // Validate data
  const validation = DataTransformers.validateSpreadsheetData(projectInfo, milestones, tasks);
  if (!validation.isValid) {
    console.warn('Spreadsheet data validation errors:', validation.errors);
    // You might want to handle these errors differently
  }

  return DataTransformers.spreadsheetDataToProject(spreadsheetId, projectInfo, milestones, tasks);
};