import React, { useState, useCallback } from 'react';
import { JsonImportExport } from './JsonImportExport';
import { GanttTimeline } from './GanttTimeline';
import { MonthlyGanttTimeline } from './MonthlyGanttTimeline';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Milestone, Task, calculateProjectDates, teamColors } from '../utils/dateUtils';
import { BarChart3, Calendar, Users, Clock, Grid3X3, List } from 'lucide-react';

export function GanttChart() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [projectStartDate, setProjectStartDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'interactive' | 'monthly'>('interactive');

  const handleImport = useCallback((importedMilestones: Milestone[]) => {
    // Calcular fechas automáticamente
    const calculatedMilestones = calculateProjectDates(importedMilestones, projectStartDate);
    setMilestones(calculatedMilestones);
  }, [projectStartDate]);

  const handleStartDateChange = useCallback((newDate: Date) => {
    setProjectStartDate(newDate);
    // Recalcular fechas si ya hay milestones
    if (milestones.length > 0) {
      const recalculatedMilestones = calculateProjectDates(milestones, newDate);
      setMilestones(recalculatedMilestones);
    }
  }, [milestones]);

  const handleUpdateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    setMilestones(prevMilestones => {
      const updatedMilestones = prevMilestones.map(milestone => ({
        ...milestone,
        tasks: milestone.tasks.map(task => 
          task.taskId === taskId ? { ...task, ...updates } : task
        )
      }));

      // Si se están actualizando fechas manualmente (drag & drop), preservar otras fechas manuales
      if (updates.startDate || updates.endDate) {
        return calculateProjectDates(updatedMilestones, projectStartDate, true);
      }
      
      // Si se actualiza solo la duración, recalcular todo automáticamente
      if (updates.durationDays) {
        return calculateProjectDates(updatedMilestones, projectStartDate, false);
      }

      // Para otros cambios (nombre, equipo, etc.), no recalcular fechas
      return updatedMilestones;
    });
  }, [projectStartDate]);

  // Estadísticas del proyecto
  const totalTasks = milestones.reduce((acc, m) => acc + m.tasks.length, 0);
  const uniqueTeams = new Set(milestones.flatMap(m => m.tasks.map(t => t.team))).size;
  const totalDuration = milestones.reduce((acc, m) => 
    acc + Math.max(...m.tasks.map(t => t.durationDays), 0), 0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="w-8 h-8 text-primary" />
        <div>
          <h1>Gantt Chart Interactivo</h1>
          <p className="text-muted-foreground">
            Gestiona milestones, tareas y dependencias con timeline visual
          </p>
        </div>
      </div>

      {/* Importar/Exportar */}
      <JsonImportExport
        milestones={milestones}
        onImport={handleImport}
        projectStartDate={projectStartDate}
        onStartDateChange={handleStartDateChange}
      />

      {/* Estadísticas del proyecto */}
      {milestones.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Milestones</p>
                <p className="text-xl font-medium">{milestones.length}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Tareas</p>
                <p className="text-xl font-medium">{totalTasks}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Equipos</p>
                <p className="text-xl font-medium">{uniqueTeams}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Duración Total</p>
                <p className="text-xl font-medium">{totalDuration} días</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Leyenda de equipos */}
      {milestones.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3>Equipos del Proyecto</h3>
            
            {/* Selector de vista */}
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'interactive' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('interactive')}
                className="flex items-center gap-2"
              >
                <List className="w-4 h-4" />
                Vista Interactiva
              </Button>
              <Button
                variant={viewMode === 'monthly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('monthly')}
                className="flex items-center gap-2"
              >
                <Grid3X3 className="w-4 h-4" />
                Vista Mensual
              </Button>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(milestones.flatMap(m => m.tasks.map(t => t.team)))).map(team => (
              <Badge 
                key={team}
                variant="outline"
                className="flex items-center gap-2"
                style={{ 
                  borderColor: teamColors[team] || teamColors.Default,
                  color: teamColors[team] || teamColors.Default 
                }}
              >
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: teamColors[team] || teamColors.Default }}
                />
                {team}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Timeline principal */}
      {viewMode === 'interactive' ? (
        <GanttTimeline 
          milestones={milestones}
          onUpdateTask={handleUpdateTask}
        />
      ) : (
        <MonthlyGanttTimeline 
          milestones={milestones}
        />
      )}

      {/* Instrucciones */}
      {milestones.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-2">Instrucciones de uso</h3>
          <div className="space-y-3">
            <div>
              <h4 className="font-medium mb-1">Navegación</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Usa los botones "Vista Interactiva" y "Vista Mensual" para alternar entre vistas</li>
                <li>• La vista interactiva permite edición y drag & drop</li>
                <li>• La vista mensual muestra un resumen clásico por meses</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-1">Vista Mensual</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• <strong>Navegación:</strong> Usa las flechas ← → para moverte entre meses o scroll horizontal cuando estés en zoom</li>
                <li>• <strong>Zoom:</strong> Cambia entre 1, 3, 6 o 12 meses de visualización</li>
                <li>• <strong>Scroll horizontal:</strong> Cuando zoom &lt; 12 meses, puedes desplazarte horizontalmente para ver más contenido</li>
                <li>• <strong>Indicador de posición:</strong> La barra muestra tu ubicación en el timeline completo</li>
                <li>• <strong>Banderas de milestone:</strong> Triángulos rojos con cajas verdes marcan el inicio de milestones</li>
                <li>• <strong>Banderas de deliverables:</strong> Triángulos rojos pequeños marcan las fechas de entrega</li>
                <li>• Vista clásica estilo Gantt con barras de progreso y marcadores</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-1">Vista Interactiva</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Haz clic en los iconos de milestone para expandir/contraer las tareas</li>
                <li>• Arrastra las barras de tareas para cambiar fechas de inicio</li>
                <li>• Usa los bordes de las barras para cambiar la duración</li>
                <li>• <strong>Haz clic en el icono de edición</strong> en las barras para modificar nombre, equipo y duración</li>
                <li>• <strong>Banderas de deliverables:</strong> Triángulos rojos indican fechas de entrega al final de cada milestone</li>
                <li>• Pasa el mouse sobre las tareas para ver detalles en el tooltip</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-1">General</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Exporta el JSON actualizado para guardar los cambios</li>
                <li>• Los colores representan diferentes equipos del proyecto</li>
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}