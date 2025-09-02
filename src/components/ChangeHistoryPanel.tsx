import React, { useState, useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  History,
  RotateCcw,
  Clock,
  Filter,
  User,
  AlertTriangle,
  FileText,
  GitBranch,
  Calendar,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  ChangeHistoryEntry,
  EntityType,
  ChangeType,
  generateChangeDescription,
  groupHistoryByDate,
  getFilteredHistory,
} from '../utils/changeHistory';

interface ChangeHistoryPanelProps {
  changeHistory: ChangeHistoryEntry[];
  onRollback: (changeIndex: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ChangeHistoryPanel({
  changeHistory,
  onRollback,
  isOpen,
  onClose,
}: ChangeHistoryPanelProps) {
  const [filterEntityType, setFilterEntityType] = useState<EntityType | 'all'>(
    'all'
  );
  const [filterChangeType, setFilterChangeType] = useState<ChangeType | 'all'>(
    'all'
  );
  const [rollbackEntry, setRollbackEntry] = useState<{
    entry: ChangeHistoryEntry;
    index: number;
  } | null>(null);

  // Filter and group history entries
  const filteredHistory = useMemo(() => {
    const filters: Record<string, EntityType | ChangeType> = {};
    if (filterEntityType !== 'all') {
      filters.entityType = filterEntityType;
    }
    if (filterChangeType !== 'all') {
      filters.changeType = filterChangeType;
    }
    return getFilteredHistory(changeHistory, filters);
  }, [changeHistory, filterEntityType, filterChangeType]);

  const groupedHistory = useMemo(() => {
    return groupHistoryByDate(filteredHistory);
  }, [filteredHistory]);

  const handleRollbackClick = (entry: ChangeHistoryEntry, index: number) => {
    setRollbackEntry({ entry, index });
  };

  const handleConfirmRollback = () => {
    if (rollbackEntry) {
      // Find the actual index in the full changeHistory array
      const actualIndex = changeHistory.findIndex(
        e => e.entryId === rollbackEntry.entry.entryId
      );
      if (actualIndex !== -1) {
        onRollback(actualIndex);
      }
      setRollbackEntry(null);
    }
  };

  const getEntityIcon = (entityType: EntityType) => {
    switch (entityType) {
      case 'task':
        return <FileText className="h-4 w-4" />;
      case 'milestone':
        return <Calendar className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getChangeTypeColor = (changeType: ChangeType) => {
    switch (changeType) {
      case 'add':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'remove':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'name':
      case 'milestone_name':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'duration':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'dependency':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'task_move':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getChangeTypeLabel = (changeType: ChangeType) => {
    switch (changeType) {
      case 'add':
        return 'Added';
      case 'remove':
        return 'Removed';
      case 'name':
        return 'Name Change';
      case 'milestone_name':
        return 'Milestone Name';
      case 'description':
        return 'Description';
      case 'duration':
        return 'Duration';
      case 'team':
        return 'Team';
      case 'dependency':
        return 'Dependencies';
      case 'task_move':
        return 'Moved';
      case 'status':
        return 'Status';
      default:
        return changeType;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Change History
            </DialogTitle>
            <DialogDescription>
              View and manage the complete history of changes to your project
              timeline. You can rollback to any previous state.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <Filter className="h-4 w-4 text-gray-500" />
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Entity:</span>
                <Select
                  value={filterEntityType}
                  onValueChange={(value: EntityType | 'all') =>
                    setFilterEntityType(value)
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="task">Tasks</SelectItem>
                    <SelectItem value="milestone">Milestones</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Change:</span>
                <Select
                  value={filterChangeType}
                  onValueChange={(value: ChangeType | 'all') =>
                    setFilterChangeType(value)
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Changes</SelectItem>
                    <SelectItem value="add">Added</SelectItem>
                    <SelectItem value="remove">Removed</SelectItem>
                    <SelectItem value="name">Name Changes</SelectItem>
                    <SelectItem value="duration">Duration</SelectItem>
                    <SelectItem value="dependency">Dependencies</SelectItem>
                    <SelectItem value="task_move">Moves</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* History List */}
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {Object.keys(groupedHistory).length === 0 ? (
                  <div className="text-center py-8">
                    <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No change history available</p>
                    <p className="text-sm text-gray-400">
                      Changes will appear here as you modify your timeline
                    </p>
                  </div>
                ) : (
                  Object.entries(groupedHistory)
                    .sort(
                      ([a], [b]) =>
                        new Date(b).getTime() - new Date(a).getTime()
                    )
                    .map(([date, entries]) => (
                      <div key={date} className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {date}
                        </h3>
                        <div className="space-y-2 ml-6">
                          {entries
                            .sort((a, b) => b.timestamp - a.timestamp)
                            .map(entry => {
                              const actualIndex = changeHistory.findIndex(
                                e => e.entryId === entry.entryId
                              );
                              return (
                                <Card
                                  key={entry.entryId}
                                  className="border-l-4 border-l-gray-200"
                                >
                                  <CardContent className="p-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3 flex-1">
                                        <div className="flex items-center gap-2">
                                          {getEntityIcon(entry.entityType)}
                                          <Badge
                                            variant="outline"
                                            className={`text-xs ${getChangeTypeColor(entry.changeType)}`}
                                          >
                                            {getChangeTypeLabel(
                                              entry.changeType
                                            )}
                                          </Badge>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm text-gray-900 truncate">
                                            {generateChangeDescription(entry)}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            {formatDistanceToNow(
                                              new Date(entry.timestamp),
                                              { addSuffix: true }
                                            )}
                                            {entry.user && (
                                              <span className="inline-flex items-center gap-1 ml-2">
                                                <User className="h-3 w-3" />
                                                {entry.user}
                                              </span>
                                            )}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            handleRollbackClick(
                                              entry,
                                              actualIndex
                                            )
                                          }
                                          className="h-8 px-2 text-xs"
                                          disabled={
                                            actualIndex ===
                                            changeHistory.length - 1
                                          }
                                        >
                                          <RotateCcw className="h-3 w-3 mr-1" />
                                          Rollback
                                        </Button>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </ScrollArea>

            {/* Summary */}
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <GitBranch className="h-4 w-4" />
                <span>
                  {filteredHistory.length} of {changeHistory.length} changes
                  shown
                </span>
              </div>
              <div className="text-xs text-blue-600">
                Rollback will delete all changes after the selected point
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Confirmation Dialog */}
      {rollbackEntry && (
        <Dialog open={true} onOpenChange={() => setRollbackEntry(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Confirm Rollback
              </DialogTitle>
              <DialogDescription>
                This action will rollback your timeline to the following state:
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <Card className="border-l-4 border-l-orange-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {getEntityIcon(rollbackEntry.entry.entityType)}
                    <Badge
                      variant="outline"
                      className={`text-xs ${getChangeTypeColor(rollbackEntry.entry.changeType)}`}
                    >
                      {getChangeTypeLabel(rollbackEntry.entry.changeType)}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-900 mb-2">
                    {generateChangeDescription(rollbackEntry.entry)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDistanceToNow(
                      new Date(rollbackEntry.entry.timestamp),
                      { addSuffix: true }
                    )}
                  </p>
                </CardContent>
              </Card>

              <div className="mt-4 p-3 bg-orange-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-orange-700">
                    <p className="font-medium">Warning:</p>
                    <p>
                      All changes made after "
                      {generateChangeDescription(rollbackEntry.entry)}" will be
                      permanently deleted. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setRollbackEntry(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirmRollback}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Rollback Timeline
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
