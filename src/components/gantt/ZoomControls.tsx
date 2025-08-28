import React from 'react';
import { Button } from '../ui/button';
import {
  ChevronDown,
  ChevronUp,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Plus,
} from 'lucide-react';

interface ZoomControlsProps {
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  expandAllMilestones?: () => void;
  collapseAllMilestones?: () => void;
  onCreateMilestone?: () => void;
}

export function ZoomControls({
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  expandAllMilestones,
  collapseAllMilestones,
  onCreateMilestone,
}: ZoomControlsProps) {
  return (
    <div className="flex items-center gap-2 mb-4 p-2 bg-muted/30 rounded-lg">
      <span className="text-sm font-medium mr-2">Zoom:</span>
      <Button
        variant="outline"
        size="sm"
        onClick={onZoomOut}
        disabled={zoomLevel <= 8}
        className="flex items-center gap-1"
      >
        <ZoomOut className="w-4 h-4" />
        Out
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onResetZoom}
        className="flex items-center gap-1"
      >
        <RotateCcw className="w-4 h-4" />
        Reset
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onZoomIn}
        disabled={zoomLevel >= 80}
        className="flex items-center gap-1"
      >
        <ZoomIn className="w-4 h-4" />
        In
      </Button>
      <div className="ml-3 px-2 py-1 bg-muted rounded text-xs font-medium">
        {Math.round(zoomLevel)}px/día
      </div>

      {/* Expand/Collapse Controls */}
      {expandAllMilestones && collapseAllMilestones && (
        <>
          <div className="mx-2 h-4 w-px bg-muted-foreground/30"></div>
          <span className="text-sm font-medium">Milestones:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={expandAllMilestones}
            className="flex items-center gap-1"
          >
            <ChevronDown className="w-4 h-4" />
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={collapseAllMilestones}
            className="flex items-center gap-1"
          >
            <ChevronUp className="w-4 h-4" />
            Collapse All
          </Button>
        </>
      )}

      {/* Create Milestone Control */}
      {onCreateMilestone && (
        <>
          <div className="mx-2 h-4 w-px bg-muted-foreground/30"></div>
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateMilestone}
            className="flex items-center gap-1 bg-primary/5 hover:bg-primary/10 border-primary/20"
          >
            <Plus className="w-4 h-4" />
            Add Milestone
          </Button>
        </>
      )}
    </div>
  );
}
