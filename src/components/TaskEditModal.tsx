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

  // Actualizar formulario cuando cambie la tarea
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
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.team) {
      newErrors.team = 'El equipo es requerido';
    }

    if (formData.durationDays < 1) {
      newErrors.durationDays = 'La duración debe ser al menos 1 día';
    }

    if (formData.durationDays > 365) {
      newErrors.durationDays = 'La duración no puede exceder 365 días';
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
    
    // Limpiar error del campo cuando se modifica
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
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: teamColor }}
            />
            Editar Tarea
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Información de fechas (solo lectura) */}
          {task.startDate && task.endDate && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Calendar className="w-4 h-4" />
                Fechas del proyecto
              </div>
              <div className="text-sm">
                {format(parseISO(task.startDate), 'dd/MM/yyyy', { locale: es })} - {format(parseISO(task.endDate), 'dd/MM/yyyy', { locale: es })}
              </div>
            </div>
          )}

          {/* Nombre de la tarea */}
          <div className="space-y-2">
            <Label htmlFor="taskName">Nombre de la tarea *</Label>
            <Input
              id="taskName"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="Ej: Crear wireframes iniciales"
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="taskDescription">Descripción</Label>
            <Textarea
              id="taskDescription"
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="Descripción detallada de la tarea..."
              rows={3}
            />
          </div>

          {/* Equipo */}
          <div className="space-y-2">
            <Label>Equipo asignado *</Label>
            <Select
              value={formData.team}
              onValueChange={(value) => handleFieldChange('team', value)}
            >
              <SelectTrigger className={errors.team ? 'border-destructive' : ''}>
                <SelectValue placeholder="Seleccionar equipo">
                  {formData.team && (
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: teamColors[formData.team] || teamColors.Default }}
                      />
                      {formData.team}
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableTeams.map((team) => (
                  <SelectItem key={team} value={team}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: teamColors[team] || teamColors.Default }}
                      />
                      {team}
                    </div>
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
              Sprint asignado
            </Label>
            <Select
              value={formData.sprint}
              onValueChange={(value) => handleFieldChange('sprint', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar sprint (opcional)">
                  {formData.sprint && formData.sprint}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin sprint asignado</SelectItem>
                {availableSprints.map((sprint) => (
                  <SelectItem key={sprint} value={sprint}>
                    {sprint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duración */}
          <div className="space-y-2">
            <Label htmlFor="duration" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Duración en días laborables *
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
              <span className="text-sm text-muted-foreground">días</span>
            </div>
            {errors.durationDays && (
              <p className="text-sm text-destructive">{errors.durationDays}</p>
            )}
            <p className="text-xs text-muted-foreground">
              No incluye fines de semana en el cálculo
            </p>
          </div>

          {/* Badges del equipo y sprint actuales */}
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
                {formData.team || 'Sin equipo'}
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

        {/* Botones de acción */}
        <div className="flex gap-2 pt-4">
          <Button 
            onClick={handleSave}
            className="flex-1 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Guardar cambios
          </Button>
          <Button 
            variant="outline" 
            onClick={onClose}
            className="flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}