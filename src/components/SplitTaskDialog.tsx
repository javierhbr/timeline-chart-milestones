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
import {
  Scissors,
  X,
  Plus,
  Minus,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { Task, Milestone } from '../utils/dateUtils';
import { SplitConfig } from '../utils/taskOperations';

interface SplitTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: SplitConfig) => void;
  task: Task | null;
  milestones: Milestone[];
}

export function SplitTaskDialog({
  isOpen,
  onClose,
  onConfirm,
  task,
  milestones,
}: SplitTaskDialogProps) {
  const [splitConfig, setSplitConfig] = useState<SplitConfig>({
    splits: [
      { name: '', duration: 1 },
      { name: '', duration: 1 }
    ]
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Reset form when task changes or dialog opens
  useEffect(() => {
    if (task && isOpen) {
      const totalDuration = task.durationDays;
      const splitCount = 2;
      const baseDuration = Math.floor(totalDuration / splitCount);
      const remainder = totalDuration % splitCount;

      setSplitConfig({
        splits: Array.from({ length: splitCount }, (_, index) => ({
          name: `${task.name} - Part ${index + 1}`,
          duration: baseDuration + (index < remainder ? 1 : 0)
        }))
      });
      setErrors([]);
    }
  }, [task, isOpen]);

  if (!task) return null;

  const validateSplits = (): string[] => {
    const errors: string[] = [];
    
    if (splitConfig.splits.length < 2) {
      errors.push('At least 2 split tasks are required');
    }

    splitConfig.splits.forEach((split, index) => {
      if (!split.name.trim()) {
        errors.push(`Split task ${index + 1} needs a name`);
      }
      if (split.duration < 1) {
        errors.push(`Split task ${index + 1} must have at least 1 day duration`);
      }
    });

    const totalDuration = splitConfig.splits.reduce((sum, split) => sum + split.duration, 0);
    if (totalDuration !== task.durationDays) {
      errors.push(`Total duration (${totalDuration} days) must equal original task duration (${task.durationDays} days)`);
    }

    return errors;
  };

  const handleConfirm = async () => {
    const validationErrors = validateSplits();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    try {
      await onConfirm(splitConfig);
      onClose();
    } catch (error) {
      console.error('Failed to split task:', error);
      setErrors(['Failed to split task. Please try again.']);
    } finally {
      setIsLoading(false);
    }
  };

  const addSplit = () => {
    setSplitConfig(prev => ({
      splits: [
        ...prev.splits,
        {
          name: `${task.name} - Part ${prev.splits.length + 1}`,
          duration: 1
        }
      ]
    }));
  };

  const removeSplit = (index: number) => {
    if (splitConfig.splits.length <= 2) return; // Minimum 2 splits
    
    setSplitConfig(prev => ({
      splits: prev.splits.filter((_, i) => i !== index)
    }));
  };

  const updateSplit = (index: number, field: 'name' | 'duration', value: string | number) => {
    setSplitConfig(prev => ({
      splits: prev.splits.map((split, i) => 
        i === index ? { ...split, [field]: value } : split
      )
    }));
  };

  const totalDuration = splitConfig.splits.reduce((sum, split) => sum + split.duration, 0);
  const durationDiff = totalDuration - task.durationDays;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-orange-600" />
            Split Task
          </DialogTitle>
          <DialogDescription>
            Split "{task.name}" into multiple sequential tasks. Each split will depend on the previous one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Original Task Info */}
          <div className="p-3 bg-muted/30 rounded-lg border">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">Original Task:</div>
                <div className="text-muted-foreground mt-1">
                  • Name: {task.name}
                  • Duration: {task.durationDays} days
                  • Team: {task.team}
                </div>
              </div>
            </div>
          </div>

          {/* Split Configuration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Split Tasks</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSplit}
                className="flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Split
              </Button>
            </div>

            {splitConfig.splits.map((split, index) => (
              <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <div>
                    <Label htmlFor={`split-name-${index}`} className="text-sm">
                      Task {index + 1} Name
                    </Label>
                    <Input
                      id={`split-name-${index}`}
                      value={split.name}
                      onChange={(e) => updateSplit(index, 'name', e.target.value)}
                      placeholder={`${task.name} - Part ${index + 1}`}
                    />
                  </div>
                  <div className="w-32">
                    <Label htmlFor={`split-duration-${index}`} className="text-sm">
                      Duration (days)
                    </Label>
                    <Input
                      id={`split-duration-${index}`}
                      type="number"
                      min="1"
                      value={split.duration}
                      onChange={(e) => updateSplit(index, 'duration', parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
                
                {splitConfig.splits.length > 2 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeSplit(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Duration Summary */}
          <div className={`p-3 rounded-lg border ${
            durationDiff === 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-start gap-2">
              {durationDiff === 0 ? (
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
              )}
              <div className="text-sm">
                <div className="font-medium">Duration Summary:</div>
                <div className="mt-1">
                  • Original: {task.durationDays} days
                  • Split total: {totalDuration} days
                  • Difference: {durationDiff > 0 ? '+' : ''}{durationDiff} days
                </div>
              </div>
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">
                  <div className="font-medium">Please fix the following issues:</div>
                  <ul className="mt-1 list-disc list-inside space-y-1">
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || errors.length > 0}
            className="flex items-center gap-2"
          >
            <Scissors className="w-4 h-4" />
            {isLoading ? 'Splitting...' : 'Split Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}