import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { ChevronDown, ChevronRight, Calendar, Clock, Users, Edit, Zap, Link } from 'lucide-react';
import { Milestone, Task, teamColors, generateWeeks, getTaskPosition, calculateMilestoneDates, getTaskDependencyInfo, getTimelineRange } from '../utils/dateUtils';
import { TaskEditModal } from './TaskEditModal';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface GanttTimelineProps {
  milestones: Milestone[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
}

export function GanttTimeline({ milestones, onUpdateTask }: GanttTimelineProps) {
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [dragState, setDragState] = useState<{
    taskId: string;
    mode: 'move' | 'resize-start' | 'resize-end';
    startX: number;
    originalStart: Date;
    originalEnd: Date;
  } | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const ganttContainerRef = useRef<HTMLDivElement>(null);
  const [taskRowPositions, setTaskRowPositions] = useState<Record<string, number>>({});

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
    if (!dragState || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const timelineWidth = rect.width;

    const allDates = milestones.flatMap(m => m.tasks.map(t => [parseISO(t.startDate!), parseISO(t.endDate!)] )).flat();
    if (allDates.length === 0) return;

    const projectStart = new Date(Math.min(...allDates.map(d => d.getTime())));
    const projectEnd = new Date(Math.max(...allDates.map(d => d.getTime())));
    const totalDays = differenceInDays(projectEnd, projectStart) + 1;

    const pixelsPerDay = timelineWidth / totalDays;
    const deltaX = e.clientX - dragState.startX;
    const daysDelta = Math.round(deltaX / pixelsPerDay);

    // visual-only; commit on mouseup
  }, [dragState, milestones]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!dragState || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const timelineWidth = rect.width;

    const allDates = milestones.flatMap(m => m.tasks.map(t => [parseISO(t.startDate!), parseISO(t.endDate!)] )).flat();
    if (allDates.length === 0) return;

    const projectStart = new Date(Math.min(...allDates.map(d => d.getTime())));
    const projectEnd = new Date(Math.max(...allDates.map(d => d.getTime())));
    const totalDays = differenceInDays(projectEnd, projectStart) + 1;

    const pixelsPerDay = timelineWidth / totalDays;
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
  }, [dragState, milestones, onUpdateTask]);

  useEffect(() => {
    if (!dragState) return;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, handleMouseMove, handleMouseUp]);

  // Measure timeline rect and task positions for proper alignment
  useEffect(() => {
    const measureTaskPositions = () => {
      if (!ganttContainerRef.current || !timelineRef.current) return;
      
      const containerRect = ganttContainerRef.current.getBoundingClientRect();
      const timelineRect = timelineRef.current.getBoundingClientRect();
      const newPositions: Record<string, number> = {};
      
      // Store timeline offset and width for horizontal positioning
      const timelineOffset = timelineRect.left - containerRect.left;
      const timelineWidth = timelineRect.width;
      
      // Find all task rows and measure their vertical positions
      const taskRows = ganttContainerRef.current.querySelectorAll('[data-task-id]');
      taskRows.forEach((row) => {
        const taskId = row.getAttribute('data-task-id');
        if (taskId) {
          const rowRect = row.getBoundingClientRect();
          // Calculate position relative to the gantt container
          newPositions[taskId] = rowRect.top - containerRect.top;
        }
      });
      
      setTaskRowPositions({ 
        ...newPositions, 
        _timelineOffset: timelineOffset,
        _timelineWidth: timelineWidth
      });
    };

    // Use a small delay to ensure DOM has updated
    const timeoutId = setTimeout(measureTaskPositions, 50);
    window.addEventListener('resize', measureTaskPositions);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', measureTaskPositions);
    };
  }, [expandedMilestones, milestones]); // Re-measure when milestones expand/collapse OR when milestone data changes

  const allDates = milestones.flatMap(m => m.tasks.map(t => [parseISO(t.startDate!), parseISO(t.endDate!)] )).flat();
  if (allDates.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No hay tareas para mostrar en el timeline</p>
      </Card>
    );
  }

  const projectStart = new Date(Math.min(...allDates.map(d => d.getTime())));
  const projectEnd = new Date(Math.max(...allDates.map(d => d.getTime())));

  const { timelineStart, timelineEnd, totalDays } = getTimelineRange(projectStart, projectEnd);
  const weeks = generateWeeks(projectStart, projectEnd);

  const deliverableMarkers = milestones
    .filter(m => m.endDate)
    .map(m => {
      const deliverableDate = parseISO(m.endDate!);
      const daysDiff = differenceInDays(deliverableDate, timelineStart);
      const position = (daysDiff / totalDays) * 100;
      return { name: m.milestoneName, date: deliverableDate, position: Math.max(0, Math.min(100, position)) };
    });

  const toggleMilestone = (milestoneId: string) => {
    const newExpanded = new Set(expandedMilestones);
    if (newExpanded.has(milestoneId)) newExpanded.delete(milestoneId);
    else newExpanded.add(milestoneId);
    setExpandedMilestones(newExpanded);
  };

  const TaskBar = ({ task, topOffset }: { task: Task; topOffset?: number }) => {
    const taskStart = parseISO(task.startDate!);
    const taskEnd = parseISO(task.endDate!);
    const position = getTaskPosition(taskStart, taskEnd, timelineStart, totalDays);
    const teamColor = teamColors[task.team] || teamColors.Default;
    const dependencyInfo = getTaskDependencyInfo(task, milestones);

    const handleEditClick = (e: React.MouseEvent) => { e.stopPropagation(); setEditingTask(task); setIsEditModalOpen(true); };

    // If topOffset is provided, this is rendered in the global overlay
    const isInOverlay = topOffset !== undefined;
    // Get timeline offset and width for proper horizontal alignment
    const timelineOffset = taskRowPositions._timelineOffset || 0;
    const timelineWidth = taskRowPositions._timelineWidth || (timelineRef.current?.offsetWidth || 0);
    
    // Calculate actual pixel positions for precise alignment
    const leftPixels = timelineOffset + (position.left * timelineWidth / 100);
    const widthPixels = position.width * timelineWidth / 100;
    const showNameInside = widthPixels > 120; // Show name inside if width is greater than 120px

    return (
      <div className="relative">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="absolute h-8 rounded-lg cursor-move flex items-center justify-between shadow-sm border border-white/20 group"
                style={{
                  left: isInOverlay ? `${leftPixels}px` : `${position.left}%`,
                  width: isInOverlay ? `${widthPixels}px` : `${position.width}%`,
                  top: isInOverlay ? `${topOffset + 10}px` : undefined, // Move higher in the task row
                  background: `linear-gradient(135deg, ${teamColor} 0%, ${teamColor}dd 100%)`,
                  minWidth: '30px'
                }}
                onMouseDown={(e) => handleMouseDown(e, task.taskId, 'move', taskStart, taskEnd)}
              >
                <div className="w-3 h-full bg-white/30 cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity rounded-l-lg flex items-center justify-center" onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, task.taskId, 'resize-start', taskStart, taskEnd); }}>
                  <div className="w-1 h-4 bg-white/60 rounded-full"></div>
                </div>
                {showNameInside && (
                  <div className="flex-1 px-3 text-white text-sm font-medium truncate flex items-center gap-2">
                    {dependencyInfo.hasDependencies && (
                      <svg className="w-3 h-3 flex-shrink-0 opacity-90" fill="currentColor" viewBox="0 0 16 16"><path d="M8 1l3 3h-2v8h-2V4H5l3-3z"/></svg>
                    )}
                    <span className="truncate">{task.name}</span>
                  </div>
                )}
                {!showNameInside && <div className="flex-1"></div>}
                <button onClick={handleEditClick} className="w-6 h-6 bg-white/30 hover:bg-white/50 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center mr-1" title="Editar tarea">
                  <Edit className="w-3 h-3 text-white" />
                </button>
                <div className="w-3 h-full bg-white/30 cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity rounded-r-lg flex items-center justify-center" onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, task.taskId, 'resize-end', taskStart, taskEnd); }}>
                  <div className="w-1 h-4 bg-white/60 rounded-full"></div>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <div className="space-y-3">
                <div className="font-medium">{task.name}</div>
                <div className="text-sm text-muted-foreground">{task.description}</div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1"><Users className="w-3 h-3" /><Badge variant="outline" style={{ borderColor: teamColor, color: teamColor }}>{task.team}</Badge></div>
                  <div className="flex items-center gap-1"><Clock className="w-3 h-3" /><span className="text-xs">{task.durationDays} días</span></div>
                </div>
                {task.sprint && <div className="flex items-center gap-1 text-sm"><Zap className="w-3 h-3" /><Badge variant="secondary">{task.sprint}</Badge></div>}
                <div className="flex items-center gap-1 text-sm"><Calendar className="w-3 h-3" />{format(taskStart, 'dd/MM/yyyy', { locale: es })} - {format(taskEnd, 'dd/MM/yyyy', { locale: es })}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Info section to the right of the task bar - always visible */}
        <div className="absolute z-20 pointer-events-none" style={{ 
          left: isInOverlay ? `${leftPixels + widthPixels + 8}px` : `calc(${position.left + position.width}% + 8px)`, 
          width: 'auto',
          minWidth: '120px',
          top: isInOverlay ? `${topOffset + 10}px` : '0px'
        }}>
          <div className="text-xs space-y-1 bg-white/80 backdrop-blur-sm rounded p-1">
            {/* Show task name with arrow icon if it doesn't fit inside the bar */}
            {!showNameInside && (
              <div className="flex items-center gap-1 text-gray-700 whitespace-nowrap">
                <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
                </svg>
                <span className="text-xs font-medium">{task.name}</span>
              </div>
            )}
            {/* Always show calendar dates */}
            <div className="flex items-center gap-1 text-blue-500">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              <span className="text-xs">{format(taskStart, 'dd/MM', { locale: es })} - {format(taskEnd, 'dd/MM', { locale: es })}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card className="overflow-hidden">
        <div className="border-b bg-yellow-50 p-2 text-xs">
          <div className="flex gap-4">
            <span>Project: {format(projectStart, 'dd/MM/yyyy')} - {format(projectEnd, 'dd/MM/yyyy')}</span>
            <span>Timeline: {format(timelineStart, 'dd/MM/yyyy')} - {format(timelineEnd, 'dd/MM/yyyy')}</span>
            <span>Total Days: {totalDays}</span>
          </div>
        </div>

        <div className="border-b bg-muted/50">
          <div className="flex">
            <div className="w-80 border-r bg-background">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold">Milestones y Tareas</h3>
                <p className="text-sm text-muted-foreground mt-1">Organización jerárquica del proyecto</p>
              </div>
            </div>
            <div className="flex-1 p-6">
              <div className="mb-2">
                <h3 className="text-lg font-semibold">Timeline del Proyecto</h3>
                <p className="text-sm text-muted-foreground">Distribución temporal por semanas</p>
              </div>
              <div className="flex bg-background/50 rounded-lg p-2 relative" ref={timelineRef}>
                {weeks.map((week, index) => (
                  <div key={index} className="flex-1 text-center text-sm border-r last:border-r-0 px-3 py-2 hover:bg-muted/30 rounded transition-colors" style={{ minWidth: `${100 / weeks.length}%` }}>
                    <div className="font-medium">{week.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{format(week.weekStart, 'dd/MM', { locale: es })}</div>
                  </div>
                ))}

                {deliverableMarkers.map((marker, index) => (
                  <div key={`deliverable-${index}`} className="absolute top-0 flex flex-col items-center z-30 pointer-events-none" style={{ left: `${marker.position}%`, transform: 'translateX(-50%)' }}>
                    <div className="flex flex-col items-center">
                      <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-red-600 drop-shadow-sm"></div>
                      <div className="w-0.5 h-2 bg-red-600"></div>
                    </div>
                    <div className="absolute top-3 bg-white border border-gray-300 rounded-md px-2 py-1 text-xs whitespace-nowrap shadow-lg opacity-0 hover:opacity-100 transition-opacity pointer-events-auto z-40">
                      <div className="font-medium text-gray-900">Deliverable</div>
                      <div className="text-gray-600 text-[10px]">{marker.name}</div>
                      <div className="text-gray-500 text-[10px]">{format(marker.date, 'd MMM yyyy', { locale: es })}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-y-visible relative" id="gantt-timeline-container" ref={ganttContainerRef}>
          {/* Global overlay for task bars positioned relative to timeline */}
          <div className="absolute inset-0 pointer-events-none z-20">
            {milestones.flatMap(milestone => 
              expandedMilestones.has(milestone.milestoneId) 
                ? milestone.tasks.filter(task => task.startDate && task.endDate && taskRowPositions[task.taskId] !== undefined)
                    .map(task => (
                      <div key={`overlay-${task.taskId}`} className="pointer-events-auto">
                        <TaskBar task={task} topOffset={taskRowPositions[task.taskId]} />
                      </div>
                    ))
                : []
            )}
          </div>
          {milestones.map((milestone, milestoneIndex) => {
            const milestoneColor = getMilestoneColor(milestoneIndex);
            const milestoneDates = calculateMilestoneDates(milestone);
            const milestonePosition = getTaskPosition(milestoneDates.startDate, milestoneDates.endDate, timelineStart, totalDays);

            return (
              <div key={milestone.milestoneId} className="transition-colors duration-200 relative" style={{ borderLeft: `4px solid ${milestoneColor.main}` }}>
                <div className="flex border-b min-h-[60px] relative z-10" style={{ backgroundColor: milestoneColor.gentle }}>
                  <div className="w-80 p-4 border-r bg-background">
                    <button onClick={() => toggleMilestone(milestone.milestoneId)} className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded-lg p-3 transition-colors">
                      {expandedMilestones.has(milestone.milestoneId) ? <ChevronDown className="w-5 h-5 text-primary" /> : <ChevronRight className="w-5 h-5 text-primary" />}
                      <div>
                        <div className="font-semibold text-base">{milestone.milestoneName}</div>
                        <div className="text-sm text-muted-foreground mt-1">{format(milestoneDates.startDate, 'dd/MM', { locale: es })} - {format(milestoneDates.endDate, 'dd/MM', { locale: es })}</div>
                        <div className="text-xs text-muted-foreground">{milestone.tasks.length} tarea{milestone.tasks.length !== 1 ? 's' : ''}</div>
                      </div>
                    </button>
                  </div>

                  <div className="flex-1 relative p-2 flex items-center" style={{ backgroundColor: 'transparent' }}>
                    <div className="absolute inset-y-0 pointer-events-none z-0" style={{ left: `${milestonePosition.left}%`, width: `${milestonePosition.width}%`, background: `linear-gradient(90deg, ${milestoneColor.gentle} 0%, ${milestoneColor.gentle} 100%)`, opacity: 0.6 }} />

                    <div className="h-10 rounded-lg shadow-lg border-2 border-white/40 relative overflow-hidden z-10" style={{ position: 'absolute', left: `${milestonePosition.left}%`, width: `${milestonePosition.width}%`, background: `linear-gradient(135deg, ${milestoneColor.main} 0%, ${milestoneColor.secondary} 100%)`, minWidth: '120px' }}>
                      <div className="h-full w-full bg-white/20 rounded-lg flex items-center justify-between px-4 backdrop-blur-sm">
                        <div className="flex items-center gap-2"><Link className="w-3 h-3 text-white flex-shrink-0 opacity-90" /><span className="text-white text-sm font-bold truncate">{milestone.milestoneName}</span></div>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-r from-white/15 to-transparent rounded-lg"></div>
                      <div className="absolute left-0 top-0 w-1 h-full bg-white/40 rounded-l-lg"></div>
                      <div className="absolute right-0 top-0 w-1 h-full bg-white/40 rounded-r-lg"></div>
                    </div>

                    <div className="absolute top-16 z-20 pointer-events-none" style={{ left: `${milestonePosition.left + 2}%`, width: `${milestonePosition.width}%`, minWidth: '120px', top: '75px' }}>
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-1 text-blue-500"><Calendar className="w-3 h-3 flex-shrink-0" /><span className="text-xs">{format(milestoneDates.startDate, 'dd/MM', { locale: es })} - {format(milestoneDates.endDate, 'dd/MM', { locale: es })}</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                {expandedMilestones.has(milestone.milestoneId) && milestone.tasks.map((task) => (
                  <div key={task.taskId} className="flex border-b transition-colors min-h-[50px] relative z-10" style={{ backgroundColor: 'transparent' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = milestoneColor.gentleHover; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }} data-task-id={task.taskId}>
                    <div className="w-80 p-4 border-r bg-background">
                      <div className="pl-8">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-sm">{task.name}</div>
                              <Badge variant="outline" style={{ borderColor: teamColors[task.team] || teamColors.Default, color: teamColors[task.team] || teamColors.Default }} className="text-xs">
                                {task.team}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{task.durationDays} días</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">{task.description}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 relative p-2 flex items-center" style={{ minHeight: '50px', backgroundColor: 'transparent' }}>
                      {/* Task bar is now rendered in the global overlay above */}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {milestones.length === 0 && <div className="p-8 text-center text-muted-foreground">Importa un proyecto para ver el timeline</div>}
      </Card>

      <TaskEditModal task={editingTask} isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSave={onUpdateTask} />
    </>
  );
}