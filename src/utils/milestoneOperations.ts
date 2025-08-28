import { Milestone } from './dateUtils';

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
    m => m.milestoneId !== excludeMilestoneId && 
    m.milestoneName.toLowerCase() === trimmedName.toLowerCase()
  );
  
  if (existingMilestone) {
    errors.push(`Milestone name "${trimmedName}" already exists`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}