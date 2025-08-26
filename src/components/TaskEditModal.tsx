import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Calendar, Clock, Users, Save, X, Zap } from 'lucide-react';
import { Task, teamColors } from '../utils/dateUtils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface TaskEditModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskId: string, updates: Partial<Task>) => void;
}

const availableTeams = [
  'UX', 'UI', 'PM', 'Dev', 'QA', 'Backend', 'Frontend', 'Design', 'Marketing'
];

const availableSprints = [
  'Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5', 'Sprint 6',
  'Sprint 7', 'Sprint 8', 'Sprint 9', 'Sprint 10', 'Backlog', 'Icebox'
];

export function TaskEditModal({ task, isOpen, onClose, onSave }: TaskEditModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    team: '',
    sprint: '',
    durationDays: 1
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form when task changes
  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name,
        description: task.description,
        team: task.team,
        sprint: task.sprint || '',
        durationDays: task.durationDays
      });
      setErrors({});
    }
  }, [task]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.team) {
      newErrors.team = 'Team is required';
    }

    if (formData.durationDays < 1) {
      newErrors.durationDays = 'Duration must be at least 1 day';
    }

    if (formData.durationDays > 365) {
      newErrors.durationDays = 'Duration cannot exceed 365 days';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!task || !validateForm()) return;

    const updates: Partial<Task> = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      team: formData.team,
      sprint: formData.sprint || undefined,
      durationDays: formData.durationDays
    };

    onSave(task.taskId, updates);
    onClose();
  };

  const handleFieldChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field error when modified
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      handleFieldChange('durationDays', 1);
    } else {
      const numValue = parseInt(value);
      if (!isNaN(numValue) && numValue >= 1 && numValue <= 365) {
        handleFieldChange('durationDays', numValue);
      }
    }
  };

  if (!task) return null;

  const teamColor = teamColors[task.team] || teamColors.Default;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Edit Task
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Date information (read-only) */}
          {task.startDate && task.endDate && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Calendar className="w-4 h-4" />
                Project dates
              </div>
              <div className="text-sm">
                {format(parseISO(task.startDate), 'dd/MM/yyyy', { locale: es })} - {format(parseISO(task.endDate), 'dd/MM/yyyy', { locale: es })}
              </div>
            </div>
          )}

          {/* Task name */}
          <div className="space-y-2">
            <Label htmlFor="taskName">Task name *</Label>
            <Input
              id="taskName"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="E.g.: Create initial wireframes"
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="taskDescription">Description</Label>
            <Textarea
              id="taskDescription"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed task description..."
              className="min-h-[100px]"
            />
          </div>

          {/* Team */}
          <div className="space-y-2">
            <Label>Assigned team *</Label>
            <Select
              value={formData.team}
              onValueChange={(value) => setFormData({ ...formData, team: value })}
            >
              <SelectTrigger className={errors.team ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {availableTeams.map((team) => (
                  <SelectItem key={team} value={team}>
                    {team}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.team && (
              <p className="text-sm text-destructive">{errors.team}</p>
            )}
          </div>

          {/* Sprint */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Assigned sprint
            </Label>
            <Select
              value={formData.sprint}
              onValueChange={(value) => handleFieldChange('sprint', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select sprint (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No sprint assigned</SelectItem>
                {availableSprints.map((sprint) => (
                  <SelectItem key={sprint} value={sprint}>
                    {sprint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Duration in working days *
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="duration"
                type="number"
                min="1"
                max="365"
                value={formData.durationDays}
                onChange={handleDurationChange}
                className={`w-24 ${errors.durationDays ? 'border-destructive' : ''}`}
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            {errors.durationDays && (
              <p className="text-sm text-destructive">{errors.durationDays}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Excludes weekends from calculation
            </p>
          </div>

          {/* Team and sprint badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4 text-muted-foreground" />
              <Badge 
                variant="outline"
                style={{ 
                  borderColor: teamColors[formData.team] || teamColors.Default,
                  color: teamColors[formData.team] || teamColors.Default 
                }}
              >
                {formData.team || 'No team'}
              </Badge>
            </div>
            {formData.sprint && (
              <div className="flex items-center gap-1">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <Badge variant="secondary">
                  {formData.sprint}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-4">
          <Button 
            onClick={handleSave}
            className="flex-1 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save changes
          </Button>
          <Button 
            variant="outline" 
            onClick={onClose}
            className="flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}