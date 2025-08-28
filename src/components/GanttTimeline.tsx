import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  Suspense,
  lazy,
} from 'react';
import { Card } from './ui/card';
import { ZoomControls } from './gantt/ZoomControls';
import { ProjectInfo } from './gantt/ProjectInfo';
import { TimelineHeader } from './gantt/TimelineHeader';
import { MilestoneRow } from './gantt/MilestoneRow';
import { TaskRow } from './gantt/TaskRow';
import {
  Milestone,
  Task,
  generateWeeks,
  calculateMilestoneDates,
  getTimelineRange,
} from '../utils/dateUtils';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';
import {
  cloneTask,
  addClonedTaskToMilestone,
  splitTask,
  moveTaskBetweenMilestones,
  updateDependenciesAfterSplit,
  generateUniqueTaskId,
  CloneOptions,
  SplitConfig,
} from '../utils/taskOperations';
import { createNewMilestone } from '../utils/milestoneOperations';

// Lazy load dialog components
const TaskEditModal = lazy(() =>
  import('./TaskEditModal').then(module => ({ default: module.TaskEditModal }))
);
const CloneTaskDialog = lazy(() =>
  import('./CloneTaskDialog').then(module => ({
    default: module.CloneTaskDialog,
  }))
);
const SplitTaskDialog = lazy(() =>
  import('./SplitTaskDialog').then(module => ({
    default: module.SplitTaskDialog,
  }))
);
const MoveTaskDialog = lazy(() =>
  import('./MoveTaskDialog').then(module => ({
    default: module.MoveTaskDialog,
  }))
);
const MilestoneEditDialog = lazy(() =>
  import('./MilestoneEditDialog').then(module => ({
    default: module.MilestoneEditDialog,
  }))
);
const MilestoneCreateDialog = lazy(() =>
  import('./MilestoneCreateDialog').then(module => ({
    default: module.MilestoneCreateDialog,
  }))
);

interface GanttTimelineProps {
  milestones: Milestone[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onUpdateMilestones?: (milestones: Milestone[]) => void;
  onRecalculateTimeline?: () => void;
  expandedMilestones?: Set<string>;
  onToggleMilestone?: (milestoneId: string) => void;
  expandAllMilestones?: () => void;
  collapseAllMilestones?: () => void;
  milestoneOrder?: string[];
  onUpdateMilestoneOrder?: (order: string[]) => void;
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
  milestoneOrder,
  onUpdateMilestoneOrder,
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
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(
    null
  );
  const [isMilestoneEditDialogOpen, setIsMilestoneEditDialogOpen] =
    useState(false);
  const [creatingTaskForMilestone, setCreatingTaskForMilestone] =
    useState<Milestone | null>(null);
  const [isTaskCreateDialogOpen, setIsTaskCreateDialogOpen] = useState(false);
  const [isMilestoneCreateDialogOpen, setIsMilestoneCreateDialogOpen] =
    useState(false);
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
  const [milestoneDragState, setMilestoneDragState] = useState<{
    draggedMilestoneId: string;
    draggedIndex: number;
    targetIndex: number;
    isDragging: boolean;
  } | null>(null);

  const timelineRef = useRef<HTMLTableSectionElement>(null);
  const ganttContainerRef = useRef<HTMLDivElement>(null);

  // Clone handlers
  const handleCloneTask = useCallback(
    (task: Task) => {
      const milestone = milestones.find(m =>
        m.tasks.some(t => t.taskId === task.taskId)
      );

      if (milestone) {
        setCurrentMilestoneId(milestone.milestoneId);
        setCloneTaskState(task);
        setIsCloneDialogOpen(true);
      } else {
        console.error('Could not find milestone for task:', task.taskId);
      }
    },
    [milestones]
  );

  const handleConfirmClone = useCallback(
    async (options: CloneOptions) => {
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
    },
    [cloneTaskState, milestones, onUpdateMilestones, onRecalculateTimeline]
  );

  const handleConfirmSplit = useCallback(
    (config: SplitConfig) => {
      if (!splitTaskState || !onUpdateMilestones) return;

      // Create split tasks
      const splitTasks = splitTask(splitTaskState, milestones, config);

      // Remove original task and add split tasks
      const updatedMilestones = milestones.map(milestone => ({
        ...milestone,
        tasks: milestone.tasks
          .filter(t => t.taskId !== splitTaskState.taskId)
          .concat(
            milestone.milestoneId === currentMilestoneId ? splitTasks : []
          ),
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
    },
    [
      splitTaskState,
      milestones,
      currentMilestoneId,
      onUpdateMilestones,
      onRecalculateTimeline,
    ]
  );

  const handleConfirmMove = useCallback(
    (fromMilestoneId: string, toMilestoneId: string) => {
      if (!moveTaskState || !onUpdateMilestones) return;

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
    },
    [moveTaskState, milestones, onUpdateMilestones, onRecalculateTimeline]
  );

  // Milestone handlers
  const handleEditMilestone = useCallback((milestone: Milestone) => {
    setEditingMilestone(milestone);
    setIsMilestoneEditDialogOpen(true);
  }, []);

  const handleConfirmMilestoneEdit = useCallback(
    (
      milestoneId: string,
      updates: { milestoneName: string; description?: string }
    ) => {
      if (!onUpdateMilestones) return;

      const updatedMilestones = milestones.map(milestone =>
        milestone.milestoneId === milestoneId
          ? { ...milestone, ...updates }
          : milestone
      );

      onUpdateMilestones(updatedMilestones);
    },
    [milestones, onUpdateMilestones]
  );

  const handleCreateMilestone = useCallback(() => {
    setIsMilestoneCreateDialogOpen(true);
  }, []);

  const handleConfirmMilestoneCreate = useCallback(
    (milestoneName: string, description?: string) => {
      if (!onUpdateMilestones) return;

      const newMilestone = createNewMilestone(
        milestoneName,
        milestones,
        description
      );
      const updatedMilestones = [...milestones, newMilestone];

      onUpdateMilestones(updatedMilestones);

      if (onRecalculateTimeline) {
        onRecalculateTimeline();
      }
    },
    [milestones, onUpdateMilestones, onRecalculateTimeline]
  );

  const handleAddTaskToMilestone = useCallback((milestone: Milestone) => {
    setCreatingTaskForMilestone(milestone);
    setCurrentMilestoneId(milestone.milestoneId);
    setIsTaskCreateDialogOpen(true);
  }, []);

  const handleConfirmTaskCreate = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      if (!creatingTaskForMilestone || !onUpdateMilestones) return;

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
    },
    [
      creatingTaskForMilestone,
      milestones,
      onUpdateMilestones,
      onRecalculateTimeline,
    ]
  );

  const handleSplitTask = useCallback(
    (task: Task) => {
      const milestone = milestones.find(m =>
        m.tasks.some(t => t.taskId === task.taskId)
      );

      if (milestone) {
        setCurrentMilestoneId(milestone.milestoneId);
        setSplitTaskState(task);
        setIsSplitDialogOpen(true);
      }
    },
    [milestones]
  );

  const handleMoveTask = useCallback(
    (task: Task) => {
      const milestone = milestones.find(m =>
        m.tasks.some(t => t.taskId === task.taskId)
      );

      if (milestone) {
        setCurrentMilestoneId(milestone.milestoneId);
        setMoveTaskState(task);
        setIsMoveDialogOpen(true);
      }
    },
    [milestones]
  );

  const handleDeleteTask = useCallback(
    (task: Task) => {
      if (!onUpdateMilestones) {
        console.error('No onUpdateMilestones handler available');
        return;
      }

      // Remove task from milestones
      const updatedMilestones = milestones.map(milestone => ({
        ...milestone,
        tasks: milestone.tasks.filter(t => t.taskId !== task.taskId),
      }));

      onUpdateMilestones(updatedMilestones);

      if (onRecalculateTimeline) {
        onRecalculateTimeline();
      }
    },
    [milestones, onUpdateMilestones, onRecalculateTimeline]
  );

  // Zoom functions with more granular control
  const zoomIn = useCallback(() => {
    setZoomLevel(prev => {
      let newLevel = prev * 1.5;
      // Round to reasonable values
      if (newLevel < 4) newLevel = Math.max(newLevel, 2);
      else if (newLevel < 10) newLevel = Math.round(newLevel);
      else newLevel = Math.round(newLevel / 2) * 2; // Round to even numbers for higher zoom
      return Math.min(newLevel, 120);
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel(prev => {
      let newLevel = prev / 1.5;
      // Round to reasonable values with more zoom out levels
      if (newLevel < 4)
        newLevel = Math.max(Math.round(newLevel * 2) / 2, 1); // Allow 0.5px increments for extreme zoom
      else if (newLevel < 10) newLevel = Math.round(newLevel);
      else newLevel = Math.round(newLevel / 2) * 2;
      return Math.max(newLevel, 1); // Minimum 1px per day for extreme zoom out
    });
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

  // Sort milestones by custom order if available, otherwise by calculated start dates
  const sortedMilestones = useMemo(() => {
    const milestonesWithIndex = milestones.map((milestone, originalIndex) => ({
      milestone,
      originalIndex,
    }));

    // If custom order is provided and contains milestone IDs, use it
    if (milestoneOrder && milestoneOrder.length > 0) {
      const orderMap = new Map(milestoneOrder.map((id, index) => [id, index]));

      return milestonesWithIndex.sort((a, b) => {
        const aOrder =
          orderMap.get(a.milestone.milestoneId) ?? Number.MAX_SAFE_INTEGER;
        const bOrder =
          orderMap.get(b.milestone.milestoneId) ?? Number.MAX_SAFE_INTEGER;

        if (aOrder !== bOrder) {
          return aOrder - bOrder;
        }

        // Fall back to date sorting for milestones not in custom order
        const aDates = calculateMilestoneDates(a.milestone);
        const bDates = calculateMilestoneDates(b.milestone);
        return aDates.startDate.getTime() - bDates.startDate.getTime();
      });
    }

    // Default to date-based sorting
    return milestonesWithIndex.sort((a, b) => {
      const aDates = calculateMilestoneDates(a.milestone);
      const bDates = calculateMilestoneDates(b.milestone);
      return aDates.startDate.getTime() - bDates.startDate.getTime();
    });
  }, [milestones, milestoneOrder]);

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

  // Milestone drag and drop handlers
  const handleMilestoneDragStart = useCallback(
    (milestoneId: string, index: number) => {
      setMilestoneDragState({
        draggedMilestoneId: milestoneId,
        draggedIndex: index,
        targetIndex: index,
        isDragging: true,
      });
    },
    []
  );

  const handleMilestoneDragOver = useCallback(
    (targetIndex: number) => {
      if (!milestoneDragState) return;

      if (milestoneDragState.targetIndex !== targetIndex) {
        setMilestoneDragState(prev =>
          prev
            ? {
                ...prev,
                targetIndex,
              }
            : null
        );
      }
    },
    [milestoneDragState]
  );

  const handleMilestoneDragEnd = useCallback(() => {
    if (!milestoneDragState || !onUpdateMilestoneOrder) {
      setMilestoneDragState(null);
      return;
    }

    // Only reorder if position actually changed
    if (milestoneDragState.draggedIndex !== milestoneDragState.targetIndex) {
      // Always use the current sorted milestones order as the basis
      const currentOrderedMilestones = sortedMilestones.map(
        ({ milestone }) => milestone.milestoneId
      );
      const newOrder = [...currentOrderedMilestones];

      // Remove dragged item
      const [draggedId] = newOrder.splice(milestoneDragState.draggedIndex, 1);

      // Insert at target position
      newOrder.splice(milestoneDragState.targetIndex, 0, draggedId);

      onUpdateMilestoneOrder(newOrder);
    }

    setMilestoneDragState(null);
  }, [milestoneDragState, sortedMilestones, onUpdateMilestoneOrder]);

  // Memoized dialog handlers
  const handleEditModalClose = useCallback(() => setIsEditModalOpen(false), []);

  const handleEditModalSave = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      onUpdateTask(taskId, updates);
      // Trigger timeline recalculation when dependencies change
      if (updates.dependsOn !== undefined && onRecalculateTimeline) {
        onRecalculateTimeline();
      }
    },
    [onUpdateTask, onRecalculateTimeline]
  );

  const handleCloneDialogClose = useCallback(() => {
    setIsCloneDialogOpen(false);
    setCloneTaskState(null);
  }, []);

  const handleSplitDialogClose = useCallback(() => {
    setIsSplitDialogOpen(false);
    setSplitTaskState(null);
  }, []);

  const handleMoveDialogClose = useCallback(() => {
    setIsMoveDialogOpen(false);
    setMoveTaskState(null);
  }, []);

  const handleMilestoneEditDialogClose = useCallback(() => {
    setIsMilestoneEditDialogOpen(false);
    setEditingMilestone(null);
  }, []);

  const handleTaskCreateDialogClose = useCallback(() => {
    setIsTaskCreateDialogOpen(false);
    setCreatingTaskForMilestone(null);
  }, []);

  const handleMilestoneCreateDialogClose = useCallback(
    () => setIsMilestoneCreateDialogOpen(false),
    []
  );

  const handleTaskEdit = useCallback((task: Task) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
  }, []);

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

  return (
    <>
      <div className="w-full">
        <ZoomControls
          zoomLevel={zoomLevel}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onResetZoom={resetZoom}
          expandAllMilestones={expandAllMilestones}
          collapseAllMilestones={collapseAllMilestones}
          onCreateMilestone={handleCreateMilestone}
        />

        <Card className="overflow-hidden">
          <ProjectInfo
            projectStart={projectStart}
            projectEnd={projectEnd}
            timelineStart={timelineStart}
            timelineEnd={timelineEnd}
            totalDays={totalDays}
            sortedMilestones={sortedMilestones}
          />

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
              <TimelineHeader
                dayColumns={dayColumns}
                zoomLevel={zoomLevel}
                deliverableMarkers={deliverableMarkers}
                timelineStart={timelineStart}
                gridNameColumns={gridNameColumns}
                onResizeStart={handleResizeStart}
              />

              {/* Table Body */}
              <tbody ref={timelineRef}>
                {sortedMilestones.map(({ milestone, originalIndex }, index) => {
                  const milestoneColor = getMilestoneColor(originalIndex);
                  const isDragging =
                    milestoneDragState?.draggedMilestoneId ===
                    milestone.milestoneId;
                  const isDragTarget =
                    milestoneDragState?.targetIndex === index;

                  return (
                    <React.Fragment key={milestone.milestoneId}>
                      <MilestoneRow
                        milestone={milestone}
                        milestoneColor={milestoneColor}
                        isExpanded={expandedMilestones.has(
                          milestone.milestoneId
                        )}
                        timelineStart={timelineStart}
                        zoomLevel={zoomLevel}
                        dayColumnsLength={dayColumns.length}
                        gridNameColumns={gridNameColumns}
                        onToggle={toggleMilestone}
                        onEdit={handleEditMilestone}
                        onAddTask={handleAddTaskToMilestone}
                        onResizeStart={handleResizeStart}
                        onDragStart={
                          onUpdateMilestoneOrder
                            ? handleMilestoneDragStart
                            : undefined
                        }
                        onDragOver={
                          onUpdateMilestoneOrder
                            ? handleMilestoneDragOver
                            : undefined
                        }
                        onDragEnd={
                          onUpdateMilestoneOrder
                            ? handleMilestoneDragEnd
                            : undefined
                        }
                        dragIndex={index}
                        isDragging={isDragging}
                        isDragTarget={isDragTarget}
                      />

                      {expandedMilestones.has(milestone.milestoneId) &&
                        milestone.tasks
                          .filter(task => task.startDate && task.endDate)
                          .map((task: Task) => (
                            <TaskRow
                              key={task.taskId}
                              task={task}
                              milestones={milestones}
                              milestoneColor={milestoneColor}
                              timelineStart={timelineStart}
                              zoomLevel={zoomLevel}
                              dayColumnsLength={dayColumns.length}
                              gridNameColumns={gridNameColumns}
                              onMouseDown={handleMouseDown}
                              onClone={handleCloneTask}
                              onSplit={handleSplitTask}
                              onMove={handleMoveTask}
                              onDelete={handleDeleteTask}
                              onEdit={handleTaskEdit}
                              onResizeStart={handleResizeStart}
                            />
                          ))}
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

      {/* Lazy-loaded dialog components wrapped in Suspense */}
      <Suspense fallback={<div />}>
        <TaskEditModal
          task={editingTask}
          isOpen={isEditModalOpen}
          onClose={handleEditModalClose}
          onSave={handleEditModalSave}
          milestones={milestones}
        />

        <CloneTaskDialog
          task={cloneTaskState}
          isOpen={isCloneDialogOpen}
          onClose={handleCloneDialogClose}
          onConfirm={handleConfirmClone}
          milestones={milestones}
          currentMilestoneId={currentMilestoneId}
        />

        <SplitTaskDialog
          task={splitTaskState}
          isOpen={isSplitDialogOpen}
          onClose={handleSplitDialogClose}
          onConfirm={handleConfirmSplit}
          milestones={milestones}
        />

        <MoveTaskDialog
          task={moveTaskState}
          isOpen={isMoveDialogOpen}
          onClose={handleMoveDialogClose}
          onConfirm={handleConfirmMove}
          milestones={milestones}
          currentMilestoneId={currentMilestoneId}
        />

        <MilestoneEditDialog
          milestone={editingMilestone}
          isOpen={isMilestoneEditDialogOpen}
          onClose={handleMilestoneEditDialogClose}
          onConfirm={handleConfirmMilestoneEdit}
          milestones={milestones}
        />

        {/* Task Create Dialog - Uses TaskEditModal in create mode */}
        <TaskEditModal
          task={null} // null indicates create mode
          isOpen={isTaskCreateDialogOpen}
          onClose={handleTaskCreateDialogClose}
          onSave={handleConfirmTaskCreate}
          milestones={milestones}
        />

        <MilestoneCreateDialog
          isOpen={isMilestoneCreateDialogOpen}
          onClose={handleMilestoneCreateDialogClose}
          onConfirm={handleConfirmMilestoneCreate}
          milestones={milestones}
        />
      </Suspense>
    </>
  );
}
