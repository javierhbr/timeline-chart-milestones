import React from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu';
import {
  Copy,
  Scissors,
  Move,
  Edit,
  Trash2,
} from 'lucide-react';
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
    console.log('🚫 TaskContextMenu DISABLED for task:', task.name);
    return <>{children}</>;
  }

  console.log('🎯 TaskContextMenu RENDERED for task:', task.name, {
    hasCloneHandler: !!onClone,
    hasSplitHandler: !!onSplit,
    hasMoveHandler: !!onMove,
    hasEditHandler: !!onEdit,
    hasDeleteHandler: !!onDelete,
    taskId: task.taskId,
    team: task.team
  });


  const handleClone = (e: Event) => {
    console.log('🔄 CLONE HANDLER TRIGGERED for:', task.name);
    e.preventDefault();
    if (onClone) {
      console.log('✅ Calling onClone handler');
      onClone(task);
    } else {
      console.log('❌ No onClone handler available');
    }
  };

  const handleSplit = (e: Event) => {
    console.log('🔪 SPLIT HANDLER TRIGGERED for:', task.name);
    e.preventDefault();
    if (onSplit) {
      console.log('✅ Calling onSplit handler');
      onSplit(task);
    } else {
      console.log('❌ No onSplit handler available');
    }
  };

  const handleMove = (e: Event) => {
    console.log('📦 MOVE HANDLER TRIGGERED for:', task.name);
    e.preventDefault();
    if (onMove) {
      console.log('✅ Calling onMove handler');
      onMove(task);
    } else {
      console.log('❌ No onMove handler available');
    }
  };

  const handleEdit = (e: Event) => {
    console.log('✏️ EDIT HANDLER TRIGGERED for:', task.name);
    e.preventDefault();
    if (onEdit) {
      console.log('✅ Calling onEdit handler');
      onEdit(task);
    } else {
      console.log('❌ No onEdit handler available');
    }
  };

  const handleDelete = (e: Event) => {
    console.log('🗑️ DELETE HANDLER TRIGGERED for:', task.name);
    e.preventDefault();
    if (onDelete) {
      console.log('✅ Calling onDelete handler');
      onDelete(task);
    } else {
      console.log('❌ No onDelete handler available');
    }
  };

  return (
    <ContextMenu 
      onOpenChange={(open) => {
        console.log('🔄 ContextMenu state changed:', { 
          open, 
          taskName: task.name,
          taskId: task.taskId 
        });
      }}
    >
      <ContextMenuTrigger asChild>
        <div 
          onContextMenu={(e) => {
            console.log('🖱️ RIGHT-CLICK DETECTED on TaskContextMenu wrapper:', task.name, {
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
        
        {(onClone || onSplit || onMove) && onDelete && (
          <ContextMenuSeparator />
        )}
        
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