import { Milestone } from './dateUtils';
import { 
  ChangeHistoryEntry, 
  ChangeHistoryOptions,
  logMilestoneAddition,
  logMilestoneRemoval,
  detectMilestoneChanges
} from './changeHistory';

/**
 * Generates a unique milestone ID that doesn't exist in the current milestones
 */
export function generateUniqueMilestoneId(milestones: Milestone[]): string {
  const existingIds = new Set<string>();

  // Collect all existing milestone IDs
  milestones.forEach(milestone => {
    existingIds.add(milestone.milestoneId);
  });

  // Generate unique ID with format: M{timestamp}_{random}
  let attempts = 0;
  let newId: string;

  do {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 4);
    newId = `M${timestamp}_${random}`;
    attempts++;

    // Fallback in case of collision
    if (attempts > 100) {
      newId = `M${timestamp}_${attempts}`;
      break;
    }
  } while (existingIds.has(newId));

  return newId;
}

/**
 * Creates a new milestone with the given name and default values
 */
export function createNewMilestone(
  milestoneName: string,
  milestones: Milestone[],
  _description?: string
): Milestone {
  return {
    milestoneId: generateUniqueMilestoneId(milestones),
    milestoneName: milestoneName.trim(),
    tasks: [],
    // startDate and endDate will be calculated when tasks are added
  };
}

/**
 * Validates milestone data before creation/update
 */
export function validateMilestone(
  milestoneName: string,
  milestones: Milestone[],
  excludeMilestoneId?: string
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check if name is provided and not empty
  if (!milestoneName || milestoneName.trim().length === 0) {
    errors.push('Milestone name is required');
  }

  // Check for duplicate names
  const trimmedName = milestoneName.trim();
  const existingMilestone = milestones.find(
    m =>
      m.milestoneId !== excludeMilestoneId &&
      m.milestoneName.toLowerCase() === trimmedName.toLowerCase()
  );

  if (existingMilestone) {
    errors.push(`Milestone name "${trimmedName}" already exists`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============== CHANGE-TRACKING ENHANCED FUNCTIONS ==============

/**
 * Result type for milestone operations that include change tracking
 */
export interface MilestoneOperationResult {
  milestones: Milestone[];
  changes: ChangeHistoryEntry[];
}

/**
 * Creates a new milestone with change tracking
 */
export function createMilestoneWithTracking(
  milestones: Milestone[],
  milestoneName: string,
  description?: string,
  historyOptions: ChangeHistoryOptions = {}
): MilestoneOperationResult {
  const newMilestone = createNewMilestone(milestoneName, milestones, description);
  
  const newMilestones = [...milestones, newMilestone];
  
  const changes: ChangeHistoryEntry[] = [];
  changes.push(logMilestoneAddition(newMilestone, historyOptions));
  
  return {
    milestones: newMilestones,
    changes,
  };
}

/**
 * Removes a milestone with change tracking
 */
export function removeMilestoneWithTracking(
  milestones: Milestone[],
  milestoneId: string,
  historyOptions: ChangeHistoryOptions = {}
): MilestoneOperationResult {
  const milestoneToRemove = milestones.find(m => m.milestoneId === milestoneId);
  
  if (!milestoneToRemove) {
    return { milestones, changes: [] };
  }
  
  const newMilestones = milestones.filter(m => m.milestoneId !== milestoneId);
  
  const changes: ChangeHistoryEntry[] = [];
  changes.push(logMilestoneRemoval(milestoneToRemove, historyOptions));
  
  return {
    milestones: newMilestones,
    changes,
  };
}

/**
 * Updates a milestone with change tracking
 */
export function updateMilestoneWithTracking(
  milestones: Milestone[],
  milestoneId: string,
  updates: Partial<Pick<Milestone, 'milestoneName'>>,
  historyOptions: ChangeHistoryOptions = {}
): MilestoneOperationResult {
  const originalMilestone = milestones.find(m => m.milestoneId === milestoneId);
  
  if (!originalMilestone) {
    return { milestones, changes: [] };
  }
  
  const updatedMilestone = { ...originalMilestone, ...updates };
  
  const newMilestones = milestones.map(m =>
    m.milestoneId === milestoneId ? updatedMilestone : m
  );
  
  const changes = detectMilestoneChanges(
    originalMilestone,
    updatedMilestone,
    historyOptions
  );
  
  return {
    milestones: newMilestones,
    changes,
  };
}

/**
 * Reorders milestones with change tracking (if needed in the future)
 * For now, milestone reordering doesn't generate history entries as it's just a display change
 */
export function reorderMilestonesWithTracking(
  milestones: Milestone[],
  newOrder: string[],
  historyOptions: ChangeHistoryOptions = {}
): MilestoneOperationResult {
  // Reorder milestones based on the new order array
  const reorderedMilestones = newOrder
    .map(id => milestones.find(m => m.milestoneId === id))
    .filter((m): m is Milestone => m !== undefined);
  
  // Add any milestones that weren't in the new order (safety check)
  const includedIds = new Set(newOrder);
  const remainingMilestones = milestones.filter(m => !includedIds.has(m.milestoneId));
  
  const finalMilestones = [...reorderedMilestones, ...remainingMilestones];
  
  // For now, we don't track reordering in history as it's just a display preference
  // If you want to track this in the future, you can add change logging here
  
  return {
    milestones: finalMilestones,
    changes: [], // No changes logged for reordering
  };
}
