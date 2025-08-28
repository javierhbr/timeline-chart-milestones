import React from 'react';
import { Badge } from '../ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { Calendar, Clock, Users, Edit, Zap } from 'lucide-react';
import { Task, teamColors, getTaskDependencyInfo } from '../../utils/dateUtils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Milestone } from '../../utils/dateUtils';

interface TaskBarProps {
  task: Task;
  milestones: Milestone[];
  onMouseDown: (
    e: React.MouseEvent,
    taskId: string,
    mode: 'move' | 'resize-start' | 'resize-end',
    taskStart: Date,
    taskEnd: Date
  ) => void;
  onEditClick: (task: Task) => void;
}

export function TaskBar({
  task,
  milestones,
  onMouseDown,
  onEditClick,
}: TaskBarProps) {
  if (!task.startDate || !task.endDate) {
    return null;
  }

  const taskStart = parseISO(task.startDate);
  const taskEnd = parseISO(task.endDate);
  const teamColor = teamColors[task.team] || teamColors.Default;
  const dependencyInfo = getTaskDependencyInfo(task, milestones);

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEditClick(task);
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
              if (e.button === 2) return;

              const target = e.target as HTMLElement;
              if (target.closest('button[title="Edit task"]')) {
                return;
              }
              onMouseDown(e, task.taskId, 'move', taskStart, taskEnd);
            }}
          >
            <div
              className="w-3 h-full bg-white/30 cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity rounded-l-lg flex items-center justify-center"
              onMouseDown={e => {
                if (e.button === 2) return;
                e.stopPropagation();
                onMouseDown(e, task.taskId, 'resize-start', taskStart, taskEnd);
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
                if (e.button === 2) return;
                e.stopPropagation();
                onMouseDown(e, task.taskId, 'resize-end', taskStart, taskEnd);
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
}
