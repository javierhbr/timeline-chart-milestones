import React from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu';
import {
  Edit,
  Plus,
  Trash2,
  FolderOpen,
  FolderClosed,
} from 'lucide-react';
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
    console.log('🚫 MilestoneContextMenu DISABLED for milestone:', milestone.milestoneName);
    return <>{children}</>;
  }

  console.log('🎯 MilestoneContextMenu RENDERED for milestone:', milestone.milestoneName, {
    hasEditHandler: !!onEdit,
    hasAddTaskHandler: !!onAddTask,
    hasToggleHandler: !!onToggle,
    hasDeleteHandler: !!onDelete,
    milestoneId: milestone.milestoneId,
    taskCount: milestone.tasks.length,
    isExpanded
  });

  const handleEdit = (e: Event) => {
    console.log('✏️ EDIT MILESTONE HANDLER TRIGGERED for:', milestone.milestoneName);
    e.preventDefault();
    if (onEdit) {
      console.log('✅ Calling onEdit handler');
      onEdit(milestone);
    } else {
      console.log('❌ No onEdit handler available');
    }
  };

  const handleAddTask = (e: Event) => {
    console.log('➕ ADD TASK HANDLER TRIGGERED for milestone:', milestone.milestoneName);
    e.preventDefault();
    if (onAddTask) {
      console.log('✅ Calling onAddTask handler');
      onAddTask(milestone);
    } else {
      console.log('❌ No onAddTask handler available');
    }
  };

  const handleToggle = (e: Event) => {
    console.log('🔄 TOGGLE MILESTONE HANDLER TRIGGERED for:', milestone.milestoneName);
    e.preventDefault();
    if (onToggle) {
      console.log('✅ Calling onToggle handler');
      onToggle(milestone);
    } else {
      console.log('❌ No onToggle handler available');
    }
  };

  const handleDelete = (e: Event) => {
    console.log('🗑️ DELETE MILESTONE HANDLER TRIGGERED for:', milestone.milestoneName);
    e.preventDefault();
    if (onDelete) {
      console.log('✅ Calling onDelete handler');
      onDelete(milestone);
    } else {
      console.log('❌ No onDelete handler available');
    }
  };

  return (
    <ContextMenu 
      onOpenChange={(open) => {
        console.log('🔄 MilestoneContextMenu state changed:', { 
          open, 
          milestoneName: milestone.milestoneName,
          milestoneId: milestone.milestoneId 
        });
      }}
    >
      <ContextMenuTrigger asChild>
        <div 
          onContextMenu={(e) => {
            console.log('🖱️ RIGHT-CLICK DETECTED on MilestoneContextMenu wrapper:', milestone.milestoneName, {
              event: e.type,
              button: e.button,
              clientX: e.clientX,
              clientY: e.clientY,
              target: (e.target as HTMLElement).tagName,
              note: 'NOT calling preventDefault - let Radix handle it'
            });
            // Don't call e.preventDefault() - let Radix UI handle the context menu
          }}
        >
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
              Cannot delete (has {milestone.tasks.length} task{milestone.tasks.length !== 1 ? 's' : ''})
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}