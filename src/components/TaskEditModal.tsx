import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Command, CommandEmpty, CommandInput, CommandItem } from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Badge } from './ui/badge';
import {
  Calendar,
  Clock,
  Users,
  Save,
  X,
  Zap,
  Link,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { Task, Milestone, teamColors } from '../utils/dateUtils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface TaskEditModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskId: string, updates: Partial<Task>) => void;
  milestones: Milestone[];
}

// Extract unique teams and sprints from project data
function getAvailableTeams(milestones: Milestone[]): string[] {
  const teams = new Set<string>();
  milestones.forEach(milestone => {
    milestone.tasks.forEach(task => {
      if (task.team && task.team.trim()) {
        teams.add(task.team);
      }
    });
  });
  
  const teamsArray = Array.from(teams).sort();
  
  // Add default teams if none exist
  if (teamsArray.length === 0) {
    return ['Dev', 'QA', 'Design', 'PM', 'UX', 'UI', 'Backend', 'Frontend', 'Marketing'];
  }
  
  return teamsArray;
}

function getAvailableSprints(milestones: Milestone[]): string[] {
  const sprints = new Set<string>();
  milestones.forEach(milestone => {
    milestone.tasks.forEach(task => {
      if (task.sprint && task.sprint.trim()) {
        sprints.add(task.sprint);
      }
    });
  });
  
  const sprintsArray = Array.from(sprints).sort();
  
  // Add default sprints if none exist
  if (sprintsArray.length === 0) {
    return ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Sprint 5', 'Backlog', 'Icebox'];
  }
  
  return sprintsArray;
}

export function TaskEditModal({
  task,
  isOpen,
  onClose,
  onSave,
  milestones,
}: TaskEditModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    team: '',
    sprint: '',
    durationDays: 1,
    dependsOn: [] as string[],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dependencyPopoverOpen, setDependencyPopoverOpen] = useState(false);

  // Get dynamic teams and sprints from project data - memoize to prevent infinite re-renders
  const availableTeams = React.useMemo(() => getAvailableTeams(milestones), [milestones]);
  const availableSprints = React.useMemo(() => getAvailableSprints(milestones), [milestones]);

  // Update form when task changes or modal opens/closes
  useEffect(() => {
    console.log('🎯 TaskEditModal useEffect triggered:', { 
      isOpen, 
      hasTask: !!task, 
      taskName: task?.name,
      availableTeamsCount: availableTeams.length,
      availableSprintsCount: availableSprints.length 
    });
    
    if (isOpen) {
      if (task) {
        // Edit mode - populate with existing task data
        console.log('✏️ EDIT MODE - populating form with task data');
        setFormData({
          name: task.name,
          description: task.description,
          team: task.team,
          sprint: task.sprint || '',
          durationDays: task.durationDays,
          dependsOn: task.dependsOn || [],
        });
      } else {
        // Create mode - use default values
        const defaultTeam = availableTeams.length > 0 ? availableTeams[0] : 'Dev';
        const defaultSprint = availableSprints.length > 0 ? availableSprints[0] : '';
        
        console.log('➕ CREATE MODE - setting default form values:', { defaultTeam, defaultSprint });
        setFormData({
          name: '',
          description: '',
          team: defaultTeam,
          sprint: defaultSprint,
          durationDays: 1,
          dependsOn: [],
        });
      }
      setErrors({});
    }
  }, [task, isOpen, availableTeams, availableSprints]);

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
    if (!validateForm()) return;

    const updates: Partial<Task> = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      team: formData.team,
      sprint:
        formData.sprint === 'none' ? undefined : formData.sprint || undefined,
      durationDays: formData.durationDays,
      dependsOn: formData.dependsOn,
    };

    // In create mode, task is null, so we pass a placeholder taskId that will be replaced
    const taskId = task ? task.taskId : 'new-task-placeholder';
    onSave(taskId, updates);
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

  // Remove the early return - we need to render the dialog for both create and edit modes

  // Get all available tasks for dependencies (excluding the current task)
  const availableTasks = milestones.flatMap(milestone =>
    milestone.tasks.filter(t => t.taskId !== task?.taskId)
  );
  
  
  // Debug logging for component state

  const handleAddDependency = (taskId: string) => {
    
    if (!formData.dependsOn.includes(taskId)) {
      setFormData(prev => ({
        ...prev,
        dependsOn: [...prev.dependsOn, taskId],
      }));
    }
    setDependencyPopoverOpen(false);
  };

  const handleRemoveDependency = (taskId: string) => {
    setFormData(prev => ({
      ...prev,
      dependsOn: prev.dependsOn.filter(id => id !== taskId),
    }));
  };

  // Get dependency task details for display
  const getDependencyTaskDetails = (taskId: string) => {
    for (const milestone of milestones) {
      const task = milestone.tasks.find(t => t.taskId === taskId);
      if (task) {
        return { task, milestone: milestone.milestoneName };
      }
    }
    return null;
  };

  return (
    <>
      <style>{`
        .task-edit-modal {
          width: 60vw !important;
          max-width: 60vw !important;
          min-width: 60vw !important;
        }
        .task-edit-modal[data-slot="dialog-content"] {
          width: 60vw !important;
          max-width: 60vw !important;
        }
        /* Fix z-index for dropdowns inside modal */
        .task-edit-modal [data-radix-popper-content-wrapper] {
          z-index: 10000 !important;
        }
        .task-edit-modal [data-radix-select-content] {
          z-index: 10002 !important;
        }
        .task-edit-modal [data-radix-popover-content] {
          z-index: 10001 !important;
        }
      `}</style>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          className="max-h-[90vh] task-edit-modal"
          style={{
            zIndex: 9999,
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {task ? 'Edit Task' : 'Create New Task'}
            </DialogTitle>
            <DialogDescription>
              {task 
                ? 'Modify task details, assign teams, set duration, and manage dependencies.'
                : 'Create a new task with details, team assignment, duration, and dependencies.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto pr-2">
            <div className="space-y-4">
              {/* Date information (read-only) - only show for existing tasks */}
              {task && task.startDate && task.endDate && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Calendar className="w-4 h-4" />
                    Project dates
                  </div>
                  <div className="text-sm">
                    {format(parseISO(task.startDate), 'dd/MM/yyyy', {
                      locale: es,
                    })}{' '}
                    -{' '}
                    {format(parseISO(task.endDate), 'dd/MM/yyyy', {
                      locale: es,
                    })}
                  </div>
                </div>
              )}

              {/* Task name */}
              <div className="space-y-2">
                <Label htmlFor="taskName">Task name *</Label>
                <Input
                  id="taskName"
                  value={formData.name}
                  onChange={e => handleFieldChange('name', e.target.value)}
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
                  onChange={e =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Detailed task description..."
                  className="min-h-[100px]"
                />
              </div>

              {/* Team, Sprint, and Duration - Horizontal Layout */}
              <div className="flex flex-row gap-4 items-start">
                {/* Team */}
                <div className="space-y-2 flex-1">
                  <Label>Assigned team *</Label>
                  <Select
                    value={formData.team}
                    onValueChange={(value: string) =>
                      setFormData({ ...formData, team: value })
                    }
                  >
                    <SelectTrigger
                      className={errors.team ? 'border-red-500' : ''}
                    >
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent style={{ zIndex: 10000 }}>
                      {availableTeams.map(team => (
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
                <div className="space-y-2 flex-1">
                  <Label className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Assigned sprint
                  </Label>
                  <Select
                    value={formData.sprint}
                    onValueChange={(value: string) =>
                      handleFieldChange('sprint', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sprint (optional)" />
                    </SelectTrigger>
                    <SelectContent style={{ zIndex: 10000 }}>
                      <SelectItem value="none">No sprint assigned</SelectItem>
                      {availableSprints.map(sprint => (
                        <SelectItem key={sprint} value={sprint}>
                          {sprint}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Duration */}
                <div className="space-y-2 flex-1">
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
                    <p className="text-sm text-destructive">
                      {errors.durationDays}
                    </p>
                  )}
                </div>
              </div>

              {/* Duration help text */}
              <p className="text-xs text-muted-foreground">
                Excludes weekends from calculation
              </p>

              {/* Section Separator */}
              <hr className="my-6 border-muted" />

              {/* Dependencies */}
              <div className="space-y-3 border-2 border-blue-200 rounded-lg p-4 bg-blue-50/30">
                <Label className="flex items-center gap-2 text-base font-semibold">
                  <Link className="w-5 h-5 text-blue-600" />
                  Task Dependencies
                </Label>
                <p className="text-sm text-muted-foreground">
                  Select tasks that must be completed before this task can start
                </p>

                {/* Current Dependencies */}
                {formData.dependsOn.length > 0 && (
                  <div className="space-y-1 mb-3">
                    {formData.dependsOn.map(depId => {
                      const depDetails = getDependencyTaskDetails(depId);
                      if (!depDetails) return null;

                      return (
                        <div
                          key={depId}
                          className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="text-sm font-medium">
                              {depDetails.task.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {depDetails.milestone} • {depDetails.task.team}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveDependency(depId)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Dependency Dropdown - Natural Command Interface */}
                {availableTasks.length > 0 ? (
                  <Popover
                    open={dependencyPopoverOpen}
                    onOpenChange={setDependencyPopoverOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={dependencyPopoverOpen}
                        className="w-full justify-between h-10 font-normal text-sm"
                      >
                        Add task dependency... ({availableTasks.length} available)
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-full p-0" 
                      style={{ zIndex: 10001, maxHeight: '400px' }}
                    >
                      <Command>
                        <CommandInput
                          placeholder="Search tasks..."
                          className="h-9"
                        />
                        <CommandEmpty className="py-6 text-center text-sm">
                          No tasks found.
                        </CommandEmpty>
                        <div className="max-h-[300px] overflow-y-auto">
                          {availableTasks
                            .filter(t => !formData.dependsOn.includes(t.taskId))
                            .map(task => (
                              <CommandItem
                                key={task.taskId}
                                value={`${task.name} ${task.taskId} ${task.team}`}
                                onSelect={() => handleAddDependency(task.taskId)}
                                className="cursor-pointer"
                              >
                                <div className="flex items-center justify-between w-full gap-2">
                                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                    <span className="font-medium truncate text-sm">
                                      {task.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      ({task.team})
                                    </span>
                                  </div>
                                  <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                                    {task.taskId}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                        </div>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <div className="p-3 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                    No other tasks available for dependencies
                  </div>
                )}
              </div>

              {/* Team and sprint badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <Badge
                    variant="outline"
                    style={{
                      borderColor:
                        teamColors[formData.team] || teamColors.Default,
                      color: teamColors[formData.team] || teamColors.Default,
                    }}
                  >
                    {formData.team || 'No team'}
                  </Badge>
                </div>
                {formData.sprint && (
                  <div className="flex items-center gap-1">
                    <Zap className="w-4 h-4 text-muted-foreground" />
                    <Badge variant="secondary">{formData.sprint}</Badge>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSave}
              className="flex-1 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {task ? 'Save changes' : 'Create task'}
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
    </>
  );
}
