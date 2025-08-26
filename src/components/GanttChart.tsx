import React, { useState, useCallback } from 'react';
import { JsonImportExport } from './JsonImportExport';
import { GanttTimeline } from './GanttTimeline';
import { MonthlyGanttTimeline } from './MonthlyGanttTimeline';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Milestone, Task, calculateProjectDates, teamColors } from '../utils/dateUtils';
import { BarChart3, Calendar, Users, Clock, Grid3X3, List, ChevronDown, ChevronUp } from 'lucide-react';

export function GanttChart() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [projectStartDate, setProjectStartDate] = useState<Date>(new Date('2024-08-26')); // Set to a specific date
  const [viewMode, setViewMode] = useState<'interactive' | 'monthly'>('interactive');
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());

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

  // Expand/Collapse functions
  const expandAllMilestones = useCallback(() => {
    const allMilestoneIds = new Set(milestones.map(m => m.milestoneId));
    setExpandedMilestones(allMilestoneIds);
  }, [milestones]);

  const collapseAllMilestones = useCallback(() => {
    setExpandedMilestones(new Set());
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div 
        style={{ 
          position: 'absolute',
          left: '1%',
          top: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: 'auto',
          maxWidth: '150px',
          marginBottom: '24px',
          zIndex: 10
        }}
      >
        <BarChart3 className="w-6 h-6 text-primary" />
        <h1 className="text-lg font-semibold whitespace-nowrap">Gantt</h1>
      </div>
      
      {/* Spacer para compensar el header absolute */}
      <div className="h-16"></div>

      {/* Importar/Exportar */}
      <div className="w-full">
        <JsonImportExport
        milestones={milestones}
        onImport={handleImport}
        projectStartDate={projectStartDate}
        onStartDateChange={handleStartDateChange}
        />
      </div>

      {/* Project statistics */}
      {milestones.length > 0 && (
        <div className="w-full">
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
        </div>
      )}

      {/* Team legend */}
      {milestones.length > 0 && (
        <div className="w-full">
          <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3>Project Teams</h3>
            
            {/* Control buttons */}
            <div className="flex gap-2">
              {/* Expand/Collapse buttons for Interactive view */}
              {viewMode === 'interactive' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={expandAllMilestones}
                    className="flex items-center gap-2"
                  >
                    <ChevronDown className="w-4 h-4" />
                    Expand All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={collapseAllMilestones}
                    className="flex items-center gap-2"
                  >
                    <ChevronUp className="w-4 h-4" />
                    Collapse All
                  </Button>
                </>
              )}
              
              {/* View selector */}
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
                  borderColor: teamColors[team as keyof typeof teamColors] || teamColors.Default,
                  color: teamColors[team as keyof typeof teamColors] || teamColors.Default 
                }}
              >
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: teamColors[team as keyof typeof teamColors] || teamColors.Default }}
                />
                {team}
              </Badge>
            ))}
          </div>
          </Card>
        </div>
      )}

      {/* Timeline principal */}
      {viewMode === 'interactive' ? (
        <GanttTimeline 
          milestones={milestones}
          onUpdateTask={handleUpdateTask}
          expandedMilestones={expandedMilestones}
          onToggleMilestone={(milestoneId: string) => {
            const newExpanded = new Set(expandedMilestones);
            if (newExpanded.has(milestoneId)) {
              newExpanded.delete(milestoneId);
            } else {
              newExpanded.add(milestoneId);
            }
            setExpandedMilestones(newExpanded);
          }}
        />
      ) : (
        <MonthlyGanttTimeline 
          milestones={milestones}
        />
      )}
    </div>
  );
}