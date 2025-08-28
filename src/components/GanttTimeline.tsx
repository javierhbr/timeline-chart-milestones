import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Calendar,
  Clock,
  Users,
  Edit,
  Zap,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  GripVertical,
} from 'lucide-react';
import {
  Milestone,
  Task,
  teamColors,
  generateWeeks,
  calculateMilestoneDates,
  getTaskDependencyInfo,
  getTimelineRange,
} from '../utils/dateUtils';
import { TaskEditModal } from './TaskEditModal';
import { TaskContextMenu } from './TaskContextMenu';
import { CloneTaskDialog } from './CloneTaskDialog';
import { SplitTaskDialog } from './SplitTaskDialog';
import { MoveTaskDialog } from './MoveTaskDialog';
import { MilestoneContextMenu } from './MilestoneContextMenu';
import { MilestoneEditDialog } from './MilestoneEditDialog';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  cloneTask, 
  addClonedTaskToMilestone, 
  splitTask,
  moveTaskBetweenMilestones,
  updateDependenciesAfterSplit,
  generateUniqueTaskId,
  CloneOptions,
  SplitConfig 
} from '../utils/taskOperations';

interface GanttTimelineProps {
  milestones: Milestone[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onUpdateMilestones?: (milestones: Milestone[]) => void;
  onRecalculateTimeline?: () => void;
  expandedMilestones?: Set<string>;
  onToggleMilestone?: (milestoneId: string) => void;
  expandAllMilestones?: () => void;
  collapseAllMilestones?: () => void;
}

export function GanttTimeline({
  milestones,
  onUpdateTask,
  onUpdateMilestones,
  onRecalculateTimeline,
  expandedMilestones: propExpandedMilestones,
  onToggleMilestone: propOnToggleMilestone,
  expandAllMilestones,
  collapseAllMilestones,
}: GanttTimelineProps) {
  const [localExpandedMilestones, setLocalExpandedMilestones] = useState<
    Set<string>
  >(new Set());
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [cloneTaskState, setCloneTaskState] = useState<Task | null>(null);
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);
  const [splitTaskState, setSplitTaskState] = useState<Task | null>(null);
  const [isSplitDialogOpen, setIsSplitDialogOpen] = useState(false);
  const [moveTaskState, setMoveTaskState] = useState<Task | null>(null);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [isMilestoneEditDialogOpen, setIsMilestoneEditDialogOpen] = useState(false);
  const [creatingTaskForMilestone, setCreatingTaskForMilestone] = useState<Milestone | null>(null);
  const [isTaskCreateDialogOpen, setIsTaskCreateDialogOpen] = useState(false);
  const [currentMilestoneId, setCurrentMilestoneId] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(32); // Píxeles por día, default 32px
  const [nameColumnWidth, setNameColumnWidth] = useState<number>(200); // Width in pixels for name column

  // Use prop-controlled state if provided, otherwise use local state
  const expandedMilestones = propExpandedMilestones || localExpandedMilestones;
  // const setExpandedMilestones = propOnToggleMilestone
  //   ? (milestoneId: string) => propOnToggleMilestone(milestoneId)
  //   : (updateFn: (prev: Set<string>) => Set<string>) =>
  //       setLocalExpandedMilestones(updateFn);
  const [dragState, setDragState] = useState<{
    taskId: string;
    mode: 'move' | 'resize-start' | 'resize-end';
    startX: number;
    originalStart: Date;
    originalEnd: Date;
  } | null>(null);
  const [resizeState, setResizeState] = useState<{
    isResizing: boolean;
    startX: number;
    startWidth: number;
  } | null>(null);

  const timelineRef = useRef<HTMLTableSectionElement>(null);
  const ganttContainerRef = useRef<HTMLDivElement>(null);

  // Clone handlers
  const handleCloneTask = useCallback((task: Task) => {
    console.log('🔄 CLONE TASK HANDLER CALLED:', {
      taskName: task.name,
      taskId: task.taskId
    });
    
    const milestone = milestones.find(m => 
      m.tasks.some(t => t.taskId === task.taskId)
    );
    
    if (milestone) {
      console.log('✅ Found milestone for task, opening clone dialog:', milestone.milestoneName);
      setCurrentMilestoneId(milestone.milestoneId);
      setCloneTaskState(task);
      setIsCloneDialogOpen(true);
    } else {
      console.log('❌ Could not find milestone for task');
    }
  }, [milestones]);

  const handleConfirmClone = useCallback(async (options: CloneOptions) => {
    if (!cloneTaskState || !onUpdateMilestones) return;
    
    const clonedTaskResult = cloneTask(cloneTaskState, milestones, options);
    const updatedMilestones = addClonedTaskToMilestone(
      milestones, 
      clonedTaskResult, 
      options.targetMilestoneId
    );
    
    onUpdateMilestones(updatedMilestones);
    
    if (onRecalculateTimeline) {
      onRecalculateTimeline();
    }
  }, [cloneTaskState, milestones, onUpdateMilestones, onRecalculateTimeline]);

  const handleConfirmSplit = useCallback((config: SplitConfig) => {
    if (!splitTaskState || !onUpdateMilestones) return;
    
    console.log('✂️ SPLITTING TASK:', splitTaskState.name, 'into', config.splits.length, 'parts');
    
    // Create split tasks
    const splitTasks = splitTask(splitTaskState, milestones, config);
    
    // Remove original task and add split tasks
    const updatedMilestones = milestones.map(milestone => ({
      ...milestone,
      tasks: milestone.tasks
        .filter(t => t.taskId !== splitTaskState.taskId)
        .concat(milestone.milestoneId === currentMilestoneId ? splitTasks : [])
    }));
    
    // Update dependencies that pointed to the original task to point to the last split task
    const finalMilestones = updateDependenciesAfterSplit(
      updatedMilestones,
      splitTaskState.taskId,
      splitTasks
    );
    
    onUpdateMilestones(finalMilestones);
    
    if (onRecalculateTimeline) {
      onRecalculateTimeline();
    }
  }, [splitTaskState, milestones, currentMilestoneId, onUpdateMilestones, onRecalculateTimeline]);

  const handleConfirmMove = useCallback((fromMilestoneId: string, toMilestoneId: string) => {
    if (!moveTaskState || !onUpdateMilestones) return;
    
    console.log('🚚 MOVING TASK:', moveTaskState.name, 'from', fromMilestoneId, 'to', toMilestoneId);
    
    const updatedMilestones = moveTaskBetweenMilestones(
      milestones,
      moveTaskState.taskId,
      fromMilestoneId,
      toMilestoneId
    );
    
    onUpdateMilestones(updatedMilestones);
    
    if (onRecalculateTimeline) {
      onRecalculateTimeline();
    }
  }, [moveTaskState, milestones, onUpdateMilestones, onRecalculateTimeline]);

  // Milestone handlers
  const handleEditMilestone = useCallback((milestone: Milestone) => {
    console.log('✏️ EDIT MILESTONE CLICKED:', {
      milestoneName: milestone.milestoneName,
      milestoneId: milestone.milestoneId,
      taskCount: milestone.tasks.length
    });
    
    setEditingMilestone(milestone);
    setIsMilestoneEditDialogOpen(true);
  }, []);

  const handleConfirmMilestoneEdit = useCallback((milestoneId: string, updates: { milestoneName: string; description?: string }) => {
    if (!onUpdateMilestones) return;
    
    console.log('✅ UPDATING MILESTONE:', milestoneId, updates);
    
    const updatedMilestones = milestones.map(milestone => 
      milestone.milestoneId === milestoneId 
        ? { ...milestone, ...updates }
        : milestone
    );
    
    onUpdateMilestones(updatedMilestones);
  }, [milestones, onUpdateMilestones]);

  const handleAddTaskToMilestone = useCallback((milestone: Milestone) => {
    console.log('➕ ADD TASK TO MILESTONE CLICKED:', {
      milestoneName: milestone.milestoneName,
      milestoneId: milestone.milestoneId,
      currentTaskCount: milestone.tasks.length
    });
    
    console.log('🔧 SETTING DIALOG STATE:', {
      creatingTaskForMilestone: milestone,
      isTaskCreateDialogOpen: true,
      currentMilestoneId: milestone.milestoneId
    });
    
    setCreatingTaskForMilestone(milestone);
    setCurrentMilestoneId(milestone.milestoneId);
    setIsTaskCreateDialogOpen(true);
    
    // Debug: Check state immediately after
    setTimeout(() => {
      console.log('📊 DIALOG STATE CHECK after 100ms');
    }, 100);
  }, []);

  const handleConfirmTaskCreate = useCallback((taskId: string, updates: Partial<Task>) => {
    if (!creatingTaskForMilestone || !onUpdateMilestones) return;
    
    console.log('✅ CREATING NEW TASK:', updates.name, 'for milestone:', creatingTaskForMilestone.milestoneName);
    
    // Generate unique task ID
    const newTaskId = generateUniqueTaskId(milestones);
    
    // Create new task with all required fields
    const newTask: Task = {
      taskId: newTaskId,
      name: updates.name || 'New Task',
      description: updates.description || '',
      team: updates.team || 'Dev',
      sprint: updates.sprint || '',
      durationDays: updates.durationDays || 1,
      dependsOn: updates.dependsOn || [],
      startDate: undefined, // Will be calculated
      endDate: undefined, // Will be calculated
    };
    
    // Add task to the specific milestone
    const updatedMilestones = milestones.map(milestone => 
      milestone.milestoneId === creatingTaskForMilestone.milestoneId
        ? { ...milestone, tasks: [...milestone.tasks, newTask] }
        : milestone
    );
    
    onUpdateMilestones(updatedMilestones);
    
    if (onRecalculateTimeline) {
      onRecalculateTimeline();
    }
  }, [creatingTaskForMilestone, milestones, onUpdateMilestones, onRecalculateTimeline]);

  const handleSplitTask = useCallback((task: Task) => {
    console.log('🔪 SPLIT TASK CLICKED:', {
      taskName: task.name,
      taskId: task.taskId,
      team: task.team,
      duration: task.durationDays
    });
    
    const milestone = milestones.find(m => 
      m.tasks.some(t => t.taskId === task.taskId)
    );
    
    if (milestone) {
      setCurrentMilestoneId(milestone.milestoneId);
      setSplitTaskState(task);
      setIsSplitDialogOpen(true);
    }
  }, [milestones]);

  const handleMoveTask = useCallback((task: Task) => {
    console.log('📦 MOVE TASK CLICKED:', {
      taskName: task.name,
      taskId: task.taskId,
      currentMilestone: milestones.find(m => m.tasks.some(t => t.taskId === task.taskId))?.milestoneName,
      availableMilestones: milestones.map(m => m.milestoneName)
    });
    
    const milestone = milestones.find(m => 
      m.tasks.some(t => t.taskId === task.taskId)
    );
    
    if (milestone) {
      setCurrentMilestoneId(milestone.milestoneId);
      setMoveTaskState(task);
      setIsMoveDialogOpen(true);
    }
  }, [milestones]);

  const handleDeleteTask = useCallback((task: Task) => {
    console.log('🗑️ DELETE TASK HANDLER CALLED:', {
      taskName: task.name,
      taskId: task.taskId,
      hasUpdateMilestones: !!onUpdateMilestones
    });
    
    if (!onUpdateMilestones) {
      console.log('❌ No onUpdateMilestones handler available');
      return;
    }
    
    // Remove task from milestones
    const updatedMilestones = milestones.map(milestone => ({
      ...milestone,
      tasks: milestone.tasks.filter(t => t.taskId !== task.taskId)
    }));
    
    console.log('✅ Task deleted, updating milestones');
    onUpdateMilestones(updatedMilestones);
    
    if (onRecalculateTimeline) {
      console.log('✅ Recalculating timeline');
      onRecalculateTimeline();
    }
  }, [milestones, onUpdateMilestones, onRecalculateTimeline]);

  // Zoom functions
  const zoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(Math.round(prev * 1.5), 80)); // Max 80px por día
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(Math.round(prev / 1.5), 8)); // Min 8px por día
  }, []);

  const resetZoom = useCallback(() => {
    setZoomLevel(32); // Volver al default
  }, []);

  // Column resize handlers
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setResizeState({
        isResizing: true,
        startX: e.clientX,
        startWidth: nameColumnWidth,
      });
    },
    [nameColumnWidth]
  );

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!resizeState) return;

      const deltaX = e.clientX - resizeState.startX;
      const newWidth = Math.max(
        150,
        Math.min(600, resizeState.startWidth + deltaX)
      ); // Min 150px, Max 600px
      setNameColumnWidth(newWidth);
    },
    [resizeState]
  );

  const handleResizeEnd = useCallback(() => {
    setResizeState(null);
  }, []);

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
    const allDates = sortedMilestones
      .flatMap(({ milestone }) =>
        milestone.tasks
          .filter(t => t.startDate && t.endDate)
          .map(t => [parseISO(t.startDate!), parseISO(t.endDate!)])
      )
      .flat();

    if (allDates.length === 0) {
      return null;
    }

    const projectStart = new Date(Math.min(...allDates.map(d => d.getTime())));
    const projectEnd = new Date(Math.max(...allDates.map(d => d.getTime())));
    const { timelineStart, timelineEnd, totalDays } = getTimelineRange(
      projectStart,
      projectEnd
    );
    const weeks = generateWeeks(projectStart, projectEnd);

    return {
      projectStart,
      projectEnd,
      timelineStart,
      timelineEnd,
      totalDays,
      weeks,
    };
  }, [sortedMilestones]);

  // Generate daily columns for the grid
  const dayColumns = useMemo(() => {
    if (!timelineData) return [];

    const columns: Array<{
      date: Date;
      dayOfWeek: number;
      isWeekStart: boolean;
      weekNumber: number;
      isNewMonth: boolean;
      monthName: string;
      year: number;
    }> = [];

    let lastMonth = -1;

    for (let i = 0; i < timelineData.totalDays; i++) {
      const currentDate = addDays(timelineData.timelineStart, i);
      const currentMonth = currentDate.getMonth();
      const isNewMonth = currentMonth !== lastMonth;

      if (isNewMonth) {
        lastMonth = currentMonth;
      }

      columns.push({
        date: currentDate,
        dayOfWeek: currentDate.getDay(),
        isWeekStart: currentDate.getDay() === 1, // Monday
        weekNumber: Math.floor(i / 7),
        isNewMonth: isNewMonth,
        monthName: [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ][currentMonth],
        year: currentDate.getFullYear(),
      });
    }
    return columns;
  }, [timelineData]);

  // Column width variables
  const gridNameColumns = `${nameColumnWidth}px`;
  // const gridTimeBoxColumns = `calc(100vw - ${nameColumnWidth}px)`;
  // const gridTemplateColumns = `${gridNameColumns} ${gridTimeBoxColumns}`;

  // Palette for milestone colors
  const milestoneColors = [
    {
      main: '#fb923c',
      secondary: '#ea580c',
      gentle: 'rgba(251,146,60,0.08)',
      gentleHover: 'rgba(251,146,60,0.12)',
    },
    {
      main: '#22d3ee',
      secondary: '#0891b2',
      gentle: 'rgba(34,211,238,0.08)',
      gentleHover: 'rgba(34,211,238,0.12)',
    },

    {
      main: '#8b5cf6',
      secondary: '#7c3aed',
      gentle: 'rgba(139,92,246,0.08)',
      gentleHover: 'rgba(139,92,246,0.12)',
    },
    {
      main: '#10b981',
      secondary: '#059669',
      gentle: 'rgba(16,185,129,0.08)',
      gentleHover: 'rgba(16,185,129,0.12)',
    },
    {
      main: '#f59e0b',
      secondary: '#d97706',
      gentle: 'rgba(245,158,11,0.08)',
      gentleHover: 'rgba(245,158,11,0.12)',
    },
    {
      main: '#ef4444',
      secondary: '#dc2626',
      gentle: 'rgba(239,68,68,0.08)',
      gentleHover: 'rgba(239,68,68,0.12)',
    },
  ];

  const getMilestoneColor = (index: number) =>
    milestoneColors[index % milestoneColors.length];

  const handleMouseDown = useCallback(
    (
      e: React.MouseEvent,
      taskId: string,
      mode: 'move' | 'resize-start' | 'resize-end',
      taskStart: Date,
      taskEnd: Date
    ) => {
      e.preventDefault();
      setDragState({
        taskId,
        mode,
        startX: e.clientX,
        originalStart: taskStart,
        originalEnd: taskEnd,
      });
    },
    []
  );

  const handleMouseMove = useCallback(
    (_e: MouseEvent) => {
      if (!dragState || !timelineRef.current || !timelineData) return;

      // Use current zoom level for pixel calculations
      // const pixelsPerDay = zoomLevel;
      // const deltaX = e.clientX - dragState.startX;
      // const daysDelta = Math.round(deltaX / pixelsPerDay);

      // visual-only; commit on mouseup
    },
    [dragState, timelineData]
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (!dragState || !timelineRef.current || !timelineData) return;

      // Use current zoom level for pixel calculations
      const pixelsPerDay = zoomLevel;
      const deltaX = e.clientX - dragState.startX;
      const daysDelta = Math.round(deltaX / pixelsPerDay);

      let newStart = dragState.originalStart;
      let newEnd = dragState.originalEnd;

      if (dragState.mode === 'move') {
        newStart = addDays(dragState.originalStart, daysDelta);
        newEnd = addDays(dragState.originalEnd, daysDelta);
      } else if (dragState.mode === 'resize-start') {
        newStart = addDays(dragState.originalStart, daysDelta);
        if (newStart >= dragState.originalEnd)
          newStart = addDays(dragState.originalEnd, -1);
      } else if (dragState.mode === 'resize-end') {
        newEnd = addDays(dragState.originalEnd, daysDelta);
        if (newEnd <= dragState.originalStart)
          newEnd = addDays(dragState.originalStart, 1);
      }

      const newDuration = differenceInDays(newEnd, newStart) + 1;

      onUpdateTask(dragState.taskId, {
        startDate: format(newStart, 'yyyy-MM-dd'),
        endDate: format(newEnd, 'yyyy-MM-dd'),
        durationDays: newDuration,
      });

      setDragState(null);
    },
    [dragState, timelineData, onUpdateTask, zoomLevel]
  );

  useEffect(() => {
    if (!dragState) return;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    if (!resizeState) return;
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [resizeState, handleResizeMove, handleResizeEnd]);

  // Early return if no timeline data
  if (!timelineData) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          No tasks to display in the timeline
        </p>
      </Card>
    );
  }

  const {
    projectStart,
    projectEnd,
    timelineStart,
    timelineEnd,
    totalDays,
    // weeks,
  } = timelineData;

  const deliverableMarkers = sortedMilestones
    .map(({ milestone }) => milestone)
    .filter(m => m.tasks && m.tasks.length > 0) // Solo milestones con tareas
    .map(m => {
      const milestoneDates = calculateMilestoneDates(m);
      const deliverableDate = milestoneDates.endDate; // Usar fecha calculada
      const daysDiff = differenceInDays(deliverableDate, timelineStart);
      const position = (daysDiff / totalDays) * 100;
      return {
        name: m.milestoneName,
        date: deliverableDate,
        position: Math.max(0, Math.min(100, position)),
      };
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
    if (!task.startDate || !task.endDate) {
      return null; // Don't render tasks without dates
    }
    const taskStart = parseISO(task.startDate);
    const taskEnd = parseISO(task.endDate);
    const teamColor = teamColors[task.team] || teamColors.Default;
    const allMilestonesForDeps = sortedMilestones.map(
      ({ milestone }) => milestone
    );
    const dependencyInfo = getTaskDependencyInfo(task, allMilestonesForDeps);

    const handleEditClick = (e: React.MouseEvent) => {
      e.preventDefault();
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
                minWidth: '30px',
              }}
              onMouseDown={e => {
                // Don't start dragging on right-click (context menu)
                if (e.button === 2) return;
                
                // Don't start dragging if clicking on edit button
                const target = e.target as HTMLElement;
                if (target.closest('button[title="Edit task"]')) {
                  return;
                }
                handleMouseDown(e, task.taskId, 'move', taskStart, taskEnd);
              }}
            >
              <div
                className="w-3 h-full bg-white/30 cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity rounded-l-lg flex items-center justify-center"
                onMouseDown={e => {
                  if (e.button === 2) return; // Don't handle right-click
                  e.stopPropagation();
                  handleMouseDown(
                    e,
                    task.taskId,
                    'resize-start',
                    taskStart,
                    taskEnd
                  );
                }}
              >
                <div className="w-1 h-4 bg-white/60 rounded-full"></div>
              </div>

              <div className="flex-1 px-3 text-white text-sm font-medium truncate flex items-center gap-2">
                {dependencyInfo.hasDependencies && (
                  <svg
                    className="w-3 h-3 flex-shrink-0 opacity-90"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path d="M8 1l3 3h-2v8h-2V4H5l3-3z" />
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
                onMouseDown={e => {
                  if (e.button === 2) return; // Don't handle right-click
                  e.stopPropagation();
                  handleMouseDown(
                    e,
                    task.taskId,
                    'resize-end',
                    taskStart,
                    taskEnd
                  );
                }}
              >
                <div className="w-1 h-4 bg-white/60 rounded-full"></div>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">
            <div className="space-y-3">
              <div className="font-medium">{task.name}</div>
              <div className="text-sm text-muted-foreground">
                {task.description}
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <Badge
                    variant="outline"
                    style={{ borderColor: teamColor, color: teamColor }}
                  >
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
                {format(taskStart, 'dd/MM/yyyy', { locale: es })} -{' '}
                {format(taskEnd, 'dd/MM/yyyy', { locale: es })}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <>
      <div className="w-full">
        {/* Zoom Controls and Expand/Collapse */}
        <div className="flex items-center gap-2 mb-4 p-2 bg-muted/30 rounded-lg">
          <span className="text-sm font-medium mr-2">Zoom:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={zoomOut}
            disabled={zoomLevel <= 8}
            className="flex items-center gap-1"
          >
            <ZoomOut className="w-4 h-4" />
            Out
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetZoom}
            className="flex items-center gap-1"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={zoomIn}
            disabled={zoomLevel >= 80}
            className="flex items-center gap-1"
          >
            <ZoomIn className="w-4 h-4" />
            In
          </Button>
          <div className="ml-3 px-2 py-1 bg-muted rounded text-xs font-medium">
            {Math.round(zoomLevel)}px/día
          </div>

          {/* Expand/Collapse Controls */}
          {expandAllMilestones && collapseAllMilestones && (
            <>
              <div className="mx-2 h-4 w-px bg-muted-foreground/30"></div>
              <span className="text-sm font-medium">Milestones:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={expandAllMilestones}
                className="flex items-center gap-1"
              >
                <ChevronDown className="w-4 h-4" />
                Expand All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={collapseAllMilestones}
                className="flex items-center gap-1"
              >
                <ChevronUp className="w-4 h-4" />
                Collapse All
              </Button>
            </>
          )}
        </div>

        <Card className="overflow-hidden">
          <div className="border-b bg-yellow-50 p-2 text-xs">
            <div className="flex gap-4">
              <span>
                Project: {format(projectStart, 'dd/MM/yyyy')} -{' '}
                {format(projectEnd, 'dd/MM/yyyy')}
              </span>
              <span>
                Timeline: {format(timelineStart, 'dd/MM/yyyy')} -{' '}
                {format(timelineEnd, 'dd/MM/yyyy')}
              </span>
              <span>Total Days: {totalDays}</span>
              <span>Total Milestones: {sortedMilestones.length}</span>
              <span>
                First Milestone Duration:{' '}
                {differenceInDays(
                  calculateMilestoneDates(sortedMilestones[0]?.milestone)
                    .endDate,
                  calculateMilestoneDates(sortedMilestones[0]?.milestone)
                    .startDate
                )}{' '}
                days
              </span>
            </div>
          </div>

          {/* Unified Table with Fixed First Column */}
          <div
            className="relative overflow-x-auto"
            ref={ganttContainerRef}
            style={{ position: 'relative' }}
          >
            <table
              className="border-collapse"
              style={{
                width: `calc(${gridNameColumns} + ${dayColumns.length * zoomLevel}px)`,
              }}
            >
              {/* Table Header */}
              <thead>
                <tr>
                  {/* Fixed Header Column */}
                  <th
                    className="bg-muted/50 border-r sticky left-0 z-30 shadow-lg relative"
                    style={{
                      width: gridNameColumns,
                      minWidth: gridNameColumns,
                      maxWidth: gridNameColumns,
                      position: 'sticky',
                      left: 0,
                    }}
                  >
                    <div className="p-4 text-left bg-muted/50">
                      <h3 className="text-lg font-semibold">
                        Milestones and Tasks
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Project hierarchical organization
                      </p>
                    </div>
                    {/* Drag Resize Handle with Icon - Highly Visible */}
                    <div
                      className="absolute top-0 right-0 w-8 h-full cursor-col-resize bg-blue-100 hover:bg-blue-200 border-l-4 border-r-4 border-blue-400 hover:border-blue-600 z-40 flex items-center justify-center transition-all duration-200 group shadow-md"
                      onMouseDown={handleResizeStart}
                      title="⟷ Arrastra para redimensionar columna"
                    >
                      <GripVertical className="w-5 h-5 text-blue-700 group-hover:text-blue-900 transition-colors font-bold" />
                    </div>
                  </th>

                  {/* Timeline Header */}
                  <th
                    className="bg-muted/50 relative"
                    style={{ width: `${dayColumns.length * zoomLevel}px` }}
                  >
                    <div className="flex flex-col">
                      {/* Month Header Row */}
                      <div className="flex border-b border-muted-foreground/20 pb-1">
                        {(() => {
                          const monthGroups: {
                            month: string;
                            year: number;
                            startIndex: number;
                            width: number;
                          }[] = [];
                          let currentMonth = '';
                          let currentYear = 0;
                          let startIndex = 0;

                          dayColumns.forEach((day, index) => {
                            if (day.isNewMonth || index === 0) {
                              if (currentMonth && monthGroups.length > 0) {
                                monthGroups[monthGroups.length - 1].width =
                                  (index - startIndex) * zoomLevel;
                              }
                              currentMonth = day.monthName;
                              currentYear = day.year;
                              startIndex = index;
                              monthGroups.push({
                                month: currentMonth,
                                year: currentYear,
                                startIndex,
                                width: 0,
                              });
                            }

                            if (index === dayColumns.length - 1) {
                              monthGroups[monthGroups.length - 1].width =
                                (index - startIndex + 1) * zoomLevel;
                            }
                          });

                          return monthGroups.map((group, idx) => (
                            <div
                              key={`month-${idx}`}
                              className="flex items-center justify-center text-sm font-semibold text-primary bg-primary/5 border-r border-muted-foreground/20"
                              style={{
                                width: `${group.width}px`,
                                minWidth: `${group.width}px`,
                              }}
                            >
                              {zoomLevel >= 32 ? (
                                <div className="text-center">
                                  <div>{group.month}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {group.year}
                                  </div>
                                </div>
                              ) : zoomLevel >= 16 ? (
                                `${group.month} ${group.year}`
                              ) : (
                                `${group.month.slice(0, 3)} ${group.year}`
                              )}
                            </div>
                          ));
                        })()}
                      </div>

                      {/* Week Header Row */}
                      <div className="flex">
                        {dayColumns.map((day, index) => (
                          <div
                            key={`day-${index}`}
                            className={`relative text-xs flex-shrink-0 ${day.isWeekStart ? 'border-l-2 border-l-blue-500' : ''}`}
                            style={{
                              width: `${zoomLevel}px`,
                              minWidth: `${zoomLevel}px`,
                            }}
                          >
                            {/* Show date only on Mondays (week start) - adaptive based on zoom */}
                            {day.isWeekStart && (
                              <div className="px-0.5 py-0.5 text-center">
                                {zoomLevel >= 24 ? (
                                  <>
                                    <div className="text-[9px] font-medium">
                                      {format(day.date, 'dd/MM', {
                                        locale: es,
                                      })}
                                    </div>
                                    <div className="text-[7px] text-muted-foreground">
                                      Sem {day.weekNumber + 1}
                                    </div>
                                  </>
                                ) : zoomLevel >= 12 ? (
                                  <div className="text-[7px] font-medium transform -rotate-90 origin-center whitespace-nowrap">
                                    {format(day.date, 'dd/MM', { locale: es })}
                                  </div>
                                ) : (
                                  <div className="text-[6px] font-medium transform -rotate-90 origin-center whitespace-nowrap">
                                    {format(day.date, 'dd/M', { locale: es })}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Deliverable markers for this specific day */}
                            {deliverableMarkers
                              .filter(marker => {
                                const markerDay = differenceInDays(
                                  marker.date,
                                  timelineStart
                                );
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
                                    <div className="font-medium text-gray-900">
                                      Deliverable
                                    </div>
                                    <div className="text-gray-600 text-[8px]">
                                      {marker.name}
                                    </div>
                                    <div className="text-gray-500 text-[8px]">
                                      {format(marker.date, 'd MMM yyyy', {
                                        locale: es,
                                      })}
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody ref={timelineRef}>
                {sortedMilestones.map(({ milestone, originalIndex }) => {
                  const milestoneColor = getMilestoneColor(originalIndex);
                  const milestoneDates = calculateMilestoneDates(milestone);
                  const milestoneStartDay = differenceInDays(
                    milestoneDates.startDate,
                    timelineStart
                  );
                  const milestoneDurationDays =
                    differenceInDays(
                      milestoneDates.endDate,
                      milestoneDates.startDate
                    ) + 1;

                  return (
                    <React.Fragment key={milestone.milestoneId}>
                      {/* Milestone Row */}
                      <tr
                        className="border-b min-h-[72px] relative"
                        style={{
                          backgroundColor: milestoneColor.gentle,
                          borderLeft: `4px solid ${milestoneColor.main}`,
                        }}
                      >
                        {/* Milestone Info Cell */}
                        <td
                          className="border-r bg-background sticky left-0 z-20 shadow-lg relative"
                          style={{
                            width: gridNameColumns,
                            minWidth: gridNameColumns,
                            maxWidth: gridNameColumns,
                            position: 'sticky',
                            left: 0,
                          }}
                        >
                          <div className="p-2">
                            <MilestoneContextMenu
                              milestone={milestone}
                              isExpanded={expandedMilestones.has(milestone.milestoneId)}
                              onEdit={handleEditMilestone}
                              onAddTask={handleAddTaskToMilestone}
                              onToggle={(m) => toggleMilestone(m.milestoneId)}
                            >
                              <button
                                onClick={() =>
                                  toggleMilestone(milestone.milestoneId)
                                }
                                className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded-lg p-3 transition-colors min-h-[44px]"
                              >
                                {expandedMilestones.has(milestone.milestoneId) ? (
                                  <ChevronDown className="w-5 h-5 text-primary" />
                                ) : (
                                  <ChevronRight className="w-5 h-5 text-primary" />
                                )}
                                <div>
                                  <div className="font-semibold text-base">
                                    {milestone.milestoneName}
                                  </div>
                                  <div className="text-sm text-muted-foreground mt-1">
                                    {format(milestoneDates.startDate, 'dd/MM', {
                                      locale: es,
                                    })}{' '}
                                    -{' '}
                                    {format(milestoneDates.endDate, 'dd/MM', {
                                      locale: es,
                                    })}{' '}
                                    • {milestone.tasks.length} task
                                    {milestone.tasks.length !== 1 ? 's' : ''}
                                  </div>
                                </div>
                              </button>
                            </MilestoneContextMenu>
                          </div>
                          {/* Drag Resize Handle with Icon - Highly Visible */}
                          <div
                            className="absolute top-0 right-0 w-6 h-full cursor-col-resize bg-blue-50 hover:bg-blue-100 border-l-3 border-r-3 border-blue-300 hover:border-blue-500 z-30 flex items-center justify-center transition-all duration-200 group shadow-sm"
                            onMouseDown={handleResizeStart}
                            title="⟷ Arrastra para redimensionar columna"
                          >
                            <GripVertical className="w-4 h-4 text-blue-600 group-hover:text-blue-800 transition-colors font-semibold" />
                          </div>
                        </td>

                        {/* Milestone Timeline Cell */}
                        <td
                          className="p-0 h-[72px] relative"
                          style={{
                            width: `${dayColumns.length * zoomLevel}px`,
                          }}
                        >
                          <div className="h-full relative">
                            <div
                              className="h-full relative"
                              style={{
                                width: `${dayColumns.length * zoomLevel}px`,
                                minHeight: '72px',
                              }}
                            >
                              <div
                                className="absolute rounded-lg shadow-lg border-2 border-white/40 overflow-hidden z-10 flex items-center px-3"
                                style={{
                                  left: `${milestoneStartDay * zoomLevel + 2}px`,
                                  width: `${milestoneDurationDays * zoomLevel - 4}px`,
                                  background: `linear-gradient(135deg, ${milestoneColor.main} 0%, ${milestoneColor.secondary} 100%)`,
                                  minWidth: Math.min(80, zoomLevel * 2) + 'px',
                                  height: '44px',
                                  top: '14px',
                                }}
                              >
                                <div className="flex items-center gap-2 text-white">
                                  <span className="text-sm font-bold truncate">
                                    {milestone.milestoneName}
                                  </span>
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-r from-white/15 to-transparent rounded-lg"></div>
                                <div className="absolute left-0 top-0 w-1 h-full bg-white/40 rounded-l-lg"></div>
                                <div className="absolute right-0 top-0 w-1 h-full bg-white/40 rounded-r-lg"></div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Task Rows */}
                      {expandedMilestones.has(milestone.milestoneId) &&
                        milestone.tasks
                          .filter(task => task.startDate && task.endDate)
                          .map((task: Task) => {
                            const taskStart = parseISO(task.startDate!);
                            const taskEnd = parseISO(task.endDate!);
                            const taskStartDay = differenceInDays(
                              taskStart,
                              timelineStart
                            );
                            const taskDurationDays =
                              differenceInDays(taskEnd, taskStart) + 1;
                            const teamColor =
                              teamColors[task.team] || teamColors.Default;

                            return (
                              <tr
                                key={task.taskId}
                                className="border-b min-h-[32px] relative hover:bg-muted/25 transition-colors"
                                style={{
                                  backgroundColor: milestoneColor.gentle,
                                }}
                                data-task-id={task.taskId}
                              >
                                {/* Task Info Cell */}
                                <td
                                  className="border-r bg-background sticky left-0 z-20 shadow-lg relative"
                                  style={{
                                    width: gridNameColumns,
                                    minWidth: gridNameColumns,
                                    maxWidth: gridNameColumns,
                                    position: 'sticky',
                                    left: 0,
                                  }}
                                >
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="p-2 pr-8 cursor-help">
                                          <div className="pl-8">
                                            <div className="flex items-center gap-2">
                                              <div className="font-medium text-sm truncate flex-1">
                                                {task.name}
                                              </div>
                                              <Badge
                                                variant="outline"
                                                style={{
                                                  borderColor: teamColor,
                                                  color: teamColor,
                                                }}
                                                className="text-xs flex-shrink-0"
                                              >
                                                {task.team}
                                              </Badge>
                                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                                {task.durationDays}d
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm">
                                        <div className="space-y-2">
                                          <div className="font-medium">
                                            {task.name}
                                          </div>
                                          <div className="text-sm text-muted-foreground">
                                            {task.description}
                                          </div>
                                          <div className="flex items-center gap-4 text-sm">
                                            <div className="flex items-center gap-1">
                                              <Users className="w-3 h-3" />
                                              <Badge
                                                variant="outline"
                                                style={{
                                                  borderColor: teamColor,
                                                  color: teamColor,
                                                }}
                                              >
                                                {task.team}
                                              </Badge>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <Clock className="w-3 h-3" />
                                              <span className="text-xs">
                                                {task.durationDays} days
                                              </span>
                                            </div>
                                          </div>
                                          {task.sprint && (
                                            <div className="flex items-center gap-1 text-sm">
                                              <Zap className="w-3 h-3" />
                                              <Badge variant="secondary">
                                                {task.sprint}
                                              </Badge>
                                            </div>
                                          )}
                                          <div className="flex items-center gap-1 text-sm">
                                            <Calendar className="w-3 h-3" />
                                            {format(taskStart, 'dd/MM/yyyy', {
                                              locale: es,
                                            })}{' '}
                                            -{' '}
                                            {format(taskEnd, 'dd/MM/yyyy', {
                                              locale: es,
                                            })}
                                          </div>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  {/* Drag Resize Handle with Icon - Highly Visible */}
                                  <div
                                    className="absolute top-0 right-0 w-6 h-full cursor-col-resize bg-blue-50 hover:bg-blue-100 border-l-2 border-r-2 border-blue-300 hover:border-blue-500 z-30 flex items-center justify-center transition-all duration-200 group shadow-sm"
                                    onMouseDown={handleResizeStart}
                                    title="⟷ Arrastra para redimensionar columna"
                                  >
                                    <GripVertical className="w-3 h-3 text-blue-600 group-hover:text-blue-800 transition-colors font-semibold" />
                                  </div>
                                </td>

                                {/* Task Timeline Cell */}
                                <td
                                  className="p-0 h-[32px] relative"
                                  style={{
                                    width: `${dayColumns.length * zoomLevel}px`,
                                    backgroundColor: milestoneColor.gentle,
                                  }}
                                >
                                  <div className="h-full relative">
                                    <div
                                      className="h-full relative"
                                      style={{
                                        width: `${dayColumns.length * zoomLevel}px`,
                                        minHeight: '32px',
                                      }}
                                    >
                                      {/* Draggable Task Bar */}
                                      <div
                                        className="absolute inset-y-1 z-10 flex items-center transition-all duration-300"
                                        style={{
                                          left: `${taskStartDay * zoomLevel + 2}px`,
                                          width: `${taskDurationDays * zoomLevel - 4}px`,
                                          minWidth:
                                            Math.min(30, zoomLevel) + 'px',
                                          height: '28px',
                                        }}
                                      >
                                        <TaskContextMenu
                                          task={task}
                                          onClone={handleCloneTask}
                                          onSplit={handleSplitTask}
                                          onMove={handleMoveTask}
                                          onDelete={handleDeleteTask}
                                          onEdit={(task) => {
                                            setEditingTask(task);
                                            setIsEditModalOpen(true);
                                          }}
                                        >
                                          <TaskBar task={task} />
                                        </TaskContextMenu>
                                      </div>

                                      {/* Task name and dates to the right */}
                                      <div
                                        className="absolute top-1/2 -translate-y-1/2 z-5 flex items-center gap-2 text-xs whitespace-nowrap pointer-events-none"
                                        style={{
                                          left: `${taskStartDay * zoomLevel + taskDurationDays * zoomLevel + 8}px`,
                                        }}
                                      >
                                        <span className="font-medium text-gray-700">
                                          {task.name}
                                        </span>
                                        <span className="text-blue-600 text-xs">
                                          {format(taskStart, 'dd/MM', {
                                            locale: es,
                                          })}{' '}
                                          -{' '}
                                          {format(taskEnd, 'dd/MM', {
                                            locale: es,
                                          })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
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
        onSave={(taskId, updates) => {
          onUpdateTask(taskId, updates);
          // Trigger timeline recalculation when dependencies change
          if (updates.dependsOn !== undefined && onRecalculateTimeline) {
            onRecalculateTimeline();
          }
        }}
        milestones={milestones}
      />
      
      <CloneTaskDialog
        task={cloneTaskState}
        isOpen={isCloneDialogOpen}
        onClose={() => {
          setIsCloneDialogOpen(false);
          setCloneTaskState(null);
        }}
        onConfirm={handleConfirmClone}
        milestones={milestones}
        currentMilestoneId={currentMilestoneId}
      />
      
      <SplitTaskDialog
        task={splitTaskState}
        isOpen={isSplitDialogOpen}
        onClose={() => {
          setIsSplitDialogOpen(false);
          setSplitTaskState(null);
        }}
        onConfirm={handleConfirmSplit}
        milestones={milestones}
      />
      
      <MoveTaskDialog
        task={moveTaskState}
        isOpen={isMoveDialogOpen}
        onClose={() => {
          setIsMoveDialogOpen(false);
          setMoveTaskState(null);
        }}
        onConfirm={handleConfirmMove}
        milestones={milestones}
        currentMilestoneId={currentMilestoneId}
      />
      
      <MilestoneEditDialog
        milestone={editingMilestone}
        isOpen={isMilestoneEditDialogOpen}
        onClose={() => {
          setIsMilestoneEditDialogOpen(false);
          setEditingMilestone(null);
        }}
        onConfirm={handleConfirmMilestoneEdit}
        milestones={milestones}
      />
      
      {/* Task Create Dialog - Uses TaskEditModal in create mode */}
      {console.log('🖥️ RENDERING TaskEditModal (CREATE MODE):', { 
        isTaskCreateDialogOpen, 
        creatingTaskForMilestone: creatingTaskForMilestone?.milestoneName 
      })}
      <TaskEditModal
        task={null} // null indicates create mode
        isOpen={isTaskCreateDialogOpen}
        onClose={() => {
          console.log('❌ TASK CREATE DIALOG CLOSED');
          setIsTaskCreateDialogOpen(false);
          setCreatingTaskForMilestone(null);
        }}
        onSave={handleConfirmTaskCreate}
        milestones={milestones}
      />
    </>
  );
}
