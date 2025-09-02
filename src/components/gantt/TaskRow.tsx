import React, { memo, useMemo, useCallback } from 'react';
import { Badge } from '../ui/badge';
import { GripVertical, GripHorizontal } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { Calendar, Clock, Users, Zap } from 'lucide-react';
import { TaskContextMenu } from '../TaskContextMenu';
import { TaskBar } from './TaskBar';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { teamColors } from '../../utils/dateUtils';
import type { Task, Milestone } from '../../utils/dateUtils';

interface MilestoneColor {
  main: string;
  secondary: string;
  gentle: string;
  gentleHover: string;
}

interface TaskRowProps {
  task: Task;
  milestones: Milestone[];
  milestoneColor: MilestoneColor;
  timelineStart: Date;
  zoomLevel: number;
  dayColumnsLength: number;
  gridNameColumns: string;
  onMouseDown: (
    e: React.MouseEvent,
    taskId: string,
    mode: 'move' | 'resize-start' | 'resize-end',
    taskStart: Date,
    taskEnd: Date
  ) => void;
  onClone: (task: Task) => void;
  onSplit: (task: Task) => void;
  onMove: (task: Task) => void;
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onResizeStart: (e: React.MouseEvent) => void;
  onTaskDragStart?: (
    taskId: string,
    milestoneId: string,
    index: number
  ) => void;
  onTaskDragOver?: (index: number) => void;
  onTaskDragEnd?: () => void;
  taskDragIndex?: number;
  milestoneId: string;
  isDragging?: boolean;
  isDragTarget?: boolean;
}

const TaskRow = memo(function TaskRow({
  task,
  milestones,
  milestoneColor,
  timelineStart,
  zoomLevel,
  dayColumnsLength,
  gridNameColumns,
  onMouseDown,
  onClone,
  onSplit,
  onMove,
  onDelete,
  onEdit,
  onResizeStart,
  onTaskDragStart,
  onTaskDragOver,
  onTaskDragEnd,
  taskDragIndex,
  milestoneId,
  isDragging = false,
  isDragTarget = false,
}: TaskRowProps) {
  // Memoize expensive date calculations
  const taskCalculations = useMemo(() => {
    if (!task.startDate || !task.endDate) {
      return null;
    }

    const taskStart = parseISO(task.startDate);
    const taskEnd = parseISO(task.endDate);
    const taskStartDay = differenceInDays(taskStart, timelineStart);
    // Use task.durationDays directly instead of recalculating to avoid timing issues
    const taskDurationDays = task.durationDays;
    const teamColor = teamColors[task.team] || teamColors.Default;

    // Debug logging for task width calculation - check task data vs calculation
    const calculatedFromDates = differenceInDays(taskEnd, taskStart) + 1;
    const calculatedWidth = taskDurationDays * zoomLevel - 4;
    console.log(
      `📏 Task "${task.name}": task.durationDays=${taskDurationDays}, calculatedFromDates=${calculatedFromDates}, dates=${task.startDate} to ${task.endDate}, zoomLevel=${zoomLevel}, calculatedWidth=${calculatedWidth}px`
    );

    return {
      taskStart,
      taskEnd,
      taskStartDay,
      taskDurationDays,
      teamColor,
    };
  }, [
    task.startDate,
    task.endDate,
    task.durationDays,
    task.team,
    task.name,
    timelineStart,
    zoomLevel,
  ]);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (onTaskDragStart && taskDragIndex !== undefined) {
        onTaskDragStart(task.taskId, milestoneId, taskDragIndex);
        e.dataTransfer.effectAllowed = 'move';
        // Add some visual feedback
        (e.currentTarget as HTMLElement).style.opacity = '0.5';
      }
    },
    [onTaskDragStart, task.taskId, milestoneId, taskDragIndex]
  );

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      (e.currentTarget as HTMLElement).style.opacity = '';
      if (onTaskDragEnd) {
        onTaskDragEnd();
      }
    },
    [onTaskDragEnd]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (onTaskDragOver && taskDragIndex !== undefined && !isDragging) {
        onTaskDragOver(taskDragIndex);
      }
    },
    [onTaskDragOver, taskDragIndex, isDragging]
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  if (!taskCalculations) {
    return null;
  }

  const { taskStart, taskEnd, taskStartDay, taskDurationDays, teamColor } =
    taskCalculations;

  return (
    <tr
      key={task.taskId}
      className={`border-b min-h-[32px] relative hover:bg-muted/25 transition-colors ${
        isDragging ? 'opacity-50 bg-primary/5' : ''
      } ${isDragTarget ? 'border-primary border-2 bg-primary/10' : ''}`}
      style={{
        backgroundColor: isDragging
          ? `${milestoneColor.gentle}80`
          : milestoneColor.gentle,
      }}
      data-task-id={task.taskId}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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
              <div className="p-2 pr-8 cursor-help min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  {/* Drag Handle */}
                  {onTaskDragStart && (
                    <div
                      className="cursor-move p-1 rounded hover:bg-muted/50 transition-colors opacity-60 hover:opacity-100 flex-shrink-0"
                      title="Drag to reorder tasks"
                      draggable={true}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onMouseDown={e => e.stopPropagation()}
                    >
                      <GripHorizontal className="w-3 h-3 text-muted-foreground" />
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="font-medium text-sm truncate flex-1 min-w-0">
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
            <TooltipContent className="max-w-sm" side="right" align="start">
              <div className="space-y-2">
                <div className="font-medium">{task.name}</div>
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
          onMouseDown={onResizeStart}
          title="⟷ Arrastra para redimensionar columna"
        >
          <GripVertical className="w-3 h-3 text-blue-600 group-hover:text-blue-800 transition-colors font-semibold" />
        </div>
      </td>

      {/* Task Timeline Cell */}
      <td
        className="p-0 h-[32px] relative"
        style={{
          width: `${dayColumnsLength * zoomLevel}px`,
          backgroundColor: milestoneColor.gentle,
        }}
      >
        <div className="h-full relative">
          <div
            className="h-full relative"
            style={{
              width: `${dayColumnsLength * zoomLevel}px`,
              minHeight: '32px',
            }}
          >
            {/* Draggable Task Bar */}
            <div
              className="absolute inset-y-1 z-10 flex items-center transition-all duration-300"
              style={{
                left: `${taskStartDay * zoomLevel + 2}px`,
                width: `${taskDurationDays * zoomLevel - 4}px`,
                minWidth: Math.min(30, zoomLevel) + 'px',
                height: '28px',
              }}
            >
              <TaskContextMenu
                task={task}
                onClone={onClone}
                onSplit={onSplit}
                onMove={onMove}
                onDelete={onDelete}
                onEdit={onEdit}
              >
                <TaskBar
                  task={task}
                  milestones={milestones}
                  onMouseDown={onMouseDown}
                  onEditClick={onEdit}
                />
              </TaskContextMenu>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
});

export { TaskRow };
