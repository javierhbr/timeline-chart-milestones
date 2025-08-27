import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { ConfirmationDialog } from './ConfirmationDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import {
  Plus,
  FolderOpen,
  MoreVertical,
  Edit2,
  Copy,
  Trash2,
  Calendar,
  Clock,
  Search,
  Grid3X3,
  List,
} from 'lucide-react';
import {
  Project,
  listProjects,
  createProject,
  renameProject,
  duplicateProject,
  deleteProject,
  generateDefaultProjectName,
  TimelineData,
} from '../utils/projectStorage';
import { formatDistanceToNow } from 'date-fns';

interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject: (project: Project) => void;
  currentProjectId?: string | null;
}

type ViewMode = 'grid' | 'list';

export function ProjectManager({
  isOpen,
  onClose,
  onSelectProject,
  currentProjectId,
}: ProjectManagerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Load projects when component mounts or dialog opens
  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  // Filter projects based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProjects(projects);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredProjects(
        projects.filter(
          project =>
            project.name.toLowerCase().includes(query) ||
            new Date(project.lastModified).toLocaleDateString().includes(query)
        )
      );
    }
  }, [projects, searchQuery]);

  const loadProjects = () => {
    const allProjects = listProjects();
    setProjects(allProjects);
  };

  const handleCreateProject = () => {
    if (!newProjectName.trim()) {
      return;
    }

    const emptyTimelineData: TimelineData = {
      milestones: [],
      projectStartDate: new Date().toISOString(),
      expandedMilestones: [],
    };

    const newProject = createProject(newProjectName.trim(), emptyTimelineData, true);
    loadProjects();
    setNewProjectName('');
    setShowNewProjectDialog(false);
    onSelectProject(newProject);
    onClose();
  };

  const handleRenameProject = () => {
    if (!selectedProject || !newProjectName.trim()) {
      return;
    }

    renameProject(selectedProject.id, newProjectName.trim());
    loadProjects();
    setNewProjectName('');
    setSelectedProject(null);
    setShowRenameDialog(false);
  };

  const handleDuplicateProject = (project: Project) => {
    const duplicated = duplicateProject(project.id);
    if (duplicated) {
      loadProjects();
    }
  };

  const handleDeleteProject = () => {
    if (!selectedProject) {
      return;
    }

    deleteProject(selectedProject.id);
    loadProjects();
    setSelectedProject(null);
    setShowDeleteDialog(false);
  };

  const openNewProjectDialog = () => {
    setNewProjectName(generateDefaultProjectName());
    setShowNewProjectDialog(true);
  };

  const openRenameDialog = (project: Project) => {
    setSelectedProject(project);
    setNewProjectName(project.name);
    setShowRenameDialog(true);
  };

  const openDeleteDialog = (project: Project) => {
    setSelectedProject(project);
    setShowDeleteDialog(true);
  };

  const formatProjectStats = (project: Project) => {
    const { milestones } = project.timelineData;
    const totalTasks = milestones.reduce((acc, m) => acc + m.tasks.length, 0);
    const totalMilestones = milestones.length;
    return { totalTasks, totalMilestones };
  };

  const ProjectCard = ({ project }: { project: Project }) => {
    const { totalTasks, totalMilestones } = formatProjectStats(project);
    const isCurrentProject = project.id === currentProjectId;

    return (
      <Card className={`p-5 hover:shadow-lg transition-all duration-200 cursor-pointer relative border-2 ${
        isCurrentProject 
          ? 'border-blue-500 bg-blue-50/50 shadow-md' 
          : 'border-transparent hover:border-gray-200'
      }`}>
        <div
          onClick={() => {
            onSelectProject(project);
            onClose();
          }}
          className="flex-1"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2" style={{width: 'calc(100% - 40px)'}}>
              {isCurrentProject && (
                <div className="h-2.5 w-2.5 rounded-full bg-blue-500 flex-shrink-0" title="Current project" />
              )}
              <h3 className="font-semibold text-lg truncate text-gray-900">{project.name}</h3>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-gray-100"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    openRenameDialog(project);
                  }}
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    handleDuplicateProject(project);
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    openDeleteDialog(project);
                  }}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2 text-sm text-gray-600">
                <FolderOpen className="h-4 w-4 text-blue-500" />
                <span className="font-medium">{totalMilestones}</span> milestones
              </span>
              <span className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4 text-green-500" />
                <span className="font-medium">{totalTasks}</span> tasks
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-gray-100">
              <Clock className="h-3 w-3" />
              Modified {formatDistanceToNow(new Date(project.lastModified), { addSuffix: true })}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const ProjectListItem = ({ project }: { project: Project }) => {
    const { totalTasks, totalMilestones } = formatProjectStats(project);
    const isCurrentProject = project.id === currentProjectId;

    return (
      <Card className={`p-4 hover:shadow-md transition-all duration-200 cursor-pointer border-l-4 ${
        isCurrentProject 
          ? 'border-l-blue-500 bg-blue-50/30 shadow-sm' 
          : 'border-l-transparent hover:border-l-gray-300'
      }`}>
        <div
          onClick={() => {
            onSelectProject(project);
            onClose();
          }}
          className="flex items-start justify-between gap-4"
        >
          <div className="flex-1 min-w-0" style={{width: 'calc(100% - 40px)'}}>
            <div className="flex items-center gap-2 mb-2">
              {isCurrentProject && (
                <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" title="Current project" />
              )}
              <h3 className="font-semibold text-base truncate text-gray-900">
                {project.name}
              </h3>
            </div>
            <div className="pl-4">
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <FolderOpen className="h-3 w-3 flex-shrink-0" />
                  {totalMilestones} milestones
                </span>
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <Calendar className="h-3 w-3 flex-shrink-0" />
                  {totalTasks} tasks
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  Modified {formatDistanceToNow(new Date(project.lastModified), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>

          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-gray-100"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  openRenameDialog(project);
                }}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  handleDuplicateProject(project);
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  openDeleteDialog(project);
                }}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent 
          className="max-h-[85vh] overflow-hidden flex flex-col p-0"
          style={{ width: '50vw', maxWidth: 'none' }}
        >
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FolderOpen className="h-6 w-6" />
              Project Manager
            </DialogTitle>
            <DialogDescription className="text-base mt-1">
              Create, manage, and switch between your Gantt timeline projects.
            </DialogDescription>
            <div className="text-sm text-muted-foreground mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded mx-6">
              ⚠️ All project data is saved locally in your browser's storage and will be lost if you clear browser data.
            </div>
          </DialogHeader>

          <div className="flex items-center justify-between gap-4 px-6 py-4 bg-gray-50/50">
            <div className="flex-1 relative max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-r-none"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-l-none"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              <Button onClick={openNewProjectDialog} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto px-6 py-4">
            {filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FolderOpen className="h-16 w-16 text-muted-foreground mb-6" />
                <h3 className="text-xl font-semibold mb-2">
                  {projects.length === 0 ? 'No projects yet' : 'No projects found'}
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  {projects.length === 0
                    ? 'Create your first project to get started with organizing your Gantt timelines.'
                    : 'Try adjusting your search terms to find the project you\'re looking for.'}
                </p>
                {projects.length === 0 && (
                  <Button onClick={openNewProjectDialog} size="lg">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Project
                  </Button>
                )}
              </div>
            ) : (
              <div
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 gap-4'
                    : 'space-y-4'
                }
              >
                {filteredProjects.map(project =>
                  viewMode === 'grid' ? (
                    <ProjectCard key={project.id} project={project} />
                  ) : (
                    <ProjectListItem key={project.id} project={project} />
                  )
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* New Project Dialog */}
      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Enter a name for your new project. You can always change it later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              id="projectName"
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              placeholder="Enter project name..."
              className="mt-2"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleCreateProject();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewProjectDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim()}
            >
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Project Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
            <DialogDescription>
              Enter a new name for "{selectedProject?.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="newProjectName">Project Name</Label>
            <Input
              id="newProjectName"
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              placeholder="Enter new project name..."
              className="mt-2"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleRenameProject();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRenameProject}
              disabled={!newProjectName.trim()}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Dialog */}
      <ConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteProject}
        title="Delete Project"
        description={`Are you sure you want to delete "${selectedProject?.name}"? This action cannot be undone and all project data will be permanently removed.`}
        confirmLabel="Delete Project"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </>
  );
}