import React from 'react';
import { ChevronDown, ChevronRight, GripVertical, GripHorizontal } from 'lucide-react';
import { MilestoneContextMenu } from '../MilestoneContextMenu';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { calculateMilestoneDates } from '../../utils/dateUtils';
import type { Milestone } from '../../utils/dateUtils';

interface MilestoneColor {
  main: string;
  secondary: string;
  gentle: string;
  gentleHover: string;
}

interface MilestoneRowProps {
  milestone: Milestone;
  milestoneColor: MilestoneColor;
  isExpanded: boolean;
  timelineStart: Date;
  zoomLevel: number;
  dayColumnsLength: number;
  gridNameColumns: string;
  onToggle: (milestoneId: string) => void;
  onEdit: (milestone: Milestone) => void;
  onAddTask: (milestone: Milestone) => void;
  onResizeStart: (e: React.MouseEvent) => void;
  onDragStart?: (milestoneId: string, index: number) => void;
  onDragOver?: (index: number) => void;
  onDragEnd?: () => void;
  dragIndex?: number;
  isDragging?: boolean;
  isDragTarget?: boolean;
}

export function MilestoneRow({
  milestone,
  milestoneColor,
  isExpanded,
  timelineStart,
  zoomLevel,
  dayColumnsLength,
  gridNameColumns,
  onToggle,
  onEdit,
  onAddTask,
  onResizeStart,
  onDragStart,
  onDragOver,
  onDragEnd,
  dragIndex,
  isDragging = false,
  isDragTarget = false,
}: MilestoneRowProps) {
  const milestoneDates = calculateMilestoneDates(milestone);
  const milestoneStartDay = differenceInDays(milestoneDates.startDate, timelineStart);
  const milestoneDurationDays = differenceInDays(milestoneDates.endDate, milestoneDates.startDate) + 1;

  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStart && dragIndex !== undefined) {
      console.log('🎯 MILESTONE ROW DRAG START:', milestone.milestoneName);
      onDragStart(milestone.milestoneId, dragIndex);
      e.dataTransfer.effectAllowed = 'move';
      // Add some visual feedback
      (e.currentTarget as HTMLElement).style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    console.log('🎯 MILESTONE ROW DRAG END:', milestone.milestoneName);
    (e.currentTarget as HTMLElement).style.opacity = '';
    if (onDragEnd) {
      onDragEnd();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (onDragOver && dragIndex !== undefined && !isDragging) {
      console.log('🎯 MILESTONE ROW DRAG OVER:', milestone.milestoneName, 'dragIndex:', dragIndex);
      onDragOver(dragIndex);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    console.log('🎯 MILESTONE ROW DROP:', milestone.milestoneName);
  };

  return (
    <tr
      className={`border-b min-h-[72px] relative transition-all duration-200 ${
        isDragging ? 'opacity-50 bg-primary/5' : ''
      } ${
        isDragTarget ? 'border-primary border-2 bg-primary/10' : ''
      }`}
      style={{
        backgroundColor: isDragging 
          ? `${milestoneColor.gentle}80` 
          : milestoneColor.gentle,
        borderLeft: `4px solid ${milestoneColor.main}`,
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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
          <div className="flex items-center gap-1">
            {/* Drag Handle */}
            {onDragStart && (
              <div
                className="cursor-move p-1 rounded hover:bg-muted/50 transition-colors opacity-60 hover:opacity-100 flex-shrink-0"
                title="Drag to reorder milestones"
                draggable={true}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <GripHorizontal className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            
            <div className="flex-1">
              <MilestoneContextMenu
                milestone={milestone}
                isExpanded={isExpanded}
                onEdit={onEdit}
                onAddTask={onAddTask}
                onToggle={(m) => onToggle(m.milestoneId)}
              >
                <button
                  onClick={() => onToggle(milestone.milestoneId)}
                  className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded-lg p-3 transition-colors min-h-[44px]"
                >
                  {isExpanded ? (
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
          </div>
        </div>
        {/* Drag Resize Handle with Icon - Highly Visible */}
        <div
          className="absolute top-0 right-0 w-6 h-full cursor-col-resize bg-blue-50 hover:bg-blue-100 border-l-3 border-r-3 border-blue-300 hover:border-blue-500 z-30 flex items-center justify-center transition-all duration-200 group shadow-sm"
          onMouseDown={onResizeStart}
          title="⟷ Arrastra para redimensionar columna"
        >
          <GripVertical className="w-4 h-4 text-blue-600 group-hover:text-blue-800 transition-colors font-semibold" />
        </div>
      </td>

      {/* Milestone Timeline Cell */}
      <td
        className="p-0 h-[72px] relative"
        style={{
          width: `${dayColumnsLength * zoomLevel}px`,
        }}
      >
        <div className="h-full relative">
          <div
            className="h-full relative"
            style={{
              width: `${dayColumnsLength * zoomLevel}px`,
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
  );
}