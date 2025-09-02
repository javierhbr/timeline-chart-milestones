import { Milestone, Task } from './dateUtils';

export type ChangeType =
  | 'name'
  | 'duration'
  | 'dependency'
  | 'add'
  | 'remove'
  | 'description'
  | 'team'
  | 'status'
  | 'milestone_name'
  | 'task_move';

export type EntityType = 'task' | 'milestone';

export interface ChangeHistoryEntry {
  entryId: string;
  timestamp: number;
  entityType: EntityType;
  entityId: string;
  changeType: ChangeType;
  oldValue: unknown;
  newValue: unknown;
  user?: string;
  // Additional context for complex operations
  context?: {
    milestoneId?: string;
    targetMilestoneId?: string; // for moves
    taskName?: string;
    milestoneName?: string;
  };
}

export interface ChangeHistoryOptions {
  user?: string;
  context?: ChangeHistoryEntry['context'];
}

/**
 * Generates a unique ID for a change history entry
 */
export function generateChangeEntryId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `CH${timestamp}_${random}`;
}

/**
 * Creates a new change history entry
 */
export function createChangeEntry(
  entityType: EntityType,
  entityId: string,
  changeType: ChangeType,
  oldValue: unknown,
  newValue: unknown,
  options: ChangeHistoryOptions = {}
): ChangeHistoryEntry {
  return {
    entryId: generateChangeEntryId(),
    timestamp: Date.now(),
    entityType,
    entityId,
    changeType,
    oldValue,
    newValue,
    user: options.user,
    context: options.context,
  };
}

/**
 * Logs a change to the project's change history
 */
export function logChange(
  currentHistory: ChangeHistoryEntry[],
  entityType: EntityType,
  entityId: string,
  changeType: ChangeType,
  oldValue: unknown,
  newValue: unknown,
  options: ChangeHistoryOptions = {}
): ChangeHistoryEntry[] {
  const entry = createChangeEntry(
    entityType,
    entityId,
    changeType,
    oldValue,
    newValue,
    options
  );

  return [...currentHistory, entry];
}

/**
 * Generates a human-readable description of a change
 */
export function generateChangeDescription(entry: ChangeHistoryEntry): string {
  const { entityType, changeType, oldValue, newValue, context } = entry;

  const entityName =
    context?.taskName ||
    context?.milestoneName ||
    `${entityType} ${entry.entityId}`;

  switch (changeType) {
    case 'add':
      return `Added ${entityType} "${entityName}"`;

    case 'remove':
      return `Removed ${entityType} "${entityName}"`;

    case 'name':
    case 'milestone_name':
      return `${entityType === 'task' ? 'Task' : 'Milestone'} "${oldValue}" renamed to "${newValue}"`;

    case 'description': {
      const oldDesc = oldValue ? `"${String(oldValue).substring(0, 30)}..."` : 'empty';
      const newDesc = newValue ? `"${String(newValue).substring(0, 30)}..."` : 'empty';
      return `Task "${entityName}" description changed from ${oldDesc} to ${newDesc}`;
    }

    case 'duration':
      return `Task "${entityName}" duration changed from ${oldValue} to ${newValue} days`;

    case 'team':
      return `Task "${entityName}" team changed from "${oldValue}" to "${newValue}"`;

    case 'dependency':
      if (Array.isArray(oldValue) && Array.isArray(newValue)) {
        const added = newValue.filter((dep: string) => !oldValue.includes(dep));
        const removed = oldValue.filter(
          (dep: string) => !newValue.includes(dep)
        );

        if (added.length > 0 && removed.length > 0) {
          return `Task "${entityName}" dependencies modified`;
        } else if (added.length > 0) {
          return `Task "${entityName}" added ${added.length} dependency(ies)`;
        } else if (removed.length > 0) {
          return `Task "${entityName}" removed ${removed.length} dependency(ies)`;
        }
      }
      return `Task "${entityName}" dependencies modified`;

    case 'task_move': {
      const fromMilestone = context?.milestoneName || 'unknown milestone';
      const toMilestone = String(newValue) || 'unknown milestone';
      return `Task "${entityName}" moved from "${fromMilestone}" to "${toMilestone}"`;
    }

    case 'status':
      return `Task "${entityName}" status changed from "${oldValue}" to "${newValue}"`;

    default:
      return `${entityType} "${entityName}" ${changeType} changed`;
  }
}

/**
 * Reconstructs the project state at a specific point in history
 */
export function reconstructStateAtChange(
  _initialMilestones: Milestone[],
  history: ChangeHistoryEntry[],
  targetChangeIndex: number
): Milestone[] {
  // Start with initial empty state and apply changes up to target index
  let currentState: Milestone[] = [];

  for (let i = 0; i <= targetChangeIndex; i++) {
    const change = history[i];
    currentState = applyChangeToState(currentState, change);
  }

  return currentState;
}

/**
 * Applies a single change to the milestone state
 */
function applyChangeToState(
  milestones: Milestone[],
  change: ChangeHistoryEntry
): Milestone[] {
  const { entityType, entityId, changeType, newValue, context } = change;

  switch (changeType) {
    case 'add':
      if (entityType === 'milestone') {
        return [...milestones, newValue as Milestone];
      } else if (entityType === 'task' && context?.milestoneId) {
        return milestones.map(milestone =>
          milestone.milestoneId === context.milestoneId
            ? { ...milestone, tasks: [...milestone.tasks, newValue as Task] }
            : milestone
        );
      }
      break;

    case 'remove':
      if (entityType === 'milestone') {
        return milestones.filter(
          milestone => milestone.milestoneId !== entityId
        );
      } else if (entityType === 'task') {
        return milestones.map(milestone => ({
          ...milestone,
          tasks: milestone.tasks.filter(task => task.taskId !== entityId),
        }));
      }
      break;

    case 'name':
      if (entityType === 'task') {
        return milestones.map(milestone => ({
          ...milestone,
          tasks: milestone.tasks.map(task =>
            task.taskId === entityId ? { ...task, name: newValue as string } : task
          ),
        }));
      }
      break;

    case 'milestone_name':
      if (entityType === 'milestone') {
        return milestones.map(milestone =>
          milestone.milestoneId === entityId
            ? { ...milestone, milestoneName: newValue as string }
            : milestone
        );
      }
      break;

    case 'description':
      if (entityType === 'task') {
        return milestones.map(milestone => ({
          ...milestone,
          tasks: milestone.tasks.map(task =>
            task.taskId === entityId ? { ...task, description: newValue as string } : task
          ),
        }));
      }
      break;

    case 'duration':
      if (entityType === 'task') {
        return milestones.map(milestone => ({
          ...milestone,
          tasks: milestone.tasks.map(task =>
            task.taskId === entityId
              ? { ...task, durationDays: newValue as number }
              : task
          ),
        }));
      }
      break;

    case 'team':
      if (entityType === 'task') {
        return milestones.map(milestone => ({
          ...milestone,
          tasks: milestone.tasks.map(task =>
            task.taskId === entityId ? { ...task, team: newValue as string } : task
          ),
        }));
      }
      break;

    case 'dependency':
      if (entityType === 'task') {
        return milestones.map(milestone => ({
          ...milestone,
          tasks: milestone.tasks.map(task =>
            task.taskId === entityId ? { ...task, dependsOn: newValue as string[] } : task
          ),
        }));
      }
      break;

    case 'task_move':
      if (entityType === 'task' && context?.targetMilestoneId) {
        let taskToMove: Task | null = null;

        // Remove task from old milestone
        const milestonesAfterRemoval = milestones.map(milestone => {
          const taskIndex = milestone.tasks.findIndex(
            task => task.taskId === entityId
          );
          if (taskIndex !== -1) {
            taskToMove = milestone.tasks[taskIndex];
            return {
              ...milestone,
              tasks: milestone.tasks.filter(task => task.taskId !== entityId),
            };
          }
          return milestone;
        });

        // Add task to new milestone
        if (taskToMove) {
          return milestonesAfterRemoval.map(milestone =>
            milestone.milestoneId === context.targetMilestoneId
              ? { ...milestone, tasks: [...milestone.tasks, taskToMove!] }
              : milestone
          );
        }
      }
      break;
  }

  return milestones;
}

/**
 * Rolls back the project state to a specific change entry index
 */
export function rollbackToChange(
  _currentMilestones: Milestone[],
  history: ChangeHistoryEntry[],
  targetChangeIndex: number
): {
  newMilestones: Milestone[];
  newHistory: ChangeHistoryEntry[];
} {
  // Reconstruct state at target change
  const newMilestones = reconstructStateAtChange(
    [], // Start from empty state
    history,
    targetChangeIndex
  );

  // Truncate history to target index
  const newHistory = history.slice(0, targetChangeIndex + 1);

  return {
    newMilestones,
    newHistory,
  };
}

/**
 * Utility function to get the name of an entity for display purposes
 */
export function getEntityDisplayName(
  entityType: EntityType,
  entityId: string,
  milestones: Milestone[]
): string {
  if (entityType === 'milestone') {
    const milestone = milestones.find(m => m.milestoneId === entityId);
    return milestone?.milestoneName || entityId;
  } else {
    for (const milestone of milestones) {
      const task = milestone.tasks.find(t => t.taskId === entityId);
      if (task) {
        return task.name;
      }
    }
    return entityId;
  }
}

/**
 * Groups history entries by date for better display
 */
export function groupHistoryByDate(history: ChangeHistoryEntry[]): {
  [date: string]: ChangeHistoryEntry[];
} {
  const groups: { [date: string]: ChangeHistoryEntry[] } = {};

  history.forEach(entry => {
    const date = new Date(entry.timestamp).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(entry);
  });

  return groups;
}

/**
 * Gets history entries filtered by entity type or specific entity
 */
export function getFilteredHistory(
  history: ChangeHistoryEntry[],
  filters: {
    entityType?: EntityType;
    entityId?: string;
    changeType?: ChangeType;
  } = {}
): ChangeHistoryEntry[] {
  return history.filter(entry => {
    if (filters.entityType && entry.entityType !== filters.entityType) {
      return false;
    }
    if (filters.entityId && entry.entityId !== filters.entityId) {
      return false;
    }
    if (filters.changeType && entry.changeType !== filters.changeType) {
      return false;
    }
    return true;
  });
}

/**
 * Higher-order function that wraps milestone state updates with change tracking
 */
export function withChangeTracking<T extends unknown[]>(
  updateFunction: (milestones: Milestone[], ...args: T) => Milestone[],
  changeDetector: (
    oldMilestones: Milestone[],
    newMilestones: Milestone[],
    ...args: T
  ) => ChangeHistoryEntry[]
) {
  return (
    milestones: Milestone[],
    currentHistory: ChangeHistoryEntry[],
    ...args: T
  ): { milestones: Milestone[]; history: ChangeHistoryEntry[] } => {
    const oldMilestones = milestones;
    const newMilestones = updateFunction(oldMilestones, ...args);
    const changes = changeDetector(oldMilestones, newMilestones, ...args);

    return {
      milestones: newMilestones,
      history: [...currentHistory, ...changes],
    };
  };
}

/**
 * Detects changes between old and new task states
 */
export function detectTaskChanges(
  oldTask: Task,
  newTask: Task,
  milestoneId: string,
  options: ChangeHistoryOptions = {}
): ChangeHistoryEntry[] {
  const changes: ChangeHistoryEntry[] = [];

  if (oldTask.name !== newTask.name) {
    changes.push(
      createChangeEntry(
        'task',
        oldTask.taskId,
        'name',
        oldTask.name,
        newTask.name,
        {
          ...options,
          context: {
            ...options.context,
            milestoneId,
            taskName: newTask.name,
          },
        }
      )
    );
  }

  if (oldTask.description !== newTask.description) {
    changes.push(
      createChangeEntry(
        'task',
        oldTask.taskId,
        'description',
        oldTask.description,
        newTask.description,
        {
          ...options,
          context: {
            ...options.context,
            milestoneId,
            taskName: newTask.name,
          },
        }
      )
    );
  }

  if (oldTask.team !== newTask.team) {
    changes.push(
      createChangeEntry(
        'task',
        oldTask.taskId,
        'team',
        oldTask.team,
        newTask.team,
        {
          ...options,
          context: {
            ...options.context,
            milestoneId,
            taskName: newTask.name,
          },
        }
      )
    );
  }

  if (oldTask.durationDays !== newTask.durationDays) {
    changes.push(
      createChangeEntry(
        'task',
        oldTask.taskId,
        'duration',
        oldTask.durationDays,
        newTask.durationDays,
        {
          ...options,
          context: {
            ...options.context,
            milestoneId,
            taskName: newTask.name,
          },
        }
      )
    );
  }

  // Check if dependencies changed
  const oldDeps = [...(oldTask.dependsOn || [])].sort();
  const newDeps = [...(newTask.dependsOn || [])].sort();

  if (JSON.stringify(oldDeps) !== JSON.stringify(newDeps)) {
    changes.push(
      createChangeEntry(
        'task',
        oldTask.taskId,
        'dependency',
        oldTask.dependsOn || [],
        newTask.dependsOn || [],
        {
          ...options,
          context: {
            ...options.context,
            milestoneId,
            taskName: newTask.name,
          },
        }
      )
    );
  }

  return changes;
}

/**
 * Detects milestone changes
 */
export function detectMilestoneChanges(
  oldMilestone: Milestone,
  newMilestone: Milestone,
  options: ChangeHistoryOptions = {}
): ChangeHistoryEntry[] {
  const changes: ChangeHistoryEntry[] = [];

  if (oldMilestone.milestoneName !== newMilestone.milestoneName) {
    changes.push(
      createChangeEntry(
        'milestone',
        oldMilestone.milestoneId,
        'milestone_name',
        oldMilestone.milestoneName,
        newMilestone.milestoneName,
        {
          ...options,
          context: {
            ...options.context,
            milestoneName: newMilestone.milestoneName,
          },
        }
      )
    );
  }

  return changes;
}

/**
 * Creates a change entry for task addition
 */
export function logTaskAddition(
  task: Task,
  milestoneId: string,
  milestoneName: string,
  options: ChangeHistoryOptions = {}
): ChangeHistoryEntry {
  return createChangeEntry('task', task.taskId, 'add', null, task, {
    ...options,
    context: {
      ...options.context,
      milestoneId,
      milestoneName,
      taskName: task.name,
    },
  });
}

/**
 * Creates a change entry for task removal
 */
export function logTaskRemoval(
  task: Task,
  milestoneId: string,
  milestoneName: string,
  options: ChangeHistoryOptions = {}
): ChangeHistoryEntry {
  return createChangeEntry('task', task.taskId, 'remove', task, null, {
    ...options,
    context: {
      ...options.context,
      milestoneId,
      milestoneName,
      taskName: task.name,
    },
  });
}

/**
 * Creates a change entry for milestone addition
 */
export function logMilestoneAddition(
  milestone: Milestone,
  options: ChangeHistoryOptions = {}
): ChangeHistoryEntry {
  return createChangeEntry(
    'milestone',
    milestone.milestoneId,
    'add',
    null,
    milestone,
    {
      ...options,
      context: {
        ...options.context,
        milestoneName: milestone.milestoneName,
      },
    }
  );
}

/**
 * Creates a change entry for milestone removal
 */
export function logMilestoneRemoval(
  milestone: Milestone,
  options: ChangeHistoryOptions = {}
): ChangeHistoryEntry {
  return createChangeEntry(
    'milestone',
    milestone.milestoneId,
    'remove',
    milestone,
    null,
    {
      ...options,
      context: {
        ...options.context,
        milestoneName: milestone.milestoneName,
      },
    }
  );
}

/**
 * Creates a change entry for task move between milestones
 */
export function logTaskMove(
  task: Task,
  fromMilestoneId: string,
  fromMilestoneName: string,
  toMilestoneId: string,
  toMilestoneName: string,
  options: ChangeHistoryOptions = {}
): ChangeHistoryEntry {
  return createChangeEntry(
    'task',
    task.taskId,
    'task_move',
    fromMilestoneName,
    toMilestoneName,
    {
      ...options,
      context: {
        ...options.context,
        milestoneId: fromMilestoneId,
        targetMilestoneId: toMilestoneId,
        taskName: task.name,
        milestoneName: fromMilestoneName,
      },
    }
  );
}
