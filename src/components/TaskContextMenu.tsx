import React from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu';
import { Copy, Scissors, Move, Edit, Trash2 } from 'lucide-react';
import { Task } from '../utils/dateUtils';

interface TaskContextMenuProps {
  task: Task;
  children: React.ReactNode;
  onClone?: (task: Task) => void;
  onSplit?: (task: Task) => void;
  onMove?: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  disabled?: boolean;
}

export function TaskContextMenu({
  task,
  children,
  onClone,
  onSplit,
  onMove,
  onEdit,
  onDelete,
  disabled = false,
}: TaskContextMenuProps) {
  if (disabled) {
    return <>{children}</>;
  }

  const handleClone = (e: Event) => {
    e.preventDefault();
    if (onClone) {
      onClone(task);
    }
  };

  const handleSplit = (e: Event) => {
    e.preventDefault();
    if (onSplit) {
      onSplit(task);
    }
  };

  const handleMove = (e: Event) => {
    e.preventDefault();
    if (onMove) {
      onMove(task);
    }
  };

  const handleEdit = (e: Event) => {
    e.preventDefault();
    if (onEdit) {
      onEdit(task);
    }
  };

  const handleDelete = (e: Event) => {
    e.preventDefault();
    if (onDelete) {
      onDelete(task);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {onEdit && (
          <>
            <ContextMenuItem
              onSelect={handleEdit}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit Task
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}

        {onClone && (
          <ContextMenuItem
            onSelect={handleClone}
            className="flex items-center gap-2"
          >
            <Copy className="h-4 w-4" />
            Clone Task
          </ContextMenuItem>
        )}

        {onSplit && (
          <ContextMenuItem
            onSelect={handleSplit}
            className="flex items-center gap-2"
          >
            <Scissors className="h-4 w-4" />
            Split Task
          </ContextMenuItem>
        )}

        {onMove && (
          <ContextMenuItem
            onSelect={handleMove}
            className="flex items-center gap-2"
          >
            <Move className="h-4 w-4" />
            Move to Milestone...
          </ContextMenuItem>
        )}

        {(onClone || onSplit || onMove) && onDelete && <ContextMenuSeparator />}

        {onDelete && (
          <ContextMenuItem
            onSelect={handleDelete}
            className="flex items-center gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete Task
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
