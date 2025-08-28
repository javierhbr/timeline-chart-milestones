import { Project, TimelineData } from '../utils/projectStorage';
import { DataProvider, dataProviderManager } from './dataProviders';
import { logger } from '../utils/logger';

// Simple event emitter implementation for browser compatibility
class SimpleEventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, listener: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event: string, listener: Function) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
  }

  emit(event: string, data?: any) {
    if (this.events[event]) {
      this.events[event].forEach(listener => listener(data));
    }
  }

  removeAllListeners() {
    this.events = {};
  }
}

export interface SyncEvent {
  type: 'sync_started' | 'sync_completed' | 'sync_failed' | 'conflict_detected' | 'sync_status_changed';
  projectId?: string;
  error?: string;
  conflictData?: ConflictData;
  status?: SyncStatus;
}

export interface ConflictData {
  localProject: Project;
  remoteProject: Project;
  conflictFields: string[];
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';
export type ConflictResolutionStrategy = 'local_wins' | 'remote_wins' | 'merge' | 'manual';

export interface SyncOptions {
  autoSync: boolean;
  syncInterval: number; // in milliseconds
  conflictResolution: ConflictResolutionStrategy;
  retryAttempts: number;
}

export class SyncManager extends SimpleEventEmitter {
  private currentProjectId: string | null = null;
  private syncStatus: SyncStatus = 'idle';
  private syncTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingChanges: Map<string, TimelineData> = new Map();
  private lastSyncTimestamp: Map<string, number> = new Map();
  private isOnline = true;
  
  private options: SyncOptions = {
    autoSync: true,
    syncInterval: 5000, // 5 seconds
    conflictResolution: 'manual',
    retryAttempts: 3,
  };

  constructor() {
    super();
    this.setupOnlineStatusDetection();
  }

  private setupOnlineStatusDetection(): void {
    logger.debug('Setting up online status detection', { 
      module: 'Sync', 
      action: 'setupOnlineStatusDetection' 
    });

    // Listen to online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      logger.info('Connection restored', { 
        module: 'Sync', 
        action: 'onlineStatusChange',
        isOnline: true,
        pendingChanges: this.pendingChanges.size
      });
      
      this.setSyncStatus('idle');
      this.emit('sync_status_changed', { status: 'idle' });
      
      // Resume syncing if we have pending changes
      if (this.pendingChanges.size > 0 && this.options.autoSync) {
        logger.debug('Resuming sync after reconnection', { 
          module: 'Sync', 
          action: 'onlineStatusChange' 
        });
        this.startAutoSync();
      }
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      logger.warn('Connection lost', { 
        module: 'Sync', 
        action: 'onlineStatusChange',
        isOnline: false,
        pendingChanges: this.pendingChanges.size
      });
      
      this.setSyncStatus('offline');
      this.emit('sync_status_changed', { status: 'offline' });
      this.stopAutoSync();
    });
  }

  setOptions(options: Partial<SyncOptions>): void {
    logger.debug('Updating sync options', { 
      module: 'Sync', 
      action: 'setOptions',
      oldOptions: this.options,
      newOptions: options
    });
    
    this.options = { ...this.options, ...options };
    
    if (this.options.autoSync && this.currentProjectId && this.isOnline) {
      logger.debug('Starting auto-sync after options update', { 
        module: 'Sync', 
        action: 'setOptions' 
      });
      this.startAutoSync();
    } else {
      logger.debug('Stopping auto-sync after options update', { 
        module: 'Sync', 
        action: 'setOptions' 
      });
      this.stopAutoSync();
    }
  }

  getOptions(): SyncOptions {
    return { ...this.options };
  }

  getSyncStatus(): SyncStatus {
    return this.syncStatus;
  }

  private setSyncStatus(status: SyncStatus): void {
    if (this.syncStatus !== status) {
      this.syncStatus = status;
      this.emit('sync_status_changed', { status });
    }
  }

  setCurrentProject(projectId: string | null): void {
    if (this.currentProjectId === projectId) {
      return;
    }

    logger.info('Switching project', { 
      module: 'Sync', 
      action: 'setCurrentProject',
      previousProjectId: this.currentProjectId,
      newProjectId: projectId
    });

    // Save any pending changes for the previous project
    if (this.currentProjectId && this.pendingChanges.has(this.currentProjectId)) {
      logger.debug('Syncing pending changes for previous project', { 
        module: 'Sync', 
        action: 'setCurrentProject',
        projectId: this.currentProjectId
      });
      this.syncProject(this.currentProjectId).catch(error => {
        logger.error('Failed to sync pending changes', error, { 
          module: 'Sync', 
          action: 'setCurrentProject',
          projectId: this.currentProjectId
        });
      });
    }

    this.currentProjectId = projectId;
    
    if (projectId && this.options.autoSync && this.isOnline) {
      logger.debug('Starting auto-sync for new project', { 
        module: 'Sync', 
        action: 'setCurrentProject',
        projectId
      });
      this.startAutoSync();
    } else {
      logger.debug('Stopping auto-sync', { 
        module: 'Sync', 
        action: 'setCurrentProject',
        reason: !projectId ? 'no project' : !this.options.autoSync ? 'autoSync disabled' : 'offline'
      });
      this.stopAutoSync();
    }
  }

  getCurrentProject(): string | null {
    return this.currentProjectId;
  }

  // Called when UI makes changes to project data
  queueChange(projectId: string, timelineData: TimelineData): void {
    logger.debug('Queueing changes', { 
      module: 'Sync', 
      action: 'queueChange',
      projectId,
      milestonesCount: timelineData.milestones.length,
      isUsingGoogleSheets: dataProviderManager.isUsingGoogleSheets()
    });
    
    this.pendingChanges.set(projectId, timelineData);
    
    if (this.options.autoSync && this.isOnline && dataProviderManager.isUsingGoogleSheets()) {
      // Debounce rapid changes - clear existing debounce timer
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      
      // Start a new debounce timer for immediate sync
      this.debounceTimer = setTimeout(() => {
        logger.debug('Debounced sync triggered', { 
          module: 'Sync', 
          action: 'queueChange',
          projectId
        });
        
        if (this.currentProjectId && this.syncStatus !== 'syncing') {
          this.syncProject(this.currentProjectId).catch(error => {
            logger.error('Debounced sync failed', error, { 
              module: 'Sync', 
              action: 'queueChange',
              projectId: this.currentProjectId
            });
          });
        }
        this.debounceTimer = null;
      }, 1000); // 1 second debounce for rapid changes
    }
  }

  private startAutoSync(): void {
    this.stopAutoSync();
    
    if (!this.isOnline || !this.currentProjectId || !this.options.autoSync) {
      return;
    }

    this.syncTimer = setTimeout(async () => {
      if (this.currentProjectId && this.syncStatus !== 'syncing') {
        try {
          await this.syncProject(this.currentProjectId);
        } catch (error) {
          // Error is already logged in syncProject
        }
      }
      
      // Only continue periodic sync if we're still online, have a project, and using Google Sheets
      if (this.isOnline && this.currentProjectId && this.options.autoSync && dataProviderManager.isUsingGoogleSheets()) {
        this.startAutoSync();
      }
    }, this.options.syncInterval);
  }

  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  async syncProject(projectId: string): Promise<void> {
    if (!this.isOnline) {
      const error = 'Cannot sync while offline';
      logger.warn(error, { 
        module: 'Sync', 
        action: 'syncProject',
        projectId 
      });
      throw new Error(error);
    }

    if (this.syncStatus === 'syncing') {
      logger.debug('Sync already in progress', { 
        module: 'Sync', 
        action: 'syncProject',
        projectId 
      });
      return; // Already syncing
    }

    logger.logSyncEvent('sync_started', { projectId });
    this.setSyncStatus('syncing');
    this.emit('sync_started', { projectId });

    try {
      const localProvider = dataProviderManager.getLocalProvider();
      const currentProvider = dataProviderManager.getCurrentProvider();

      // If we're using localStorage only, no sync needed
      if (currentProvider === localProvider) {
        logger.debug('Using local storage only, no sync needed', { 
          module: 'Sync', 
          action: 'syncProject',
          projectId 
        });
        this.setSyncStatus('idle');
        this.emit('sync_completed', { projectId });
        return;
      }

      // Get pending changes
      const pendingData = this.pendingChanges.get(projectId);
      const hasPendingChanges = !!pendingData;
      
      // Skip sync if no pending changes and recent sync
      const lastSync = this.lastSyncTimestamp.get(projectId) || 0;
      const timeSinceLastSync = Date.now() - lastSync;
      const shouldCheckRemote = timeSinceLastSync > (this.options.syncInterval * 2); // Only check remote every 2 intervals
      
      if (!hasPendingChanges && !shouldCheckRemote) {
        logger.debug('No sync needed - no pending changes and recent sync', { 
          module: 'Sync', 
          action: 'syncProject',
          projectId,
          timeSinceLastSync,
          threshold: this.options.syncInterval * 2
        });
        this.setSyncStatus('idle');
        this.emit('sync_completed', { projectId });
        return;
      }
      
      if (pendingData) {
        logger.info('Pushing local changes to remote', { 
          module: 'Sync', 
          action: 'syncProject',
          projectId,
          milestonesCount: pendingData.milestones.length
        });
        // We have local changes to push
        await this.pushChanges(projectId, pendingData);
        this.pendingChanges.delete(projectId);
      }

      // Check for remote changes if needed
      if (shouldCheckRemote) {
        logger.debug('Checking for remote changes', { 
          module: 'Sync', 
          action: 'syncProject',
          projectId 
        });
        await this.pullChanges(projectId);
      }

      this.lastSyncTimestamp.set(projectId, Date.now());
      this.setSyncStatus('idle');
      logger.logSyncEvent('sync_completed', { projectId });
      this.emit('sync_completed', { projectId });

    } catch (error) {
      logger.error('Sync failed', error as Error, { 
        module: 'Sync', 
        action: 'syncProject',
        projectId 
      });
      this.setSyncStatus('error');
      this.emit('sync_failed', { projectId, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  private async pushChanges(projectId: string, timelineData: TimelineData): Promise<void> {
    const currentProvider = dataProviderManager.getCurrentProvider();
    
    // Load current project to check for conflicts
    const remoteProject = await currentProvider.loadProject(projectId);
    const localProvider = dataProviderManager.getLocalProvider();
    const localProject = await localProvider.loadProject(projectId);

    if (remoteProject && localProject) {
      // Check for conflicts
      const lastSync = this.lastSyncTimestamp.get(projectId) || 0;
      const hasRemoteChanges = remoteProject.lastModified > lastSync;
      const hasLocalChanges = localProject.lastModified > lastSync;

      if (hasRemoteChanges && hasLocalChanges) {
        // Conflict detected
        await this.handleConflict(projectId, localProject, remoteProject, timelineData);
        return;
      }
    }

    // No conflicts, push changes
    await currentProvider.saveProject(projectId, timelineData);
  }

  private async pullChanges(projectId: string): Promise<void> {
    const currentProvider = dataProviderManager.getCurrentProvider();
    const localProvider = dataProviderManager.getLocalProvider();
    
    const remoteProject = await currentProvider.loadProject(projectId);
    if (!remoteProject) {
      return; // No remote project
    }

    const lastSync = this.lastSyncTimestamp.get(projectId) || 0;
    if (remoteProject.lastModified <= lastSync) {
      return; // No remote changes
    }

    const localProject = await localProvider.loadProject(projectId);
    if (localProject && localProject.lastModified > lastSync) {
      // Both have changes - conflict
      await this.handleConflict(projectId, localProject, remoteProject, localProject.timelineData);
      return;
    }

    // No local changes, pull remote changes
    await localProvider.saveProject(projectId, remoteProject.timelineData);
  }

  private async handleConflict(
    projectId: string,
    localProject: Project,
    remoteProject: Project,
    pendingData: TimelineData
  ): Promise<void> {
    const conflictFields = this.detectConflictFields(localProject.timelineData, remoteProject.timelineData);
    const conflictData: ConflictData = {
      localProject,
      remoteProject,
      conflictFields,
    };

    logger.warn('Conflict detected during sync', { 
      module: 'Sync', 
      action: 'handleConflict',
      projectId,
      conflictFields,
      resolutionStrategy: this.options.conflictResolution
    });

    this.emit('conflict_detected', { projectId, conflictData });

    switch (this.options.conflictResolution) {
      case 'local_wins':
        logger.info('Resolving conflict: local wins', { 
          module: 'Sync', 
          action: 'handleConflict',
          projectId 
        });
        await this.resolveConflict(projectId, 'local', localProject.timelineData);
        break;
      
      case 'remote_wins':
        logger.info('Resolving conflict: remote wins', { 
          module: 'Sync', 
          action: 'handleConflict',
          projectId 
        });
        await this.resolveConflict(projectId, 'remote', remoteProject.timelineData);
        break;
      
      case 'merge':
        logger.info('Resolving conflict: merging changes', { 
          module: 'Sync', 
          action: 'handleConflict',
          projectId 
        });
        const mergedData = await this.mergeChanges(localProject.timelineData, remoteProject.timelineData);
        await this.resolveConflict(projectId, 'merged', mergedData);
        break;
      
      case 'manual':
        logger.warn('Manual conflict resolution required', { 
          module: 'Sync', 
          action: 'handleConflict',
          projectId 
        });
        // Manual resolution required - emit conflict event and wait for user decision
        throw new Error('Manual conflict resolution required');
    }
  }

  async resolveConflict(
    projectId: string,
    resolution: 'local' | 'remote' | 'merged',
    resolvedData: TimelineData
  ): Promise<void> {
    logger.info('Applying conflict resolution', { 
      module: 'Sync', 
      action: 'resolveConflict',
      projectId,
      resolution,
      milestonesCount: resolvedData.milestones.length
    });

    const currentProvider = dataProviderManager.getCurrentProvider();
    const localProvider = dataProviderManager.getLocalProvider();

    // Save resolved data to both local and remote
    await Promise.all([
      localProvider.saveProject(projectId, resolvedData),
      currentProvider.saveProject(projectId, resolvedData),
    ]);

    // Clear pending changes
    this.pendingChanges.delete(projectId);
    this.lastSyncTimestamp.set(projectId, Date.now());
    
    logger.logSyncEvent('conflict_resolved', { 
      projectId, 
      resolution 
    });
  }

  private detectConflictFields(localData: TimelineData, remoteData: TimelineData): string[] {
    const conflicts: string[] = [];

    // Check project start date
    if (localData.projectStartDate !== remoteData.projectStartDate) {
      conflicts.push('projectStartDate');
    }

    // Check milestones
    const localMilestoneIds = new Set(localData.milestones.map(m => m.milestoneId));
    const remoteMilestoneIds = new Set(remoteData.milestones.map(m => m.milestoneId));

    // Check for added/removed milestones
    if (localMilestoneIds.size !== remoteMilestoneIds.size) {
      conflicts.push('milestones');
    } else {
      // Check individual milestones for changes
      for (const localMilestone of localData.milestones) {
        const remoteMilestone = remoteData.milestones.find(m => m.milestoneId === localMilestone.milestoneId);
        if (!remoteMilestone) {
          conflicts.push('milestones');
          break;
        }

        // Check milestone properties
        if (
          localMilestone.milestoneName !== remoteMilestone.milestoneName ||
          localMilestone.startDate !== remoteMilestone.startDate ||
          localMilestone.endDate !== remoteMilestone.endDate ||
          localMilestone.tasks.length !== remoteMilestone.tasks.length
        ) {
          conflicts.push(`milestone.${localMilestone.milestoneId}`);
        }

        // Check tasks within milestone
        for (const localTask of localMilestone.tasks) {
          const remoteTask = remoteMilestone.tasks.find(t => t.taskId === localTask.taskId);
          if (!remoteTask) {
            conflicts.push(`milestone.${localMilestone.milestoneId}.tasks`);
            break;
          }

          // Check task properties
          if (
            localTask.name !== remoteTask.name ||
            localTask.description !== remoteTask.description ||
            localTask.team !== remoteTask.team ||
            localTask.durationDays !== remoteTask.durationDays ||
            JSON.stringify(localTask.dependsOn) !== JSON.stringify(remoteTask.dependsOn)
          ) {
            conflicts.push(`task.${localTask.taskId}`);
          }
        }
      }
    }

    // Check milestone order
    if (JSON.stringify(localData.milestoneOrder) !== JSON.stringify(remoteData.milestoneOrder)) {
      conflicts.push('milestoneOrder');
    }

    return Array.from(new Set(conflicts));
  }

  private async mergeChanges(localData: TimelineData, remoteData: TimelineData): Promise<TimelineData> {
    // Simple merge strategy: take the most recent timestamp for each field
    // This is a basic implementation - more sophisticated merging could be added
    
    const merged: TimelineData = {
      projectStartDate: localData.projectStartDate, // Favor local for project start date
      milestones: [],
      expandedMilestones: Array.from(new Set([...localData.expandedMilestones, ...remoteData.expandedMilestones])),
      milestoneOrder: localData.milestoneOrder || remoteData.milestoneOrder,
    };

    // Merge milestones
    const allMilestoneIds = new Set([
      ...localData.milestones.map(m => m.milestoneId),
      ...remoteData.milestones.map(m => m.milestoneId),
    ]);

    for (const milestoneId of allMilestoneIds) {
      const localMilestone = localData.milestones.find(m => m.milestoneId === milestoneId);
      const remoteMilestone = remoteData.milestones.find(m => m.milestoneId === milestoneId);

      if (localMilestone && remoteMilestone) {
        // Both exist, merge them
        const mergedMilestone = { ...localMilestone };
        
        // Merge tasks
        const allTaskIds = new Set([
          ...localMilestone.tasks.map(t => t.taskId),
          ...remoteMilestone.tasks.map(t => t.taskId),
        ]);

        mergedMilestone.tasks = [];
        for (const taskId of allTaskIds) {
          const localTask = localMilestone.tasks.find(t => t.taskId === taskId);
          const remoteTask = remoteMilestone.tasks.find(t => t.taskId === taskId);

          if (localTask && remoteTask) {
            // Both exist, take local version (could be made more sophisticated)
            mergedMilestone.tasks.push(localTask);
          } else {
            // Only one exists, take that one
            mergedMilestone.tasks.push((localTask || remoteTask)!);
          }
        }

        merged.milestones.push(mergedMilestone);
      } else {
        // Only one exists, take that one
        merged.milestones.push((localMilestone || remoteMilestone)!);
      }
    }

    return merged;
  }

  // Utility methods for external use
  hasPendingChanges(projectId?: string): boolean {
    if (projectId) {
      return this.pendingChanges.has(projectId);
    }
    return this.pendingChanges.size > 0;
  }

  async forcePush(projectId: string): Promise<void> {
    const currentProvider = dataProviderManager.getCurrentProvider();
    const localProvider = dataProviderManager.getLocalProvider();
    
    const localProject = await localProvider.loadProject(projectId);
    if (!localProject) {
      throw new Error('Local project not found');
    }

    await currentProvider.saveProject(projectId, localProject.timelineData);
    this.pendingChanges.delete(projectId);
    this.lastSyncTimestamp.set(projectId, Date.now());
  }

  async forcePull(projectId: string): Promise<void> {
    const currentProvider = dataProviderManager.getCurrentProvider();
    const localProvider = dataProviderManager.getLocalProvider();
    
    const remoteProject = await currentProvider.loadProject(projectId);
    if (!remoteProject) {
      throw new Error('Remote project not found');
    }

    await localProvider.saveProject(projectId, remoteProject.timelineData);
    this.pendingChanges.delete(projectId);
    this.lastSyncTimestamp.set(projectId, Date.now());
  }

  destroy(): void {
    this.stopAutoSync();
    this.removeAllListeners();
  }
}

// Singleton instance
export const syncManager = new SyncManager();