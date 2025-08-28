import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Move, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Task, Milestone } from '../utils/dateUtils';

interface MoveTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (fromMilestoneId: string, toMilestoneId: string) => void;
  task: Task | null;
  milestones: Milestone[];
  currentMilestoneId: string;
}

export function MoveTaskDialog({
  isOpen,
  onClose,
  onConfirm,
  task,
  milestones,
  currentMilestoneId,
}: MoveTaskDialogProps) {
  const [targetMilestoneId, setTargetMilestoneId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Reset form when task changes or dialog opens
  useEffect(() => {
    if (task && isOpen) {
      // Default to first different milestone
      const otherMilestones = milestones.filter(
        m => m.milestoneId !== currentMilestoneId
      );
      setTargetMilestoneId(
        otherMilestones.length > 0 ? otherMilestones[0].milestoneId : ''
      );
    }
  }, [task, isOpen, currentMilestoneId, milestones]);

  if (!task) return null;

  const currentMilestone = milestones.find(
    m => m.milestoneId === currentMilestoneId
  );
  const targetMilestone = milestones.find(
    m => m.milestoneId === targetMilestoneId
  );
  const availableMilestones = milestones.filter(
    m => m.milestoneId !== currentMilestoneId
  );

  const handleConfirm = async () => {
    if (!targetMilestoneId || targetMilestoneId === currentMilestoneId) return;

    setIsLoading(true);
    try {
      await onConfirm(currentMilestoneId, targetMilestoneId);
      onClose();
    } catch (error) {
      console.error('Failed to move task:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check for dependency issues
  const dependencyWarnings = [];
  if (task.dependsOn.length > 0) {
    const currentMilestoneTasks = currentMilestone?.tasks || [];
    const hasInternalDependencies = task.dependsOn.some(depId =>
      currentMilestoneTasks.some(t => t.taskId === depId)
    );
    if (hasInternalDependencies) {
      dependencyWarnings.push(
        'This task has dependencies in the current milestone. Moving it may break the dependency chain.'
      );
    }
  }

  // Check if other tasks depend on this one
  const allTasks = milestones.flatMap(m => m.tasks);
  const dependentTasks = allTasks.filter(t =>
    t.dependsOn.includes(task.taskId)
  );
  const currentMilestoneDependents = dependentTasks.filter(t =>
    currentMilestone?.tasks.some(ct => ct.taskId === t.taskId)
  );

  if (currentMilestoneDependents.length > 0) {
    dependencyWarnings.push(
      `${currentMilestoneDependents.length} task(s) in the current milestone depend on this task. Moving it may break their dependencies.`
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Move className="w-5 h-5 text-purple-600" />
            Move Task to Milestone
          </DialogTitle>
          <DialogDescription>
            Move "{task.name}" from one milestone to another.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Task Info */}
          <div className="p-3 bg-muted/30 rounded-lg border">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">Task Details:</div>
                <div className="text-muted-foreground mt-1">
                  • Name: {task.name}• Duration: {task.durationDays} days •
                  Team: {task.team}• Dependencies: {task.dependsOn.length}
                </div>
              </div>
            </div>
          </div>

          {/* Source Milestone */}
          <div className="space-y-2">
            <Label>From Milestone</Label>
            <div className="p-2 bg-muted/20 rounded border">
              <div className="font-medium">
                {currentMilestone?.milestoneName}
              </div>
              <div className="text-sm text-muted-foreground">
                {currentMilestone?.tasks.length} tasks total
              </div>
            </div>
          </div>

          {/* Target Milestone */}
          <div className="space-y-2">
            <Label>To Milestone</Label>
            {availableMilestones.length > 0 ? (
              <Select
                value={targetMilestoneId}
                onValueChange={setTargetMilestoneId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select destination milestone" />
                </SelectTrigger>
                <SelectContent>
                  {availableMilestones.map(milestone => (
                    <SelectItem
                      key={milestone.milestoneId}
                      value={milestone.milestoneId}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{milestone.milestoneName}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({milestone.tasks.length} tasks)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-2 bg-muted/20 rounded border text-sm text-muted-foreground">
                No other milestones available
              </div>
            )}
          </div>

          {/* Move Summary */}
          {targetMilestone && (
            <div className="p-3 bg-muted/30 rounded-lg border">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium">Move Summary:</div>
                  <div className="text-muted-foreground mt-1">
                    • From: {currentMilestone?.milestoneName} →{' '}
                    {targetMilestone.milestoneName}• Task will maintain its
                    duration and team assignment • Timeline will be recalculated
                    after moving
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dependency Warnings */}
          {dependencyWarnings.length > 0 && (
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <div className="font-medium">Dependency Warnings:</div>
                  <ul className="mt-1 space-y-1">
                    {dependencyWarnings.map((warning, index) => (
                      <li key={index} className="text-xs">
                        • {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              isLoading ||
              !targetMilestoneId ||
              availableMilestones.length === 0
            }
            className="flex items-center gap-2"
          >
            <Move className="w-4 h-4" />
            {isLoading ? 'Moving...' : 'Move Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
