import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Plus, AlertCircle } from 'lucide-react';
import { Milestone } from '../utils/dateUtils';
import { validateMilestone } from '../utils/milestoneOperations';

interface MilestoneCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (milestoneName: string, description?: string) => void;
  milestones: Milestone[];
}

export function MilestoneCreateDialog({
  isOpen,
  onClose,
  onConfirm,
  milestones,
}: MilestoneCreateDialogProps) {
  const [milestoneName, setMilestoneName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setMilestoneName('');
      setDescription('');
      setErrors([]);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Validate form on name change
  useEffect(() => {
    if (milestoneName) {
      const validation = validateMilestone(milestoneName, milestones);
      setErrors(validation.errors);
    } else {
      setErrors([]);
    }
  }, [milestoneName, milestones]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    const validation = validateMilestone(milestoneName, milestones);

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);

    try {
      await onConfirm(milestoneName.trim(), description.trim() || undefined);

      // Close dialog on success
      onClose();
    } catch (error) {
      console.error('❌ Error creating milestone:', error);
      setErrors(['Failed to create milestone. Please try again.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const canSubmit =
    milestoneName.trim().length > 0 && errors.length === 0 && !isSubmitting;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open: boolean) => !open && handleClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Create New Milestone
          </DialogTitle>
          <DialogDescription>
            Add a new milestone to organize your project tasks.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="milestone-name">
              Milestone Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="milestone-name"
              placeholder="e.g., Phase 1 - Requirements"
              value={milestoneName}
              onChange={e => setMilestoneName(e.target.value)}
              disabled={isSubmitting}
              className={errors.length > 0 ? 'border-red-500' : ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="milestone-description">
              Description (Optional)
            </Label>
            <Textarea
              id="milestone-description"
              placeholder="Brief description of this milestone..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={isSubmitting}
              rows={3}
            />
          </div>

          {/* Error Display */}
          {errors.length > 0 && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                <div className="space-y-1">
                  {errors.map((error, index) => (
                    <p key={index} className="text-sm text-red-600">
                      {error}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Form Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex items-start gap-2">
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-2">New milestone will:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Start empty with no tasks</li>
                  <li>
                    • Get automatically positioned by date when tasks are added
                  </li>
                  <li>• Be available for task assignment</li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="flex items-center gap-2"
            >
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {isSubmitting ? 'Creating...' : 'Create Milestone'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
