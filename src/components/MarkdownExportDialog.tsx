import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { FileText } from 'lucide-react';

interface MarkdownExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (includeMilestones: boolean, includeTasks: boolean) => void;
}

export function MarkdownExportDialog({
  open,
  onClose,
  onExport,
}: MarkdownExportDialogProps) {
  const [includeMilestones, setIncludeMilestones] = useState(true);
  const [includeTasks, setIncludeTasks] = useState(true);

  const handleExport = () => {
    if (!includeMilestones && !includeTasks) {
      // Show error or prevent export
      return;
    }
    onExport(includeMilestones, includeTasks);
    onClose();
  };

  const handleReset = () => {
    setIncludeMilestones(true);
    setIncludeTasks(true);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Export to Markdown
          </DialogTitle>
          <DialogDescription>
            Select the content to include in your Markdown export and generate a
            structured document.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="include-milestones"
                checked={includeMilestones}
                onCheckedChange={setIncludeMilestones}
              />
              <label
                htmlFor="include-milestones"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Include Milestones
              </label>
            </div>
            <div className="text-xs text-muted-foreground ml-6">
              Export milestone headers with goals and deliverable information
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="include-tasks"
                checked={includeTasks}
                onCheckedChange={setIncludeTasks}
              />
              <label
                htmlFor="include-tasks"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Include Tasks
              </label>
            </div>
            <div className="text-xs text-muted-foreground ml-6">
              Export individual tasks with duration, goals, and deliverables
            </div>
          </div>

          {!includeMilestones && !includeTasks && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              Please select at least one content type to export.
            </div>
          )}

          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded">
            <strong>Export Format:</strong>
            <br />
            • Project title as main header
            <br />
            • Milestones as section headers (##)
            <br />
            • Tasks as subsections (###)
            <br />• Structured information with goals and deliverables
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button
            onClick={handleExport}
            disabled={!includeMilestones && !includeTasks}
            className="flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Export Markdown
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
