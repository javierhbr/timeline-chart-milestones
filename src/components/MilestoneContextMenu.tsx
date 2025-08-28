import React from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu';
import { Edit, Plus, Trash2, FolderOpen, FolderClosed } from 'lucide-react';
import { Milestone } from '../utils/dateUtils';

interface MilestoneContextMenuProps {
  milestone: Milestone;
  children: React.ReactNode;
  isExpanded: boolean;
  onEdit?: (milestone: Milestone) => void;
  onAddTask?: (milestone: Milestone) => void;
  onToggle?: (milestone: Milestone) => void;
  onDelete?: (milestone: Milestone) => void;
  disabled?: boolean;
}

export function MilestoneContextMenu({
  milestone,
  children,
  isExpanded,
  onEdit,
  onAddTask,
  onToggle,
  onDelete,
  disabled = false,
}: MilestoneContextMenuProps) {
  if (disabled) {
    return <>{children}</>;
  }

  const handleEdit = (e: Event) => {
    e.preventDefault();
    if (onEdit) {
      onEdit(milestone);
    }
  };

  const handleAddTask = (e: Event) => {
    e.preventDefault();
    if (onAddTask) {
      onAddTask(milestone);
    }
  };

  const handleToggle = (e: Event) => {
    e.preventDefault();
    if (onToggle) {
      onToggle(milestone);
    }
  };

  const handleDelete = (e: Event) => {
    e.preventDefault();
    if (onDelete) {
      onDelete(milestone);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        {onEdit && (
          <>
            <ContextMenuItem
              onSelect={handleEdit}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit Milestone
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}

        {onToggle && (
          <ContextMenuItem
            onSelect={handleToggle}
            className="flex items-center gap-2"
          >
            {isExpanded ? (
              <>
                <FolderClosed className="h-4 w-4" />
                Collapse Milestone
              </>
            ) : (
              <>
                <FolderOpen className="h-4 w-4" />
                Expand Milestone
              </>
            )}
          </ContextMenuItem>
        )}

        {onAddTask && (
          <>
            {onToggle && <ContextMenuSeparator />}
            <ContextMenuItem
              onSelect={handleAddTask}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Task
            </ContextMenuItem>
          </>
        )}

        {onDelete && milestone.tasks.length === 0 && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={handleDelete}
              className="flex items-center gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete Milestone
            </ContextMenuItem>
          </>
        )}

        {/* Show warning if trying to delete milestone with tasks */}
        {onDelete && milestone.tasks.length > 0 && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              disabled
              className="flex items-center gap-2 text-muted-foreground cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4" />
              Cannot delete (has {milestone.tasks.length} task
              {milestone.tasks.length !== 1 ? 's' : ''})
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
