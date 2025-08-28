import React from 'react';
import { format, differenceInDays } from 'date-fns';
import { calculateMilestoneDates } from '../../utils/dateUtils';
import type { Milestone } from '../../utils/dateUtils';

interface ProjectInfoProps {
  projectStart: Date;
  projectEnd: Date;
  timelineStart: Date;
  timelineEnd: Date;
  totalDays: number;
  sortedMilestones: Array<{ milestone: Milestone; originalIndex: number }>;
}

export function ProjectInfo({
  projectStart,
  projectEnd,
  timelineStart,
  timelineEnd,
  totalDays,
  sortedMilestones,
}: ProjectInfoProps) {
  const firstMilestoneDuration = sortedMilestones[0] 
    ? (() => {
        const dates = calculateMilestoneDates(sortedMilestones[0].milestone);
        return differenceInDays(dates.endDate, dates.startDate);
      })()
    : 0;

  return (
    <div className="border-b bg-yellow-50 p-2 text-xs">
      <div className="flex gap-4">
        <span>
          Project: {format(projectStart, 'dd/MM/yyyy')} -{' '}
          {format(projectEnd, 'dd/MM/yyyy')}
        </span>
        <span>
          Timeline: {format(timelineStart, 'dd/MM/yyyy')} -{' '}
          {format(timelineEnd, 'dd/MM/yyyy')}
        </span>
        <span>Total Days: {totalDays}</span>
        <span>Total Milestones: {sortedMilestones.length}</span>
        <span>
          First Milestone Duration: {firstMilestoneDuration} days
        </span>
      </div>
    </div>
  );
}