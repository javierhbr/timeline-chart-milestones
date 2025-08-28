import React, { memo, useMemo } from 'react';
import { Badge } from '../ui/badge';
import { GripVertical } from 'lucide-react';
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
}: TaskRowProps) {
  // Memoize expensive date calculations
  const taskCalculations = useMemo(() => {
    if (!task.startDate || !task.endDate) {
      return null;
    }

    const taskStart = parseISO(task.startDate);
    const taskEnd = parseISO(task.endDate);
    const taskStartDay = differenceInDays(taskStart, timelineStart);
    const taskDurationDays = differenceInDays(taskEnd, taskStart) + 1;
    const teamColor = teamColors[task.team] || teamColors.Default;

    return {
      taskStart,
      taskEnd,
      taskStartDay,
      taskDurationDays,
      teamColor,
    };
  }, [task.startDate, task.endDate, task.team, timelineStart]);

  if (!taskCalculations) {
    return null;
  }

  const { taskStart, taskEnd, taskStartDay, taskDurationDays, teamColor } = taskCalculations;

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

            {/* Task name and dates to the right */}
            <div
              className="absolute top-1/2 -translate-y-1/2 z-5 flex items-center gap-2 text-xs whitespace-nowrap pointer-events-none"
              style={{
                left: `${taskStartDay * zoomLevel + taskDurationDays * zoomLevel + 8}px`,
              }}
            >
              <span className="font-medium text-gray-700">{task.name}</span>
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
});

export { TaskRow };
