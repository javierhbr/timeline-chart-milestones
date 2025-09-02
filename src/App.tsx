import React, {
  useState,
  useCallback,
  useEffect,
  Suspense,
  lazy,
  useRef,
  useMemo,
} from 'react';
import { GanttTimeline } from './components/GanttTimeline';
import { ChangeHistoryPanel } from './components/ChangeHistoryPanel';
import { Card } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { LoginDialog } from './components/LoginDialog';
import { useAuth } from './contexts/AuthContext';
import {
  Milestone,
  Task,
  calculateProjectDates,
  teamColors,
} from './utils/dateUtils';
import {
  ChangeHistoryEntry,
  rollbackToChange,
  detectTaskChanges,
  detectMilestoneChanges,
  logTaskAddition,
  logTaskRemoval,
  logMilestoneAddition,
  logMilestoneRemoval,
  logTaskMove,
} from './utils/changeHistory';
import { updateTaskWithTracking } from './utils/taskOperations';
import {
  Project,
  TimelineData,
  getCurrentProject,
  saveProject,
  createProject,
  runAllMigrations,
  hasAnyProjects,
  generateDefaultProjectName,
} from './utils/projectStorage';
import {
  BarChart3,
  Calendar,
  Users,
  Clock,
  BarChart,
  LogOut,
  User,
  History,
} from 'lucide-react';

// Lazy load heavy components
const JsonImportExport = lazy(() =>
  import('./components/JsonImportExport').then(module => ({
    default: module.JsonImportExport,
  }))
);
const ProjectManager = lazy(() =>
  import('./components/ProjectManager').then(module => ({
    default: module.ProjectManager,
  }))
);
const ConfirmationDialog = lazy(() =>
  import('./components/ConfirmationDialog').then(module => ({
    default: module.ConfirmationDialog,
  }))
);

export default function App() {
  const { isAuthenticated, login, logout, loginError } = useAuth();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [changeHistory, setChangeHistory] = useState<ChangeHistoryEntry[]>([]);
  const [projectStartDate, setProjectStartDate] = useState<Date>(
    new Date('2024-08-26')
  );
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(
    new Set()
  );
  const [milestoneOrder, setMilestoneOrder] = useState<string[]>([]);
  const [taskOrders, setTaskOrders] = useState<Map<string, string[]>>(
    new Map()
  );
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingProject, setPendingProject] = useState<Project | null>(null);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] =
    useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  const handleLogin = useCallback(
    (username: string, password: string) => {
      const success = login(username, password);
      if (success) {
        setShowLoginDialog(false);
      }
    },
    [login]
  );

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  const handleOpenLogin = useCallback(() => {
    setShowLoginDialog(true);
  }, []);

  const handleCloseLogin = useCallback(() => {
    setShowLoginDialog(false);
  }, []);

  // Initialize app and load current project on component mount
  useEffect(() => {
    const initializeApp = () => {
      console.log('App: Starting app initialization');
      console.log('App: isAuthenticated =', isAuthenticated);
      console.log('App: localStorage keys =', Object.keys(localStorage));

      // Only load projects if authenticated
      if (isAuthenticated) {
        console.log('App: User is authenticated, loading projects');
        // Run all necessary migrations
        runAllMigrations();

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
          setChangeHistory(project.timelineData.changeHistory || []);
          setProjectStartDate(projectStartDate);
          setExpandedMilestones(
            new Set(project.timelineData.expandedMilestones)
          );
          setMilestoneOrder(project.timelineData.milestoneOrder || []);
          setTaskOrders(
            new Map(Object.entries(project.timelineData.taskOrders || {}))
          );
          setHasUnsavedChanges(false);
        } else if (!hasAnyProjects()) {
          // Create default project for new users
          const emptyTimelineData: TimelineData = {
            milestones: [],
            projectStartDate: new Date().toISOString(),
            expandedMilestones: [],
            milestoneOrder: [],
            taskOrders: {},
            changeHistory: [],
          };
          const newProject = createProject(
            generateDefaultProjectName(),
            emptyTimelineData,
            true
          );
          setCurrentProject(newProject);
          setMilestones(newProject.timelineData.milestones);
          setChangeHistory(newProject.timelineData.changeHistory || []);
          setProjectStartDate(
            new Date(newProject.timelineData.projectStartDate)
          );
          setExpandedMilestones(
            new Set(newProject.timelineData.expandedMilestones)
          );
          setMilestoneOrder(newProject.timelineData.milestoneOrder || []);
          setTaskOrders(
            new Map(Object.entries(newProject.timelineData.taskOrders || {}))
          );
          setHasUnsavedChanges(false);
        } else {
          // Has projects but none selected - show project manager
          setShowProjectManager(true);
        }
      } else {
        console.log('App: User not authenticated, setting empty state');
        console.log(
          'App: Current localStorage keys before clearing view:',
          Object.keys(localStorage)
        );

        // Set empty state for unauthenticated users
        setMilestones([]);
        setChangeHistory([]);
        setProjectStartDate(new Date());
        setExpandedMilestones(new Set());
        setMilestoneOrder([]);
        setTaskOrders(new Map());
        setCurrentProject(null);

        console.log('App: Set empty state - milestones length:', 0);
        console.log('App: Empty state set successfully');
      }
    };

    initializeApp();
  }, [isAuthenticated]);

  // Debounced auto-save current project whenever timeline data changes
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  useEffect(() => {
    if (currentProject && milestones.length > 0) {
      // Clear previous timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout for debounced save
      saveTimeoutRef.current = setTimeout(() => {
        const timelineData: TimelineData = {
          milestones,
          projectStartDate: projectStartDate.toISOString(),
          expandedMilestones: Array.from(expandedMilestones),
          milestoneOrder,
          taskOrders: Object.fromEntries(taskOrders),
          changeHistory,
        };
        saveProject(currentProject.id, timelineData);
        setHasUnsavedChanges(false);
      }, 1000); // Debounce for 1 second
    }

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    milestones,
    projectStartDate,
    expandedMilestones,
    milestoneOrder,
    taskOrders,
    currentProject,
    changeHistory,
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
    taskOrders,
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
    setChangeHistory(project.timelineData.changeHistory || []);
    setProjectStartDate(projectStartDate);
    setExpandedMilestones(new Set(project.timelineData.expandedMilestones));
    setMilestoneOrder(project.timelineData.milestoneOrder || []);
    setTaskOrders(
      new Map(Object.entries(project.timelineData.taskOrders || {}))
    );
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
      console.log('🔵 handleUpdateTask called:', { taskId, updates });
      console.log('🔵 Current milestones length:', milestones.length);
      console.log('🔵 Current change history length:', changeHistory.length);

      setMilestones(prevMilestones => {
        console.log(
          '🔵 Inside setMilestones, prevMilestones length:',
          prevMilestones.length
        );

        // Use change tracking for the task update
        const result = updateTaskWithTracking(prevMilestones, taskId, updates);
        console.log('🔵 updateTaskWithTracking result:', {
          milestonesLength: result.milestones.length,
          changesLength: result.changes.length,
        });
        console.log(
          '🔵 Changes detected:',
          result.changes.map(c => c.changeType)
        );

        // Update change history
        setChangeHistory(prevHistory => {
          console.log(
            '🔵 Updating change history, previous length:',
            prevHistory.length
          );
          const newHistory = [...prevHistory, ...result.changes];
          console.log('🔵 New history length:', newHistory.length);
          return newHistory;
        });

        let finalMilestones = result.milestones;

        if (updates.startDate || updates.endDate) {
          console.log('🔵 Recalculating dates (preserve manual dates)');
          finalMilestones = calculateProjectDates(
            finalMilestones,
            projectStartDate,
            true
          );
        }

        if (updates.durationDays || updates.dependsOn !== undefined) {
          console.log('🔵 Recalculating dates (normal calculation)');
          finalMilestones = calculateProjectDates(
            finalMilestones,
            projectStartDate,
            false
          );
        }

        console.log('🔵 Final milestones length:', finalMilestones.length);
        return finalMilestones;
      });

      console.log('🔵 Setting hasUnsavedChanges to true');
      setHasUnsavedChanges(true);
    },
    [projectStartDate, milestones.length, changeHistory.length]
  );

  const handleRecalculateTimeline = useCallback(() => {
    setMilestones(prevMilestones => {
      return calculateProjectDates(prevMilestones, projectStartDate, false);
    });
  }, [projectStartDate]);

  // Function to detect changes between old and new milestone arrays
  const detectMilestoneArrayChanges = useCallback(
    (
      oldMilestones: Milestone[],
      newMilestones: Milestone[]
    ): ChangeHistoryEntry[] => {
      console.log('🔍 detectMilestoneArrayChanges called');
      console.log('🔍 Old milestones:', oldMilestones.length);
      console.log('🔍 New milestones:', newMilestones.length);

      const changes: ChangeHistoryEntry[] = [];

      // Create maps for easy lookup
      const oldMilestoneMap = new Map(
        oldMilestones.map(m => [m.milestoneId, m])
      );
      const newMilestoneMap = new Map(
        newMilestones.map(m => [m.milestoneId, m])
      );

      console.log('🔍 Old milestone IDs:', Array.from(oldMilestoneMap.keys()));
      console.log('🔍 New milestone IDs:', Array.from(newMilestoneMap.keys()));

      const oldTaskMap = new Map();
      const newTaskMap = new Map();

      // Build task maps with milestone context
      oldMilestones.forEach(milestone => {
        milestone.tasks.forEach(task => {
          oldTaskMap.set(task.taskId, { task, milestone });
        });
      });

      newMilestones.forEach(milestone => {
        milestone.tasks.forEach(task => {
          newTaskMap.set(task.taskId, { task, milestone });
        });
      });

      // Detect milestone changes
      for (const [milestoneId, newMilestone] of newMilestoneMap) {
        const oldMilestone = oldMilestoneMap.get(milestoneId);
        if (!oldMilestone) {
          // New milestone added
          changes.push(logMilestoneAddition(newMilestone));
        } else {
          // Check for milestone modifications
          const milestoneChanges = detectMilestoneChanges(
            oldMilestone,
            newMilestone
          );
          changes.push(...milestoneChanges);
        }
      }

      // Detect removed milestones
      for (const [milestoneId, oldMilestone] of oldMilestoneMap) {
        if (!newMilestoneMap.has(milestoneId)) {
          changes.push(logMilestoneRemoval(oldMilestone));
        }
      }

      // Detect task changes
      for (const [taskId, newTaskInfo] of newTaskMap) {
        const oldTaskInfo = oldTaskMap.get(taskId);
        if (!oldTaskInfo) {
          // New task added
          changes.push(
            logTaskAddition(
              newTaskInfo.task,
              newTaskInfo.milestone.milestoneId,
              newTaskInfo.milestone.milestoneName
            )
          );
        } else {
          // Check for task modifications
          const taskChanges = detectTaskChanges(
            oldTaskInfo.task,
            newTaskInfo.task,
            newTaskInfo.milestone.milestoneId
          );
          changes.push(...taskChanges);

          // Check for task moves between milestones
          if (
            oldTaskInfo.milestone.milestoneId !==
            newTaskInfo.milestone.milestoneId
          ) {
            changes.push(
              logTaskMove(
                newTaskInfo.task,
                oldTaskInfo.milestone.milestoneId,
                oldTaskInfo.milestone.milestoneName,
                newTaskInfo.milestone.milestoneId,
                newTaskInfo.milestone.milestoneName
              )
            );
          }
        }
      }

      // Detect removed tasks
      for (const [taskId, oldTaskInfo] of oldTaskMap) {
        if (!newTaskMap.has(taskId)) {
          changes.push(
            logTaskRemoval(
              oldTaskInfo.task,
              oldTaskInfo.milestone.milestoneId,
              oldTaskInfo.milestone.milestoneName
            )
          );
        }
      }

      console.log('🔍 Final detected changes count:', changes.length);
      console.log(
        '🔍 Change summaries:',
        changes.map(c => `${c.entityType}-${c.changeType}`)
      );

      return changes;
    },
    []
  );

  const handleUpdateMilestones = useCallback(
    (updatedMilestones: Milestone[]) => {
      console.log('🟡 handleUpdateMilestones called');
      console.log('🟡 Current milestones length:', milestones.length);
      console.log('🟡 Updated milestones length:', updatedMilestones.length);
      console.log('🟡 Current change history length:', changeHistory.length);

      // Detect changes before recalculating dates
      const changes = detectMilestoneArrayChanges(
        milestones,
        updatedMilestones
      );
      console.log('🟡 Detected changes:', changes.length);
      console.log(
        '🟡 Change types:',
        changes.map(c => c.changeType)
      );

      // Add changes to history if any were detected
      if (changes.length > 0) {
        console.log('🟡 Adding changes to history');
        setChangeHistory(prevHistory => {
          const newHistory = [...prevHistory, ...changes];
          console.log('🟡 New history length:', newHistory.length);
          return newHistory;
        });
      }

      console.log('🟡 Recalculating project dates');
      const recalculatedMilestones = calculateProjectDates(
        updatedMilestones,
        projectStartDate,
        false
      );
      console.log(
        '🟡 Recalculated milestones length:',
        recalculatedMilestones.length
      );

      console.log('🟡 Setting milestones and hasUnsavedChanges');
      setMilestones(recalculatedMilestones);
      setHasUnsavedChanges(true);
    },
    [
      projectStartDate,
      milestones,
      detectMilestoneArrayChanges,
      changeHistory.length,
    ]
  );

  // Rollback function
  const handleRollback = useCallback(
    (targetChangeIndex: number) => {
      const result = rollbackToChange(
        milestones,
        changeHistory,
        targetChangeIndex
      );

      setMilestones(result.newMilestones);
      setChangeHistory(result.newHistory);

      // Recalculate dates after rollback
      const recalculatedMilestones = calculateProjectDates(
        result.newMilestones,
        projectStartDate,
        false
      );
      setMilestones(recalculatedMilestones);

      setHasUnsavedChanges(true);
    },
    [milestones, changeHistory, projectStartDate]
  );

  const handleUpdateMilestoneOrder = useCallback((newOrder: string[]) => {
    setMilestoneOrder(newOrder);
  }, []);

  const handleUpdateTaskOrders = useCallback(
    (milestoneId: string, newTaskOrder: string[]) => {
      setTaskOrders(prev => new Map(prev.set(milestoneId, newTaskOrder)));
    },
    []
  );

  // Memoize expensive project statistics calculations
  const projectStats = useMemo(() => {
    const totalTasks = milestones.reduce((acc, m) => acc + m.tasks.length, 0);
    const uniqueTeams = new Set(
      milestones.flatMap(m => m.tasks.map(t => t.team))
    ).size;
    const totalDuration = milestones.reduce(
      (acc, m) => acc + Math.max(...m.tasks.map(t => t.durationDays), 0),
      0
    );

    return { totalTasks, uniqueTeams, totalDuration };
  }, [milestones]);

  const { totalTasks, uniqueTeams, totalDuration } = projectStats;

  // Memoize team list for badges
  const teamList = useMemo(() => {
    return Array.from(
      new Set(milestones.flatMap(m => m.tasks.map(t => t.team)))
    );
  }, [milestones]);

  const expandAllMilestones = useCallback(() => {
    const allMilestoneIds = new Set(milestones.map(m => m.milestoneId));
    setExpandedMilestones(allMilestoneIds);
  }, [milestones]);

  const collapseAllMilestones = useCallback(() => {
    setExpandedMilestones(new Set());
  }, []);

  const handleToggleMilestone = useCallback(
    (milestoneId: string) => {
      const newExpanded = new Set(expandedMilestones);
      if (newExpanded.has(milestoneId)) {
        newExpanded.delete(milestoneId);
      } else {
        newExpanded.add(milestoneId);
      }
      setExpandedMilestones(newExpanded);
    },
    [expandedMilestones]
  );

  const handleOpenProjectManager = useCallback(
    () => setShowProjectManager(true),
    []
  );

  return (
    <div
      className="min-h-screen bg-background"
      style={{ paddingLeft: '10px', paddingRight: '10px' }}
    >
      <div className="w-full py-6">
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
              {isAuthenticated && currentProject && (
                <span className="text-sm text-muted-foreground">
                  {currentProject.name}
                  {hasUnsavedChanges && (
                    <span className="ml-1 text-amber-600">•</span>
                  )}
                </span>
              )}
              {!isAuthenticated && (
                <span className="text-sm text-muted-foreground">
                  Public Demo - Login for full features
                </span>
              )}
            </div>
          </div>

          {/* Login/Logout Button */}
          <div
            style={{
              position: 'absolute',
              right: '20px',
              top: '20px',
              zIndex: 10,
            }}
          >
            {isAuthenticated ? (
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            ) : (
              <Button
                onClick={handleOpenLogin}
                variant="default"
                size="sm"
                className="flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                Login
              </Button>
            )}
          </div>

          <div className="h-5"></div>

          <div className="w-full ">
            <Suspense fallback={<div className="p-4">Loading...</div>}>
              <JsonImportExport
                milestones={milestones}
                onImport={handleImport}
                projectStartDate={projectStartDate}
                onStartDateChange={handleStartDateChange}
                currentProject={currentProject}
                onOpenProjectManager={handleOpenProjectManager}
              />
            </Suspense>
          </div>

          {/* History Button */}
          {isAuthenticated &&
            milestones.length > 0 &&
            changeHistory.length > 0 && (
              <div className="w-full mb-4">
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setShowHistoryPanel(true)}
                    className="flex items-center gap-2"
                  >
                    <History className="h-4 w-4" />
                    View Change History ({changeHistory.length} changes)
                  </Button>
                </div>
              </div>
            )}

          {milestones.length === 0 && (
            <div className="w-full">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-medium text-blue-800">
                    Get Started
                  </h3>
                </div>
                <p className="text-sm text-blue-700">
                  Welcome to the Timeline Milestones Chart! Click "Load Example"
                  to see a demo project, or use Import/Projects to create your
                  own timeline.
                </p>
              </div>
            </div>
          )}

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
                  {teamList.map(team => (
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

          {milestones.length > 0 &&
            (() => {
              console.log(
                '🔐 Rendering GanttTimeline, isAuthenticated:',
                isAuthenticated
              );
              console.log('🔐 Milestones count:', milestones.length);
              console.log('🔐 Change history count:', changeHistory.length);
              return (
                <GanttTimeline
                  milestones={milestones}
                  onUpdateTask={
                    isAuthenticated
                      ? handleUpdateTask
                      : () => {
                          console.log(
                            '❌ onUpdateTask called but user not authenticated!'
                          );
                        }
                  }
                  onUpdateMilestones={
                    isAuthenticated
                      ? handleUpdateMilestones
                      : () => {
                          console.log(
                            '❌ onUpdateMilestones called but user not authenticated!'
                          );
                        }
                  }
                  onRecalculateTimeline={
                    isAuthenticated
                      ? handleRecalculateTimeline
                      : () => {
                          console.log(
                            '❌ onRecalculateTimeline called but user not authenticated!'
                          );
                        }
                  }
                  expandedMilestones={expandedMilestones}
                  onToggleMilestone={handleToggleMilestone}
                  expandAllMilestones={expandAllMilestones}
                  collapseAllMilestones={collapseAllMilestones}
                  milestoneOrder={milestoneOrder}
                  onUpdateMilestoneOrder={
                    isAuthenticated ? handleUpdateMilestoneOrder : () => {}
                  }
                  taskOrders={taskOrders}
                  onUpdateTaskOrders={
                    isAuthenticated ? handleUpdateTaskOrders : () => {}
                  }
                />
              );
            })()}
        </div>

        <Suspense fallback={<div />}>
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

          <LoginDialog
            isOpen={showLoginDialog}
            onClose={handleCloseLogin}
            onLogin={handleLogin}
            error={loginError || undefined}
          />

          <ChangeHistoryPanel
            changeHistory={changeHistory}
            onRollback={handleRollback}
            isOpen={showHistoryPanel}
            onClose={() => setShowHistoryPanel(false)}
          />
        </Suspense>
      </div>
    </div>
  );
}
