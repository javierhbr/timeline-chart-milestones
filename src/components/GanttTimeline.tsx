import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { ChevronDown, ChevronRight, Calendar, Clock, Users, Edit, Zap } from 'lucide-react';
import { Milestone, Task, teamColors, generateWeeks, getTaskPosition, calculateMilestoneDates, getTaskDependencyInfo, getTimelineRange } from '../utils/dateUtils';
import { TaskEditModal } from './TaskEditModal';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface GanttTimelineProps {
  milestones: Milestone[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  expandedMilestones?: Set<string>;
  onToggleMilestone?: (milestoneId: string) => void;
}

export function GanttTimeline({ 
  milestones, 
  onUpdateTask, 
  expandedMilestones: propExpandedMilestones,
  onToggleMilestone: propOnToggleMilestone
}: GanttTimelineProps) {
  const [localExpandedMilestones, setLocalExpandedMilestones] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Use prop-controlled state if provided, otherwise use local state
  const expandedMilestones = propExpandedMilestones || localExpandedMilestones;
  const setExpandedMilestones = propOnToggleMilestone ? 
    (milestoneId: string) => propOnToggleMilestone(milestoneId) :
    (updateFn: (prev: Set<string>) => Set<string>) => setLocalExpandedMilestones(updateFn);
  const [dragState, setDragState] = useState<{
    taskId: string;
    mode: 'move' | 'resize-start' | 'resize-end';
    startX: number;
    originalStart: Date;
    originalEnd: Date;
  } | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const ganttContainerRef = useRef<HTMLDivElement>(null);

  // Pre-sort milestones by calculated start dates early in the component
  const sortedMilestones = useMemo(() => {
    return milestones
      .map((milestone, originalIndex) => ({ milestone, originalIndex }))
      .sort((a, b) => {
        const aDates = calculateMilestoneDates(a.milestone);
        const bDates = calculateMilestoneDates(b.milestone);
        return aDates.startDate.getTime() - bDates.startDate.getTime();
      });
  }, [milestones]);

  // Calculate timeline data early
  const timelineData = useMemo(() => {
    const allDates = sortedMilestones.flatMap(({ milestone }) => 
      milestone.tasks.map(t => [parseISO(t.startDate!), parseISO(t.endDate!)] )
    ).flat();
    
    if (allDates.length === 0) {
      return null;
    }

    const projectStart = new Date(Math.min(...allDates.map(d => d.getTime())));
    const projectEnd = new Date(Math.max(...allDates.map(d => d.getTime())));
    const { timelineStart, timelineEnd, totalDays } = getTimelineRange(projectStart, projectEnd);
    const weeks = generateWeeks(projectStart, projectEnd);

    return { projectStart, projectEnd, timelineStart, timelineEnd, totalDays, weeks };
  }, [sortedMilestones]);

  // Generate daily columns for the grid
  const dayColumns = useMemo(() => {
    if (!timelineData) return [];
    
    const columns: Array<{
      date: Date;
      dayOfWeek: number;
      isWeekStart: boolean;
      weekNumber: number;
    }> = [];
    
    for (let i = 0; i < timelineData.totalDays; i++) {
      const currentDate = addDays(timelineData.timelineStart, i);
      columns.push({
        date: currentDate,
        dayOfWeek: currentDate.getDay(),
        isWeekStart: currentDate.getDay() === 1, // Monday
        weekNumber: Math.floor(i / 7)
      });
    }
    return columns;
  }, [timelineData]);

  // Calculate grid template columns: fixed sidebar + dynamic day columns
  const gridTemplateColumns = timelineData ? `320px repeat(${timelineData.totalDays}, 1fr)` : '320px 1fr';
  // Palette for milestone colors
  const milestoneColors = [
    { main: '#fb923c', secondary: '#ea580c', gentle: 'rgba(251,146,60,0.08)', gentleHover: 'rgba(251,146,60,0.12)' },
    { main: '#22d3ee', secondary: '#0891b2', gentle: 'rgba(34,211,238,0.08)', gentleHover: 'rgba(34,211,238,0.12)' },
    { main: '#8b5cf6', secondary: '#7c3aed', gentle: 'rgba(139,92,246,0.08)', gentleHover: 'rgba(139,92,246,0.12)' },
    { main: '#10b981', secondary: '#059669', gentle: 'rgba(16,185,129,0.08)', gentleHover: 'rgba(16,185,129,0.12)' },
    { main: '#f59e0b', secondary: '#d97706', gentle: 'rgba(245,158,11,0.08)', gentleHover: 'rgba(245,158,11,0.12)' },
    { main: '#ef4444', secondary: '#dc2626', gentle: 'rgba(239,68,68,0.08)', gentleHover: 'rgba(239,68,68,0.12)' }
  ];

  const getMilestoneColor = (index: number) => milestoneColors[index % milestoneColors.length];

  const handleMouseDown = useCallback((
    e: React.MouseEvent,
    taskId: string,
    mode: 'move' | 'resize-start' | 'resize-end',
    taskStart: Date,
    taskEnd: Date
  ) => {
    e.preventDefault();
    setDragState({ taskId, mode, startX: e.clientX, originalStart: taskStart, originalEnd: taskEnd });
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState || !timelineRef.current || !timelineData) return;

    // Use fixed day width of 32px instead of calculating from container width
    const pixelsPerDay = 32;
    const deltaX = e.clientX - dragState.startX;
    const daysDelta = Math.round(deltaX / pixelsPerDay);

    // visual-only; commit on mouseup
  }, [dragState, timelineData]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!dragState || !timelineRef.current || !timelineData) return;

    // Use fixed day width of 32px instead of calculating from container width
    const pixelsPerDay = 32;
    const deltaX = e.clientX - dragState.startX;
    const daysDelta = Math.round(deltaX / pixelsPerDay);

    let newStart = dragState.originalStart;
    let newEnd = dragState.originalEnd;

    if (dragState.mode === 'move') {
      newStart = addDays(dragState.originalStart, daysDelta);
      newEnd = addDays(dragState.originalEnd, daysDelta);
    } else if (dragState.mode === 'resize-start') {
      newStart = addDays(dragState.originalStart, daysDelta);
      if (newStart >= dragState.originalEnd) newStart = addDays(dragState.originalEnd, -1);
    } else if (dragState.mode === 'resize-end') {
      newEnd = addDays(dragState.originalEnd, daysDelta);
      if (newEnd <= dragState.originalStart) newEnd = addDays(dragState.originalStart, 1);
    }

    const newDuration = differenceInDays(newEnd, newStart) + 1;

    onUpdateTask(dragState.taskId, {
      startDate: format(newStart, 'yyyy-MM-dd'),
      endDate: format(newEnd, 'yyyy-MM-dd'),
      durationDays: newDuration
    });

    setDragState(null);
  }, [dragState, timelineData, onUpdateTask]);

  useEffect(() => {
    if (!dragState) return;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, handleMouseMove, handleMouseUp]);

  // Early return if no timeline data
  if (!timelineData) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No tasks to display in the timeline</p>
      </Card>
    );
  }

  const { projectStart, projectEnd, timelineStart, timelineEnd, totalDays, weeks } = timelineData;

  const deliverableMarkers = sortedMilestones
    .map(({ milestone }) => milestone)
    .filter(m => m.endDate)
    .map(m => {
      const deliverableDate = parseISO(m.endDate!);
      const daysDiff = differenceInDays(deliverableDate, timelineStart);
      const position = (daysDiff / totalDays) * 100;
      return { name: m.milestoneName, date: deliverableDate, position: Math.max(0, Math.min(100, position)) };
    });

  const toggleMilestone = (milestoneId: string) => {
    if (propOnToggleMilestone) {
      // Use parent's toggle function if provided
      propOnToggleMilestone(milestoneId);
    } else {
      // Use local state
      setLocalExpandedMilestones(prev => {
        const newExpanded = new Set(prev);
        if (newExpanded.has(milestoneId)) {
          newExpanded.delete(milestoneId);
        } else {
          newExpanded.add(milestoneId);
        }
        return newExpanded;
      });
    }
  };


  const TaskBar = ({ task }: { task: Task }) => {
    const taskStart = parseISO(task.startDate!);
    const taskEnd = parseISO(task.endDate!);
    const teamColor = teamColors[task.team] || teamColors.Default;
    const allMilestonesForDeps = sortedMilestones.map(({ milestone }) => milestone);
    const dependencyInfo = getTaskDependencyInfo(task, allMilestonesForDeps);

    const handleEditClick = (e: React.MouseEvent) => { 
      e.stopPropagation(); 
      setEditingTask(task); 
      setIsEditModalOpen(true); 
    };

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="w-full h-6 rounded-lg cursor-move flex items-center justify-between shadow-sm border border-white/20 group"
              style={{
                background: `linear-gradient(135deg, ${teamColor} 0%, ${teamColor}dd 100%)`,
                minWidth: '30px'
              }}
              onMouseDown={(e) => handleMouseDown(e, task.taskId, 'move', taskStart, taskEnd)}
            >
              <div 
                className="w-3 h-full bg-white/30 cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity rounded-l-lg flex items-center justify-center" 
                onMouseDown={(e) => { 
                  e.stopPropagation(); 
                  handleMouseDown(e, task.taskId, 'resize-start', taskStart, taskEnd); 
                }}
              >
                <div className="w-1 h-4 bg-white/60 rounded-full"></div>
              </div>
              
              <div className="flex-1 px-3 text-white text-sm font-medium truncate flex items-center gap-2">
                {dependencyInfo.hasDependencies && (
                  <svg className="w-3 h-3 flex-shrink-0 opacity-90" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 1l3 3h-2v8h-2V4H5l3-3z"/>
                  </svg>
                )}
                <span className="truncate">{task.name}</span>
              </div>
              
              <button 
                onClick={handleEditClick} 
                className="w-6 h-6 bg-white/30 hover:bg-white/50 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center mr-1" 
                title="Edit task"
              >
                <Edit className="w-3 h-3 text-white" />
              </button>
              
              <div 
                className="w-3 h-full bg-white/30 cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity rounded-r-lg flex items-center justify-center" 
                onMouseDown={(e) => { 
                  e.stopPropagation(); 
                  handleMouseDown(e, task.taskId, 'resize-end', taskStart, taskEnd); 
                }}
              >
                <div className="w-1 h-4 bg-white/60 rounded-full"></div>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">
            <div className="space-y-3">
              <div className="font-medium">{task.name}</div>
              <div className="text-sm text-muted-foreground">{task.description}</div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <Badge variant="outline" style={{ borderColor: teamColor, color: teamColor }}>
                    {task.team}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span className="text-xs">{task.durationDays} days</span>
                </div>
              </div>
              {task.sprint && (
                <div className="flex items-center gap-1 text-sm">
                  <Zap className="w-3 h-3" />
                  <Badge variant="secondary">{task.sprint}</Badge>
                </div>
              )}
              <div className="flex items-center gap-1 text-sm">
                <Calendar className="w-3 h-3" />
                {format(taskStart, 'dd/MM/yyyy', { locale: es })} - {format(taskEnd, 'dd/MM/yyyy', { locale: es })}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <>
      <div className="w-[95vw] mx-0">
        <Card className="overflow-hidden">
          <div className="border-b bg-yellow-50 p-2 text-xs">
            <div className="flex gap-4">
              <span>Project: {format(projectStart, 'dd/MM/yyyy')} - {format(projectEnd, 'dd/MM/yyyy')}</span>
              <span>Timeline: {format(timelineStart, 'dd/MM/yyyy')} - {format(timelineEnd, 'dd/MM/yyyy')}</span>
              <span>Total Days: {totalDays}</span>
              <span>Total Milestones: {sortedMilestones.length}</span>
              <span>First Milestone Duration: {differenceInDays(calculateMilestoneDates(sortedMilestones[0]?.milestone).endDate, calculateMilestoneDates(sortedMilestones[0]?.milestone).startDate)} days</span>
            </div>
          </div>

          {/* Unified Table with Fixed First Column */}
          <div className="overflow-x-auto" ref={ganttContainerRef}>
            <table className="w-full border-collapse">
              {/* Table Header */}
              <thead>
                <tr>
                  {/* Fixed Header Column */}
                  <th className="w-80 bg-muted/50 border-r sticky left-0 z-20">
                    <div className="p-4 text-left">
                      <h3 className="text-lg font-semibold">Milestones and Tasks</h3>
                      <p className="text-sm text-muted-foreground mt-1">Project hierarchical organization</p>
                    </div>
                  </th>
                  
                  {/* Day Headers - one column per day */}
                  {dayColumns.map((day, index) => (
                    <th 
                      key={`day-${index}`}
                      className={`bg-muted/50 px-1 py-2 text-center relative w-8 min-w-[32px] text-xs ${day.isWeekStart ? 'border-l-2 border-l-blue-500' : ''}`}
                    >
                      {/* Show week label only on first day of week */}
                      {day.isWeekStart && (
                        <div className="text-[10px] font-medium">
                          Sem {day.weekNumber + 1}
                        </div>
                      )}
                      <div className="text-[8px] text-muted-foreground">
                        {format(day.date, 'dd', { locale: es })}
                      </div>
                      
                      {/* Deliverable markers for this specific day */}
                      {deliverableMarkers
                        .filter(marker => {
                          const markerDay = differenceInDays(marker.date, timelineStart);
                          return markerDay === index;
                        })
                        .map((marker, markerIndex) => (
                          <div 
                            key={`deliverable-${index}-${markerIndex}`} 
                            className="absolute top-0 left-1/2 transform -translate-x-1/2 flex flex-col items-center z-30 pointer-events-none" 
                          >
                            <div className="flex flex-col items-center">
                              <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[8px] border-t-red-600 drop-shadow-sm"></div>
                              <div className="w-0.5 h-12 bg-red-600"></div>
                            </div>
                            <div className="absolute top-6 bg-white border border-gray-300 rounded-md px-1 py-0.5 text-[10px] whitespace-nowrap shadow-lg opacity-0 hover:opacity-100 transition-opacity pointer-events-auto z-40">
                              <div className="font-medium text-gray-900">Deliverable</div>
                              <div className="text-gray-600 text-[8px]">{marker.name}</div>
                              <div className="text-gray-500 text-[8px]">{format(marker.date, 'd MMM yyyy', { locale: es })}</div>
                            </div>
                          </div>
                        ))
                      }
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody ref={timelineRef}>
                {sortedMilestones.map(({ milestone, originalIndex }) => {
                  const milestoneColor = getMilestoneColor(originalIndex);
                  const milestoneDates = calculateMilestoneDates(milestone);
                  const milestoneStartDay = differenceInDays(milestoneDates.startDate, timelineStart);
                  const milestoneDurationDays = differenceInDays(milestoneDates.endDate, milestoneDates.startDate) + 1;

                  return (
                    <React.Fragment key={milestone.milestoneId}>
                      {/* Milestone Row */}
                      <tr 
                        className="border-b min-h-[60px] relative" 
                        style={{ 
                          backgroundColor: milestoneColor.gentle,
                          borderLeft: `4px solid ${milestoneColor.main}`
                        }}
                      >
                        {/* Milestone Info Cell */}
                        <td className="w-80 border-r bg-background sticky left-0 z-10">
                          <div className="p-4">
                            <button 
                              onClick={() => toggleMilestone(milestone.milestoneId)} 
                              className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded-lg p-3 transition-colors"
                            >
                              {expandedMilestones.has(milestone.milestoneId) ? 
                                <ChevronDown className="w-5 h-5 text-primary" /> : 
                                <ChevronRight className="w-5 h-5 text-primary" />
                              }
                              <div>
                                <div className="font-semibold text-base">{milestone.milestoneName}</div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  {format(milestoneDates.startDate, 'dd/MM', { locale: es })} - {format(milestoneDates.endDate, 'dd/MM', { locale: es })}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {milestone.tasks.length} task{milestone.tasks.length !== 1 ? 's' : ''}
                                </div>
                              </div>
                            </button>
                          </div>
                        </td>

                        {/* Milestone Timeline Cells */}
                        {dayColumns.map((day, dayIndex) => {
                          const isInMilestone = dayIndex >= milestoneStartDay && dayIndex < milestoneStartDay + milestoneDurationDays;
                          const isFirstDay = dayIndex === milestoneStartDay;
                          
                          return (
                            <td 
                              key={`milestone-${milestone.milestoneId}-day-${dayIndex}`}
                              className="p-0 h-[60px] relative w-8 min-w-[32px]"
                              style={{ 
                                backgroundColor: isInMilestone ? milestoneColor.gentle : 'transparent'
                              }}
                            >
                              {isFirstDay && (
                                <div 
                                  className="absolute inset-y-1 rounded-lg shadow-lg border-2 border-white/40 overflow-hidden z-10 flex items-center px-2" 
                                  style={{ 
                                    left: '2px',
                                    width: `${milestoneDurationDays * 32 - 4}px`,
                                    background: `linear-gradient(135deg, ${milestoneColor.main} 0%, ${milestoneColor.secondary} 100%)`,
                                    minWidth: '60px',
                                    maxWidth: `${milestoneDurationDays * 32 - 4}px`
                                  }}
                                >
                                  <div className="flex items-center gap-2 text-white">
                                    <span className="text-sm font-bold truncate">{milestone.milestoneName}</span>
                                  </div>
                                  <div className="absolute inset-0 bg-gradient-to-r from-white/15 to-transparent rounded-lg"></div>
                                  <div className="absolute left-0 top-0 w-1 h-full bg-white/40 rounded-l-lg"></div>
                                  <div className="absolute right-0 top-0 w-1 h-full bg-white/40 rounded-r-lg"></div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Task Rows */}
                      {expandedMilestones.has(milestone.milestoneId) && milestone.tasks.map((task) => {
                        const taskStart = parseISO(task.startDate!);
                        const taskEnd = parseISO(task.endDate!);
                        const taskStartDay = differenceInDays(taskStart, timelineStart);
                        const taskDurationDays = differenceInDays(taskEnd, taskStart) + 1;
                        const teamColor = teamColors[task.team] || teamColors.Default;

                        return (
                          <tr 
                            key={task.taskId} 
                            className="border-b min-h-[32px] relative hover:bg-muted/25 transition-colors" 
                            data-task-id={task.taskId}
                          >
                            {/* Task Info Cell */}
                            <td className="w-80 border-r bg-background sticky left-0 z-10">
                              <div className="p-2">
                                <div className="pl-8">
                                  <div className="flex items-start gap-3">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <div className="font-medium text-sm">{task.name}</div>
                                        <Badge 
                                          variant="outline" 
                                          style={{ 
                                            borderColor: teamColor, 
                                            color: teamColor 
                                          }} 
                                          className="text-xs"
                                        >
                                          {task.team}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">{task.durationDays} days</span>
                                      </div>
                                      <div className="text-xs text-muted-foreground mt-1">{task.description}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Task Timeline Cells */}
                            {dayColumns.map((day, dayIndex) => {
                              const isFirstDay = dayIndex === taskStartDay;
                              const isTaskBarDay = dayIndex >= taskStartDay && dayIndex < taskStartDay + taskDurationDays;
                              
                              return (
                                <td 
                                  key={`task-${task.taskId}-day-${dayIndex}`}
                                  className="p-0 h-[32px] relative w-8 min-w-[32px]"
                                >
                                  {isFirstDay && (
                                    <>
                                      {/* Draggable Task Bar */}
                                      <div 
                                        className="absolute inset-y-1 z-10 flex items-center transition-all duration-300" 
                                        style={{ 
                                          left: '2px',
                                          width: `${Math.min(taskDurationDays * 32 - 4, (dayColumns.length - dayIndex) * 32 - 4)}px`,
                                          minWidth: `${Math.min(30, (dayColumns.length - dayIndex) * 32 - 4)}px`
                                        }}
                                      >
                                        <TaskBar task={task} />
                                      </div>
                                      
                                      {/* Task name and dates to the right */}
                                      <div 
                                        className="absolute top-1/2 -translate-y-1/2 z-5 flex items-center gap-2 text-xs whitespace-nowrap pointer-events-none"
                                        style={{ 
                                          left: `${Math.min(taskDurationDays * 32, (dayColumns.length - dayIndex) * 32) + 8}px`
                                        }}
                                      >
                                        <span className="font-medium text-gray-700">{task.name}</span>
                                        <span className="text-blue-600 text-xs">
                                          {format(taskStart, 'dd/MM', { locale: es })} - {format(taskEnd, 'dd/MM', { locale: es })}
                                        </span>
                                      </div>
                                      
                                    </>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {sortedMilestones.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              Import a project to view the timeline
            </div>
          )}
        </Card>
      </div>

      <TaskEditModal 
        task={editingTask} 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        onSave={onUpdateTask} 
      />
    </>
  );
}