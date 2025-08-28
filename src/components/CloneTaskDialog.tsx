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
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Copy, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Task, Milestone } from '../utils/dateUtils';
import { CloneOptions } from '../utils/taskOperations';

interface CloneTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: CloneOptions) => void;
  task: Task | null;
  milestones: Milestone[];
  currentMilestoneId: string;
}

export function CloneTaskDialog({
  isOpen,
  onClose,
  onConfirm,
  task,
  milestones,
  currentMilestoneId,
}: CloneTaskDialogProps) {
  const [cloneOptions, setCloneOptions] = useState<CloneOptions>({
    targetMilestoneId: currentMilestoneId,
    includeDependencies: true,
    newTaskName: '',
  });

  const [isLoading, setIsLoading] = useState(false);

  // Reset form when task changes or dialog opens
  useEffect(() => {
    if (task && isOpen) {
      setCloneOptions({
        targetMilestoneId: currentMilestoneId,
        includeDependencies: true,
        newTaskName: `${task.name} (Copy)`,
      });
    }
  }, [task, isOpen, currentMilestoneId]);

  if (!task) return null;

  const handleConfirm = async () => {
    setIsLoading(true);

    try {
      await onConfirm(cloneOptions);
      onClose();
    } catch (error) {
      console.error('Failed to clone task:', error);
      // Handle error - could show a toast or error message
    } finally {
      setIsLoading(false);
    }
  };

  const targetMilestone = milestones.find(
    m => m.milestoneId === cloneOptions.targetMilestoneId
  );
  const isCloningSameMilestone =
    cloneOptions.targetMilestoneId === currentMilestoneId;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-blue-600" />
            Clone Task
          </DialogTitle>
          <DialogDescription>
            Create a copy of "{task.name}" with customizable options.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Task Name */}
          <div className="space-y-2">
            <Label htmlFor="taskName">New task name</Label>
            <Input
              id="taskName"
              value={cloneOptions.newTaskName}
              onChange={e =>
                setCloneOptions(prev => ({
                  ...prev,
                  newTaskName: e.target.value,
                }))
              }
              placeholder="Enter name for cloned task"
            />
          </div>

          {/* Target Milestone */}
          <div className="space-y-2">
            <Label>Target milestone</Label>
            <Select
              value={cloneOptions.targetMilestoneId}
              onValueChange={value =>
                setCloneOptions(prev => ({
                  ...prev,
                  targetMilestoneId: value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select milestone" />
              </SelectTrigger>
              <SelectContent>
                {milestones.map(milestone => (
                  <SelectItem
                    key={milestone.milestoneId}
                    value={milestone.milestoneId}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{milestone.milestoneName}</span>
                      {milestone.milestoneId === currentMilestoneId && (
                        <span className="text-xs text-muted-foreground ml-2">
                          (current)
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Include Dependencies */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeDependencies"
              checked={cloneOptions.includeDependencies}
              onCheckedChange={checked =>
                setCloneOptions(prev => ({
                  ...prev,
                  includeDependencies: checked === true,
                }))
              }
            />
            <Label
              htmlFor="includeDependencies"
              className="flex items-center gap-2"
            >
              Include dependencies
              <span className="text-xs text-muted-foreground">
                ({task.dependsOn.length} dependencies)
              </span>
            </Label>
          </div>

          {/* Clone Summary */}
          <div className="p-3 bg-muted/30 rounded-lg border">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">Clone Summary:</div>
                <ul className="text-muted-foreground mt-1 space-y-1">
                  <li>• Task: "{cloneOptions.newTaskName || task.name}"</li>
                  <li>• Milestone: {targetMilestone?.milestoneName}</li>
                  <li>• Duration: {task.durationDays} days</li>
                  <li>• Team: {task.team}</li>
                  <li>
                    • Dependencies:{' '}
                    {cloneOptions.includeDependencies
                      ? `${task.dependsOn.length} included`
                      : 'None (excluded)'}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Warnings */}
          {!isCloningSameMilestone && (
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <div className="font-medium">Cross-milestone clone</div>
                  <div className="mt-1">
                    Cloning to a different milestone may affect dependency
                    relationships. Timeline will be recalculated after cloning.
                  </div>
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
            disabled={isLoading || !cloneOptions.newTaskName.trim()}
            className="flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            {isLoading ? 'Cloning...' : 'Clone Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
