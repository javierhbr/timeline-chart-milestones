import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Milestone } from '../utils/dateUtils';
import { Trash2, Edit2, Plus } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface TeamManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  teams: string[];
  milestones: Milestone[];
  onAddTeam: (teamName: string) => void;
  onEditTeam: (oldName: string, newName: string) => void;
  onDeleteTeam: (teamName: string) => void;
}

export function TeamManagementDialog({
  isOpen,
  onClose,
  teams,
  milestones,
  onAddTeam,
  onEditTeam,
  onDeleteTeam,
}: TeamManagementDialogProps) {
  const [newTeamName, setNewTeamName] = useState('');
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [teamToDelete, setTeamToDelete] = useState<string | null>(null);

  // Count tasks per team
  const teamTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    milestones.forEach(milestone => {
      milestone.tasks.forEach(task => {
        if (task.team) {
          counts[task.team] = (counts[task.team] || 0) + 1;
        }
      });
    });
    return counts;
  }, [milestones]);

  const handleAddTeam = () => {
    const trimmedName = newTeamName.trim();

    if (!trimmedName) {
      alert('Team name cannot be empty');
      return;
    }

    if (teams.includes(trimmedName)) {
      alert('Team already exists');
      return;
    }

    onAddTeam(trimmedName);
    setNewTeamName('');
  };

  const handleEditTeam = (oldName: string) => {
    setEditingTeam(oldName);
    setEditingValue(oldName);
  };

  const handleSaveEdit = (oldName: string) => {
    const trimmedValue = editingValue.trim();

    if (!trimmedValue) {
      alert('Team name cannot be empty');
      return;
    }

    if (trimmedValue === oldName) {
      setEditingTeam(null);
      return;
    }

    if (teams.includes(trimmedValue)) {
      alert('Team name already exists');
      return;
    }

    onEditTeam(oldName, trimmedValue);
    setEditingTeam(null);
  };

  const handleDeleteTeam = (teamName: string) => {
    setTeamToDelete(teamName);
  };

  const confirmDeleteTeam = () => {
    if (teamToDelete) {
      onDeleteTeam(teamToDelete);
      setTeamToDelete(null);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    action: () => void
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditingTeam(null);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Teams</DialogTitle>
            <DialogDescription>
              Add, edit, or delete teams for this project
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add new team */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Add New Team</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Team name"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, handleAddTeam)}
                />
                <Button
                  onClick={handleAddTeam}
                  size="sm"
                  className="whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>

            {/* Teams list */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Teams</label>
              <div className="border rounded-lg p-3 space-y-2 max-h-64 overflow-y-auto">
                {teams.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No teams yet. Add your first team above.
                  </p>
                ) : (
                  teams.map(team => (
                    <div
                      key={team}
                      className="flex items-center justify-between gap-2 p-2 rounded border hover:bg-accent transition-colors"
                    >
                      {editingTeam === team ? (
                        <Input
                          type="text"
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          onBlur={() => handleSaveEdit(team)}
                          onKeyDown={e => handleKeyDown(e, () => handleSaveEdit(team))}
                          autoFocus
                          className="h-8"
                        />
                      ) : (
                        <div className="flex-1">
                          <p className="text-sm font-medium">{team}</p>
                          {teamTaskCounts[team] > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {teamTaskCounts[team]} task{teamTaskCounts[team] !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      )}

                      {editingTeam !== team && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTeam(team)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTeam(team)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!teamToDelete} onOpenChange={open => !open && setTeamToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the team "{teamToDelete}"?
              {teamTaskCounts[teamToDelete!] > 0 && (
                <span>
                  {' '}
                  This will orphan {teamTaskCounts[teamToDelete!]} task
                  {teamTaskCounts[teamToDelete!] !== 1 ? 's' : ''} (they will have no team assigned).
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTeam}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
