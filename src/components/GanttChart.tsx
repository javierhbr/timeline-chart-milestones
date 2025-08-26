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
    // Calculate dates automatically
    const calculatedMilestones = calculateProjectDates(importedMilestones, projectStartDate);
    setMilestones(calculatedMilestones);
  }, [projectStartDate]);

  const handleStartDateChange = useCallback((newDate: Date) => {
    setProjectStartDate(newDate);
    // Recalculate dates if milestones already exist
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

      // If manually updating dates (drag & drop), preserve other manual dates
      if (updates.startDate || updates.endDate) {
        return calculateProjectDates(updatedMilestones, projectStartDate, true);
      }
      
      // If updating only duration, recalculate everything automatically
      if (updates.durationDays) {
        return calculateProjectDates(updatedMilestones, projectStartDate, false);
      }

      // For other changes (name, team, etc.), don't recalculate dates
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

      {/* Project statistics */}
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
                <p className="text-sm text-muted-foreground">Tasks</p>
                <p className="text-xl font-medium">{totalTasks}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Teams</p>
                <p className="text-xl font-medium">{uniqueTeams}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Duration</p>
                <p className="text-xl font-medium">{totalDuration} days</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Team legend */}
      {milestones.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3>Project Teams</h3>
            
            {/* View selector */}
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'interactive' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('interactive')}
                className="flex items-center gap-2"
              >
                <List className="w-4 h-4" />
                Interactive View
              </Button>
              <Button
                variant={viewMode === 'monthly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('monthly')}
                className="flex items-center gap-2"
              >
                <Grid3X3 className="w-4 h-4" />
                Monthly View
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
    </div>
  );
}