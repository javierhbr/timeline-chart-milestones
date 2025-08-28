import React, { useState, useCallback, useEffect } from 'react';
import { JsonImportExport } from './components/JsonImportExport';
import { GanttTimeline } from './components/GanttTimeline';
import { Card } from './components/ui/card';
import { Badge } from './components/ui/badge';
import {
  Milestone,
  Task,
  calculateProjectDates,
  teamColors,
} from './utils/dateUtils';
import {
  Project,
  TimelineData,
  getCurrentProject,
  saveProject,
  createProject,
  migrateOldData,
  hasAnyProjects,
  generateDefaultProjectName,
} from './utils/projectStorage';
import { ProjectManager } from './components/ProjectManager';
import { ConfirmationDialog } from './components/ConfirmationDialog';
import { BarChart3, Calendar, Users, Clock, BarChart } from 'lucide-react';

export default function App() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [projectStartDate, setProjectStartDate] = useState<Date>(
    new Date('2024-08-26')
  );
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(
    new Set()
  );
  const [milestoneOrder, setMilestoneOrder] = useState<string[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingProject, setPendingProject] = useState<Project | null>(null);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] =
    useState(false);

  // Initialize app and load current project on component mount
  useEffect(() => {
    const initializeApp = () => {
      // Migrate old data if necessary
      migrateOldData();

      // Load current project or show project manager if no projects exist
      const project = getCurrentProject();
      if (project) {
        const projectStartDate = new Date(
          project.timelineData.projectStartDate
        );

        // Ensure milestones have calculated dates
        const milestonesWithDates =
          project.timelineData.milestones.length > 0 &&
          project.timelineData.milestones[0].tasks.length > 0 &&
          !project.timelineData.milestones[0].tasks[0].startDate
            ? calculateProjectDates(
                project.timelineData.milestones,
                projectStartDate
              )
            : project.timelineData.milestones;

        setCurrentProject(project);
        setMilestones(milestonesWithDates);
        setProjectStartDate(projectStartDate);
        setExpandedMilestones(new Set(project.timelineData.expandedMilestones));
        setMilestoneOrder(project.timelineData.milestoneOrder || []);
        setHasUnsavedChanges(false);
      } else if (!hasAnyProjects()) {
        // Create default project for new users
        const emptyTimelineData: TimelineData = {
          milestones: [],
          projectStartDate: new Date().toISOString(),
          expandedMilestones: [],
          milestoneOrder: [],
        };
        const newProject = createProject(
          generateDefaultProjectName(),
          emptyTimelineData,
          true
        );
        setCurrentProject(newProject);
        setMilestones(newProject.timelineData.milestones);
        setProjectStartDate(new Date(newProject.timelineData.projectStartDate));
        setExpandedMilestones(
          new Set(newProject.timelineData.expandedMilestones)
        );
        setMilestoneOrder(newProject.timelineData.milestoneOrder || []);
        setHasUnsavedChanges(false);
      } else {
        // Has projects but none selected - show project manager
        setShowProjectManager(true);
      }
    };

    initializeApp();
  }, []);

  // Auto-save current project whenever timeline data changes
  useEffect(() => {
    if (currentProject && milestones.length > 0) {
      const timelineData: TimelineData = {
        milestones,
        projectStartDate: projectStartDate.toISOString(),
        expandedMilestones: Array.from(expandedMilestones),
        milestoneOrder,
      };
      saveProject(currentProject.id, timelineData);
      setHasUnsavedChanges(false);
    }
  }, [
    milestones,
    projectStartDate,
    expandedMilestones,
    milestoneOrder,
    currentProject,
  ]);

  // Track unsaved changes (only set to true when values actually change)
  const [initialLoad, setInitialLoad] = useState(true);
  useEffect(() => {
    if (currentProject && !initialLoad) {
      setHasUnsavedChanges(true);
    }
  }, [
    milestones,
    projectStartDate,
    expandedMilestones,
    milestoneOrder,
    currentProject,
    initialLoad,
  ]);

  // Reset initial load flag after first load
  useEffect(() => {
    if (currentProject && initialLoad) {
      setInitialLoad(false);
    }
  }, [currentProject, initialLoad]);

  const loadProjectData = useCallback((project: Project) => {
    setCurrentProject(project);
    const projectStartDate = new Date(project.timelineData.projectStartDate);

    // Ensure milestones have calculated dates
    const milestonesWithDates =
      project.timelineData.milestones.length > 0 &&
      project.timelineData.milestones[0].tasks.length > 0 &&
      !project.timelineData.milestones[0].tasks[0].startDate
        ? calculateProjectDates(
            project.timelineData.milestones,
            projectStartDate
          )
        : project.timelineData.milestones;

    setMilestones(milestonesWithDates);
    setProjectStartDate(projectStartDate);
    setExpandedMilestones(new Set(project.timelineData.expandedMilestones));
    setMilestoneOrder(project.timelineData.milestoneOrder || []);
    setHasUnsavedChanges(false);
  }, []);

  const handleSelectProject = useCallback(
    (project: Project) => {
      if (
        hasUnsavedChanges &&
        currentProject &&
        project.id !== currentProject.id
      ) {
        setPendingProject(project);
        setShowUnsavedChangesDialog(true);
      } else {
        loadProjectData(project);
      }
    },
    [loadProjectData, hasUnsavedChanges, currentProject]
  );

  const handleConfirmProjectSwitch = useCallback(() => {
    if (pendingProject) {
      loadProjectData(pendingProject);
      setPendingProject(null);
    }
  }, [pendingProject, loadProjectData]);

  const handleCancelProjectSwitch = useCallback(() => {
    setPendingProject(null);
    setShowUnsavedChangesDialog(false);
  }, []);

  const handleImport = useCallback(
    (importedMilestones: Milestone[]) => {
      const calculatedMilestones = calculateProjectDates(
        importedMilestones,
        projectStartDate
      );
      setMilestones(calculatedMilestones);

      // Reset expanded milestones when importing new data
      setExpandedMilestones(new Set());
      setHasUnsavedChanges(true);
    },
    [projectStartDate]
  );

  const handleStartDateChange = useCallback(
    (newDate: Date) => {
      setProjectStartDate(newDate);
      if (milestones.length > 0) {
        const recalculatedMilestones = calculateProjectDates(
          milestones,
          newDate
        );
        setMilestones(recalculatedMilestones);
      }
    },
    [milestones]
  );

  const handleUpdateTask = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      setMilestones(prevMilestones => {
        const updatedMilestones = prevMilestones.map(milestone => ({
          ...milestone,
          tasks: milestone.tasks.map(task =>
            task.taskId === taskId ? { ...task, ...updates } : task
          ),
        }));

        if (updates.startDate || updates.endDate) {
          return calculateProjectDates(
            updatedMilestones,
            projectStartDate,
            true
          );
        }

        if (updates.durationDays || updates.dependsOn !== undefined) {
          return calculateProjectDates(
            updatedMilestones,
            projectStartDate,
            false
          );
        }

        return updatedMilestones;
      });
    },
    [projectStartDate]
  );

  const handleRecalculateTimeline = useCallback(() => {
    setMilestones(prevMilestones => {
      return calculateProjectDates(prevMilestones, projectStartDate, false);
    });
  }, [projectStartDate]);

  const handleUpdateMilestones = useCallback(
    (updatedMilestones: Milestone[]) => {
      const recalculatedMilestones = calculateProjectDates(
        updatedMilestones,
        projectStartDate,
        false
      );
      setMilestones(recalculatedMilestones);
    },
    [projectStartDate]
  );

  const handleUpdateMilestoneOrder = useCallback((newOrder: string[]) => {
    setMilestoneOrder(newOrder);
  }, []);

  const totalTasks = milestones.reduce((acc, m) => acc + m.tasks.length, 0);
  const uniqueTeams = new Set(milestones.flatMap(m => m.tasks.map(t => t.team)))
    .size;
  const totalDuration = milestones.reduce(
    (acc, m) => acc + Math.max(...m.tasks.map(t => t.durationDays), 0),
    0
  );

  const expandAllMilestones = useCallback(() => {
    const allMilestoneIds = new Set(milestones.map(m => m.milestoneId));
    setExpandedMilestones(allMilestoneIds);
  }, [milestones]);

  const collapseAllMilestones = useCallback(() => {
    setExpandedMilestones(new Set());
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full pl-[1%] pr-4 py-6">
        <div className="space-y-6">
          {/* Header */}
          <div
            style={{
              position: 'absolute',
              left: '1%',
              top: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: 'auto',
              maxWidth: '300px',
              marginBottom: '24px',
              zIndex: 10,
            }}
          >
            <BarChart
              className="w-6 h-6 text-blue-600"
              style={{ minWidth: '24px', minHeight: '24px' }}
            />
            <div className="flex flex-col">
              <h1 className="text-lg font-semibold whitespace-nowrap">
                Timeline Milestones Chart
              </h1>
              {currentProject && (
                <span className="text-sm text-muted-foreground">
                  {currentProject.name}
                  {hasUnsavedChanges && (
                    <span className="ml-1 text-amber-600">•</span>
                  )}
                </span>
              )}
            </div>
          </div>

          <div className="h-5"></div>

          <div className="w-full ">
            <JsonImportExport
              milestones={milestones}
              onImport={handleImport}
              projectStartDate={projectStartDate}
              onStartDateChange={handleStartDateChange}
              currentProject={currentProject}
              onOpenProjectManager={() => setShowProjectManager(true)}
            />
          </div>

          {milestones.length > 0 && (
            <div className="w-full">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Milestones
                      </p>
                      <p className="text-xl font-medium">{milestones.length}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Tasks</p>
                      <p className="text-xl font-medium">{totalTasks}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Teams</p>
                      <p className="text-xl font-medium">{uniqueTeams}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Total Duration
                      </p>
                      <p className="text-xl font-medium">
                        {totalDuration} days
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {milestones.length > 0 && (
            <div className="w-full">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3>Project Teams</h3>
                </div>

                <div className="flex flex-wrap gap-2">
                  {Array.from(
                    new Set(milestones.flatMap(m => m.tasks.map(t => t.team)))
                  ).map(team => (
                    <Badge
                      key={team}
                      variant="outline"
                      className="flex items-center gap-2"
                      style={{
                        borderColor:
                          teamColors[team as keyof typeof teamColors] ||
                          teamColors.Default,
                        color:
                          teamColors[team as keyof typeof teamColors] ||
                          teamColors.Default,
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor:
                            teamColors[team as keyof typeof teamColors] ||
                            teamColors.Default,
                        }}
                      />
                      {team}
                    </Badge>
                  ))}
                </div>
              </Card>
            </div>
          )}

          <GanttTimeline
            milestones={milestones}
            onUpdateTask={handleUpdateTask}
            onUpdateMilestones={handleUpdateMilestones}
            onRecalculateTimeline={handleRecalculateTimeline}
            expandedMilestones={expandedMilestones}
            onToggleMilestone={(milestoneId: string) => {
              const newExpanded = new Set(expandedMilestones);
              if (newExpanded.has(milestoneId)) {
                newExpanded.delete(milestoneId);
              } else {
                newExpanded.add(milestoneId);
              }
              setExpandedMilestones(newExpanded);
            }}
            expandAllMilestones={expandAllMilestones}
            collapseAllMilestones={collapseAllMilestones}
            milestoneOrder={milestoneOrder}
            onUpdateMilestoneOrder={handleUpdateMilestoneOrder}
          />
        </div>

        <ProjectManager
          isOpen={showProjectManager}
          onClose={() => setShowProjectManager(false)}
          onSelectProject={handleSelectProject}
          currentProjectId={currentProject?.id}
        />

        <ConfirmationDialog
          isOpen={showUnsavedChangesDialog}
          onClose={handleCancelProjectSwitch}
          onConfirm={handleConfirmProjectSwitch}
          title="Unsaved Changes"
          description={`You have unsaved changes in "${currentProject?.name}". Are you sure you want to switch to "${pendingProject?.name}" and lose your changes?`}
          confirmLabel="Switch Project"
          cancelLabel="Stay Here"
          variant="destructive"
        />
      </div>
    </div>
  );
}
