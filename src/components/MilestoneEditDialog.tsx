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
import { Textarea } from './ui/textarea';
import { Edit, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Milestone } from '../utils/dateUtils';

// Extended milestone type that might include description
type MilestoneWithDescription = Milestone & {
  description?: string;
};

interface MilestoneEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    milestoneId: string,
    updates: { milestoneName: string; description?: string }
  ) => void;
  milestone: Milestone | null;
  milestones: Milestone[]; // For name uniqueness validation
}

export function MilestoneEditDialog({
  isOpen,
  onClose,
  onConfirm,
  milestone,
  milestones,
}: MilestoneEditDialogProps) {
  const [formData, setFormData] = useState({
    milestoneName: '',
    description: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Reset form when milestone changes or dialog opens
  useEffect(() => {
    if (milestone && isOpen) {
      setFormData({
        milestoneName: milestone.milestoneName,
        description: (milestone as MilestoneWithDescription).description || '',
      });
      setErrors([]);
    }
  }, [milestone, isOpen]);

  if (!milestone) return null;

  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (!formData.milestoneName.trim()) {
      errors.push('Milestone name is required');
    }

    // Check for name uniqueness (excluding current milestone)
    const nameExists = milestones.some(
      m =>
        m.milestoneId !== milestone.milestoneId &&
        m.milestoneName.toLowerCase() ===
          formData.milestoneName.trim().toLowerCase()
    );

    if (nameExists) {
      errors.push('A milestone with this name already exists');
    }

    return errors;
  };

  const handleConfirm = async () => {
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    try {
      await onConfirm(milestone.milestoneId, {
        milestoneName: formData.milestoneName.trim(),
        description: formData.description.trim() || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to update milestone:', error);
      setErrors(['Failed to update milestone. Please try again.']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear errors when user starts typing
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const hasChanges =
    formData.milestoneName !== milestone.milestoneName ||
    formData.description !== ((milestone as MilestoneWithDescription).description || '');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-blue-600" />
            Edit Milestone
          </DialogTitle>
          <DialogDescription>
            Modify the details of "{milestone.milestoneName}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Milestone Info */}
          <div className="p-3 bg-muted/30 rounded-lg border">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">Milestone Details:</div>
                <div className="text-muted-foreground mt-1">
                  • Tasks: {milestone.tasks.length}• ID: {milestone.milestoneId}
                </div>
              </div>
            </div>
          </div>

          {/* Milestone Name */}
          <div className="space-y-2">
            <Label htmlFor="milestoneName">
              Milestone Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="milestoneName"
              value={formData.milestoneName}
              onChange={e => handleInputChange('milestoneName', e.target.value)}
              placeholder="Enter milestone name"
              className={
                errors.some(e => e.includes('name')) ? 'border-red-500' : ''
              }
            />
          </div>

          {/* Milestone Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={e => handleInputChange('description', e.target.value)}
              placeholder="Enter milestone description..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Changes Summary */}
          {hasChanges && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                <div className="text-sm text-green-800">
                  <div className="font-medium">Pending Changes:</div>
                  <ul className="mt-1 space-y-1">
                    {formData.milestoneName !== milestone.milestoneName && (
                      <li className="text-xs">
                        • Name: "{milestone.milestoneName}" → "
                        {formData.milestoneName}"
                      </li>
                    )}
                    {formData.description !==
                      ((milestone as MilestoneWithDescription).description || '') && (
                      <li className="text-xs">
                        • Description:{' '}
                        {formData.description ? 'Updated' : 'Removed'}
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">
                  <div className="font-medium">
                    Please fix the following issues:
                  </div>
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
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !hasChanges || errors.length > 0}
            className="flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            {isLoading ? 'Updating...' : 'Update Milestone'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
