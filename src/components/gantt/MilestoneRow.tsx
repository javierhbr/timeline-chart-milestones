import React from 'react';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
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
}: MilestoneRowProps) {
  const milestoneDates = calculateMilestoneDates(milestone);
  const milestoneStartDay = differenceInDays(milestoneDates.startDate, timelineStart);
  const milestoneDurationDays = differenceInDays(milestoneDates.endDate, milestoneDates.startDate) + 1;

  return (
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