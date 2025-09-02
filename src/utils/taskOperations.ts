import { Milestone, Task } from './dateUtils';
import {
  ChangeHistoryEntry,
  ChangeHistoryOptions,
  logTaskAddition,
  logTaskRemoval,
  logTaskMove,
  detectTaskChanges,
} from './changeHistory';

export interface CloneOptions {
  targetMilestoneId: string;
  includeDependencies: boolean;
  newTaskName?: string;
}

export interface SplitConfig {
  splits: {
    name: string;
    duration: number;
  }[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Generates a unique task ID that doesn't exist in the current milestones
 */
export function generateUniqueTaskId(milestones: Milestone[]): string {
  const existingIds = new Set<string>();

  // Collect all existing task IDs
  milestones.forEach(milestone => {
    milestone.tasks.forEach(task => {
      existingIds.add(task.taskId);
    });
  });

  // Generate unique ID with format: T{timestamp}_{random}
  let attempts = 0;
  let newId: string;

  do {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 4);
    newId = `T${timestamp}_${random}`;
    attempts++;

    // Fallback in case of collision
    if (attempts > 100) {
      newId = `T${timestamp}_${attempts}`;
      break;
    }
  } while (existingIds.has(newId));

  return newId;
}

/**
 * Creates a clone of a task with a new unique ID
 */
export function cloneTask(
  task: Task,
  milestones: Milestone[],
  options: CloneOptions
): Task {
  const newTaskId = generateUniqueTaskId(milestones);
  const taskName = options.newTaskName || `${task.name} (Copy)`;

  const clonedTask: Task = {
    ...task,
    taskId: newTaskId,
    name: taskName,
    dependsOn: options.includeDependencies ? [...task.dependsOn] : [],
    // Reset dates - they'll be recalculated
    startDate: undefined,
    endDate: undefined,
  };

  return clonedTask;
}

/**
 * Adds a cloned task to the specified milestone
 */
export function addClonedTaskToMilestone(
  milestones: Milestone[],
  clonedTask: Task,
  targetMilestoneId: string
): Milestone[] {
  return milestones.map(milestone => {
    if (milestone.milestoneId === targetMilestoneId) {
      return {
        ...milestone,
        tasks: [...milestone.tasks, clonedTask],
      };
    }
    return milestone;
  });
}

/**
 * Splits a task into multiple tasks with distributed duration
 */
export function splitTask(
  task: Task,
  milestones: Milestone[],
  splitConfig: SplitConfig
): Task[] {
  if (splitConfig.splits.length === 0) {
    return [task];
  }

  const splitTasks: Task[] = [];
  let previousTaskId: string | null = null;

  splitConfig.splits.forEach((split, index) => {
    const newTaskId = generateUniqueTaskId([
      ...milestones,
      // Include already created split tasks to avoid ID collisions
      { milestoneId: 'temp', milestoneName: 'temp', tasks: splitTasks },
    ]);

    const splitTask: Task = {
      ...task,
      taskId: newTaskId,
      name: split.name,
      durationDays: split.duration,
      // First split task gets original dependencies
      dependsOn:
        index === 0
          ? [...task.dependsOn]
          : previousTaskId
            ? [previousTaskId]
            : [],
      // Reset dates - they'll be recalculated
      startDate: undefined,
      endDate: undefined,
    };

    splitTasks.push(splitTask);
    previousTaskId = newTaskId;
  });

  return splitTasks;
}

/**
 * Moves a task from one milestone to another
 */
export function moveTaskBetweenMilestones(
  milestones: Milestone[],
  taskId: string,
  fromMilestoneId: string,
  toMilestoneId: string
): Milestone[] {
  let taskToMove: Task | null = null;

  // Find and remove the task from source milestone
  const milestonesAfterRemoval = milestones.map(milestone => {
    if (milestone.milestoneId === fromMilestoneId) {
      const taskIndex = milestone.tasks.findIndex(
        task => task.taskId === taskId
      );
      if (taskIndex !== -1) {
        taskToMove = milestone.tasks[taskIndex];
        return {
          ...milestone,
          tasks: milestone.tasks.filter(task => task.taskId !== taskId),
        };
      }
    }
    return milestone;
  });

  if (!taskToMove) {
    // Task not found, return original milestones
    return milestones;
  }

  // Add the task to target milestone
  return milestonesAfterRemoval.map(milestone => {
    if (milestone.milestoneId === toMilestoneId) {
      return {
        ...milestone,
        tasks: [...milestone.tasks, taskToMove!],
      };
    }
    return milestone;
  });
}

/**
 * Validates that all task dependencies exist and no circular dependencies exist
 */
export function validateDependencies(
  milestones: Milestone[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Create a map of all task IDs
  const allTasks = new Map<string, Task>();
  const taskToMilestone = new Map<string, string>();

  milestones.forEach(milestone => {
    milestone.tasks.forEach(task => {
      allTasks.set(task.taskId, task);
      taskToMilestone.set(task.taskId, milestone.milestoneId);
    });
  });

  // Check for missing dependencies
  milestones.forEach(milestone => {
    milestone.tasks.forEach(task => {
      task.dependsOn.forEach(depId => {
        if (!allTasks.has(depId)) {
          errors.push(
            `Task "${task.name}" (${task.taskId}) depends on non-existent task ${depId}`
          );
        } else {
          // Check for cross-milestone dependencies
          const depMilestone = taskToMilestone.get(depId);
          if (depMilestone && depMilestone !== milestone.milestoneId) {
            warnings.push(
              `Task "${task.name}" depends on task in different milestone`
            );
          }
        }
      });
    });
  });

  // Check for circular dependencies using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(taskId: string): boolean {
    if (recursionStack.has(taskId)) {
      return true; // Circular dependency found
    }

    if (visited.has(taskId)) {
      return false;
    }

    visited.add(taskId);
    recursionStack.add(taskId);

    const task = allTasks.get(taskId);
    if (task) {
      for (const depId of task.dependsOn) {
        if (allTasks.has(depId) && hasCycle(depId)) {
          return true;
        }
      }
    }

    recursionStack.delete(taskId);
    return false;
  }

  // Check for cycles starting from each task
  for (const [taskId] of allTasks) {
    if (!visited.has(taskId) && hasCycle(taskId)) {
      errors.push(`Circular dependency detected involving task ${taskId}`);
      break; // One circular dependency error is enough
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Updates dependencies when tasks are split or moved
 * If originalTaskId was split into multiple tasks, updates dependents to depend on the last split task
 */
export function updateDependenciesAfterSplit(
  milestones: Milestone[],
  originalTaskId: string,
  splitTasks: Task[]
): Milestone[] {
  if (splitTasks.length === 0) {
    return milestones;
  }

  const lastSplitTaskId = splitTasks[splitTasks.length - 1].taskId;

  return milestones.map(milestone => ({
    ...milestone,
    tasks: milestone.tasks.map(task => ({
      ...task,
      dependsOn: task.dependsOn.map(depId =>
        depId === originalTaskId ? lastSplitTaskId : depId
      ),
    })),
  }));
}

// ============== CHANGE-TRACKING ENHANCED FUNCTIONS ==============

/**
 * Result type for operations that include change tracking
 */
export interface TaskOperationResult {
  milestones: Milestone[];
  changes: ChangeHistoryEntry[];
}

/**
 * Clones a task with change tracking
 */
export function cloneTaskWithTracking(
  milestones: Milestone[],
  task: Task,
  options: CloneOptions,
  historyOptions: ChangeHistoryOptions = {}
): TaskOperationResult {
  const newMilestones = addClonedTaskToMilestone(
    milestones,
    cloneTask(task, milestones, options),
    options.targetMilestoneId
  );

  const targetMilestone = milestones.find(
    m => m.milestoneId === options.targetMilestoneId
  );
  const clonedTask = newMilestones
    .find(m => m.milestoneId === options.targetMilestoneId)
    ?.tasks.find(
      t => t.name === (options.newTaskName || `${task.name} (Copy)`)
    );

  const changes: ChangeHistoryEntry[] = [];
  if (clonedTask && targetMilestone) {
    changes.push(
      logTaskAddition(
        clonedTask,
        options.targetMilestoneId,
        targetMilestone.milestoneName,
        historyOptions
      )
    );
  }

  return {
    milestones: newMilestones,
    changes,
  };
}

/**
 * Splits a task with change tracking
 */
export function splitTaskWithTracking(
  milestones: Milestone[],
  task: Task,
  splitConfig: SplitConfig,
  historyOptions: ChangeHistoryOptions = {}
): TaskOperationResult {
  const splitTasks = splitTask(task, milestones, splitConfig);

  // Find which milestone the original task belongs to
  let originalMilestone: Milestone | undefined;
  for (const milestone of milestones) {
    if (milestone.tasks.some(t => t.taskId === task.taskId)) {
      originalMilestone = milestone;
      break;
    }
  }

  if (!originalMilestone) {
    return { milestones, changes: [] };
  }

  // Remove original task and add split tasks
  let newMilestones = milestones.map(milestone => {
    if (milestone.milestoneId === originalMilestone!.milestoneId) {
      return {
        ...milestone,
        tasks: [
          ...milestone.tasks.filter(t => t.taskId !== task.taskId),
          ...splitTasks,
        ],
      };
    }
    return milestone;
  });

  // Update dependencies
  newMilestones = updateDependenciesAfterSplit(
    newMilestones,
    task.taskId,
    splitTasks
  );

  // Log changes
  const changes: ChangeHistoryEntry[] = [];

  // Log removal of original task
  changes.push(
    logTaskRemoval(
      task,
      originalMilestone.milestoneId,
      originalMilestone.milestoneName,
      historyOptions
    )
  );

  // Log addition of split tasks
  splitTasks.forEach(splitTask => {
    changes.push(
      logTaskAddition(
        splitTask,
        originalMilestone!.milestoneId,
        originalMilestone!.milestoneName,
        historyOptions
      )
    );
  });

  return {
    milestones: newMilestones,
    changes,
  };
}

/**
 * Moves a task between milestones with change tracking
 */
export function moveTaskBetweenMilestonesWithTracking(
  milestones: Milestone[],
  taskId: string,
  fromMilestoneId: string,
  toMilestoneId: string,
  historyOptions: ChangeHistoryOptions = {}
): TaskOperationResult {
  const fromMilestone = milestones.find(m => m.milestoneId === fromMilestoneId);
  const toMilestone = milestones.find(m => m.milestoneId === toMilestoneId);
  const taskToMove = fromMilestone?.tasks.find(t => t.taskId === taskId);

  if (!taskToMove || !fromMilestone || !toMilestone) {
    return { milestones, changes: [] };
  }

  const newMilestones = moveTaskBetweenMilestones(
    milestones,
    taskId,
    fromMilestoneId,
    toMilestoneId
  );

  const changes: ChangeHistoryEntry[] = [];
  changes.push(
    logTaskMove(
      taskToMove,
      fromMilestoneId,
      fromMilestone.milestoneName,
      toMilestoneId,
      toMilestone.milestoneName,
      historyOptions
    )
  );

  return {
    milestones: newMilestones,
    changes,
  };
}

/**
 * Updates a task with change tracking
 */
export function updateTaskWithTracking(
  milestones: Milestone[],
  taskId: string,
  updates: Partial<Task>,
  historyOptions: ChangeHistoryOptions = {}
): TaskOperationResult {
  console.log('⚙️ updateTaskWithTracking called:', { taskId, updates });
  console.log('⚙️ Milestones received:', milestones.length);

  let originalTask: Task | undefined;
  let milestoneId: string | undefined;

  // Find the original task and its milestone
  for (const milestone of milestones) {
    const task = milestone.tasks.find(t => t.taskId === taskId);
    if (task) {
      originalTask = task;
      milestoneId = milestone.milestoneId;
      console.log(
        '⚙️ Found original task in milestone:',
        milestone.milestoneName
      );
      break;
    }
  }

  if (!originalTask || !milestoneId) {
    console.log('⚙️ Task not found or no milestone ID');
    return { milestones, changes: [] };
  }

  const updatedTask = { ...originalTask, ...updates };

  // Update milestones
  const newMilestones = milestones.map(milestone => {
    if (milestone.milestoneId === milestoneId) {
      return {
        ...milestone,
        tasks: milestone.tasks.map(task =>
          task.taskId === taskId ? updatedTask : task
        ),
      };
    }
    return milestone;
  });
  console.log('⚙️ Updated milestones length:', newMilestones.length);

  // Detect changes
  const changes = detectTaskChanges(
    originalTask,
    updatedTask,
    milestoneId,
    historyOptions
  );
  console.log('⚙️ Detected changes:', changes.length);
  console.log(
    '⚙️ Change types:',
    changes.map(c => c.changeType)
  );

  return {
    milestones: newMilestones,
    changes,
  };
}

/**
 * Adds a new task with change tracking
 */
export function addTaskWithTracking(
  milestones: Milestone[],
  milestoneId: string,
  task: Task,
  historyOptions: ChangeHistoryOptions = {}
): TaskOperationResult {
  const milestone = milestones.find(m => m.milestoneId === milestoneId);
  if (!milestone) {
    return { milestones, changes: [] };
  }

  const newMilestones = milestones.map(m => {
    if (m.milestoneId === milestoneId) {
      return {
        ...m,
        tasks: [...m.tasks, task],
      };
    }
    return m;
  });

  const changes: ChangeHistoryEntry[] = [];
  changes.push(
    logTaskAddition(task, milestoneId, milestone.milestoneName, historyOptions)
  );

  return {
    milestones: newMilestones,
    changes,
  };
}

/**
 * Removes a task with change tracking
 */
export function removeTaskWithTracking(
  milestones: Milestone[],
  taskId: string,
  historyOptions: ChangeHistoryOptions = {}
): TaskOperationResult {
  let taskToRemove: Task | undefined;
  let sourceMilestone: Milestone | undefined;

  // Find the task and its milestone
  for (const milestone of milestones) {
    const task = milestone.tasks.find(t => t.taskId === taskId);
    if (task) {
      taskToRemove = task;
      sourceMilestone = milestone;
      break;
    }
  }

  if (!taskToRemove || !sourceMilestone) {
    return { milestones, changes: [] };
  }

  const newMilestones = milestones.map(milestone => {
    if (milestone.milestoneId === sourceMilestone!.milestoneId) {
      return {
        ...milestone,
        tasks: milestone.tasks.filter(t => t.taskId !== taskId),
      };
    }
    return milestone;
  });

  const changes: ChangeHistoryEntry[] = [];
  changes.push(
    logTaskRemoval(
      taskToRemove,
      sourceMilestone.milestoneId,
      sourceMilestone.milestoneName,
      historyOptions
    )
  );

  return {
    milestones: newMilestones,
    changes,
  };
}
