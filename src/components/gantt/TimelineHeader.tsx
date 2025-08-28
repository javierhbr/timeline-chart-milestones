import React, { memo, useMemo } from 'react';
import { GripVertical } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface DeliverableMarker {
  name: string;
  date: Date;
  position: number;
}

interface DayColumn {
  date: Date;
  dayOfWeek: number;
  isWeekStart: boolean;
  weekNumber: number;
  isNewMonth: boolean;
  monthName: string;
  year: number;
}

interface TimelineHeaderProps {
  dayColumns: DayColumn[];
  zoomLevel: number;
  deliverableMarkers: DeliverableMarker[];
  timelineStart: Date;
  gridNameColumns: string;
  onResizeStart: (e: React.MouseEvent) => void;
}

const TimelineHeader = memo(function TimelineHeader({
  dayColumns,
  zoomLevel,
  deliverableMarkers,
  timelineStart,
  gridNameColumns,
  onResizeStart,
}: TimelineHeaderProps) {
  // Memoize expensive month grouping calculation
  const monthGroups = useMemo(() => {
    const groups: {
      month: string;
      year: number;
      startIndex: number;
      width: number;
    }[] = [];
    let currentMonth = '';
    let currentYear = 0;
    let startIndex = 0;

    dayColumns.forEach((day, index) => {
      if (day.isNewMonth || index === 0) {
        if (currentMonth && groups.length > 0) {
          groups[groups.length - 1].width = (index - startIndex) * zoomLevel;
        }
        currentMonth = day.monthName;
        currentYear = day.year;
        startIndex = index;
        groups.push({
          month: currentMonth,
          year: currentYear,
          startIndex,
          width: 0,
        });
      }

      if (index === dayColumns.length - 1) {
        groups[groups.length - 1].width = (index - startIndex + 1) * zoomLevel;
      }
    });

    return groups;
  }, [dayColumns, zoomLevel]);

  // Memoize deliverable markers by day for better performance
  const deliverablesByDay = useMemo(() => {
    const markersByDay = new Map<number, DeliverableMarker[]>();

    deliverableMarkers.forEach(marker => {
      const markerDay = differenceInDays(marker.date, timelineStart);
      if (!markersByDay.has(markerDay)) {
        markersByDay.set(markerDay, []);
      }
      markersByDay.get(markerDay)!.push(marker);
    });

    return markersByDay;
  }, [deliverableMarkers, timelineStart]);

  return (
    <thead>
      <tr>
        {/* Fixed Header Column */}
        <th
          className="bg-muted/50 border-r sticky left-0 z-30 shadow-lg relative"
          style={{
            width: gridNameColumns,
            minWidth: gridNameColumns,
            maxWidth: gridNameColumns,
            position: 'sticky',
            left: 0,
          }}
        >
          <div className="p-4 text-left bg-muted/50">
            <h3 className="text-lg font-semibold">Milestones and Tasks</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Project hierarchical organization
            </p>
          </div>
          {/* Drag Resize Handle with Icon - Highly Visible */}
          <div
            className="absolute top-0 right-0 w-8 h-full cursor-col-resize bg-blue-100 hover:bg-blue-200 border-l-4 border-r-4 border-blue-400 hover:border-blue-600 z-40 flex items-center justify-center transition-all duration-200 group shadow-md"
            onMouseDown={onResizeStart}
            title="⟷ Arrastra para redimensionar columna"
          >
            <GripVertical className="w-5 h-5 text-blue-700 group-hover:text-blue-900 transition-colors font-bold" />
          </div>
        </th>

        {/* Timeline Header */}
        <th
          className="bg-muted/50 relative"
          style={{ width: `${dayColumns.length * zoomLevel}px` }}
        >
          <div className="flex flex-col">
            {/* Month Header Row */}
            <div className="flex border-b border-muted-foreground/20 pb-1">
              {monthGroups.map((group, _idx) => (
                <div
                  key={`month-${group.startIndex}-${group.month}-${group.year}`}
                  className="flex items-center justify-center text-sm font-semibold text-primary bg-primary/5 border-r border-muted-foreground/20"
                  style={{
                    width: `${group.width}px`,
                    minWidth: `${group.width}px`,
                  }}
                >
                  {zoomLevel >= 32 ? (
                    <div className="text-center">
                      <div>{group.month}</div>
                      <div className="text-xs text-muted-foreground">
                        {group.year}
                      </div>
                    </div>
                  ) : zoomLevel >= 16 ? (
                    `${group.month} ${group.year}`
                  ) : (
                    `${group.month.slice(0, 3)} ${group.year}`
                  )}
                </div>
              ))}
            </div>

            {/* Week Header Row */}
            <div className="flex">
              {dayColumns.map((day, index) => {
                const dayMarkers = deliverablesByDay.get(index) || [];

                return (
                  <div
                    key={`day-${day.date.getTime()}-${index}`}
                    className={`relative text-xs flex-shrink-0 ${day.isWeekStart ? 'border-l-2 border-l-blue-500' : ''}`}
                    style={{
                      width: `${zoomLevel}px`,
                      minWidth: `${zoomLevel}px`,
                    }}
                  >
                    {/* Show date only on Mondays (week start) - adaptive based on zoom */}
                    {day.isWeekStart && (
                      <div className="px-0.5 py-0.5 text-center">
                        {zoomLevel >= 24 ? (
                          <>
                            <div className="text-[9px] font-medium">
                              {format(day.date, 'dd/MM', {
                                locale: es,
                              })}
                            </div>
                            <div className="text-[7px] text-muted-foreground">
                              Sem {day.weekNumber + 1}
                            </div>
                          </>
                        ) : zoomLevel >= 12 ? (
                          <div className="text-[7px] font-medium transform -rotate-90 origin-center whitespace-nowrap">
                            {format(day.date, 'dd/MM', { locale: es })}
                          </div>
                        ) : (
                          <div className="text-[6px] font-medium transform -rotate-90 origin-center whitespace-nowrap">
                            {format(day.date, 'dd/M', { locale: es })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Deliverable markers for this specific day */}
                    {dayMarkers.map((marker, markerIndex) => (
                      <div
                        key={`deliverable-${marker.name}-${markerIndex}`}
                        className="absolute top-0 left-1/2 transform -translate-x-1/2 flex flex-col items-center z-30 pointer-events-none"
                      >
                        <div className="flex flex-col items-center">
                          <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[8px] border-t-red-600 drop-shadow-sm"></div>
                          <div className="w-0.5 h-12 bg-red-600"></div>
                        </div>
                        <div className="absolute top-6 bg-white border border-gray-300 rounded-md px-1 py-0.5 text-[10px] whitespace-nowrap shadow-lg opacity-0 hover:opacity-100 transition-opacity pointer-events-auto z-40">
                          <div className="font-medium text-gray-900">
                            Deliverable
                          </div>
                          <div className="text-gray-600 text-[8px]">
                            {marker.name}
                          </div>
                          <div className="text-gray-500 text-[8px]">
                            {format(marker.date, 'd MMM yyyy', {
                              locale: es,
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </th>
      </tr>
    </thead>
  );
});

export { TimelineHeader };
