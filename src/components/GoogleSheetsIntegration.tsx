import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../contexts/AuthContext';
import { dataProviderManager } from '../services/dataProviders';
import { syncManager, SyncStatus, ConflictData } from '../services/syncManager';
import { logger } from '../utils/logger';
import { 
  Cloud, 
  CloudOff, 
  RotateCw as Sync, 
  Settings, 
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Upload,
  Download,
  RefreshCw
} from 'lucide-react';
import { Project } from '../utils/projectStorage';

interface GoogleSheetsIntegrationProps {
  currentProject: Project | null;
  onProjectChange?: (project: Project) => void;
}

export function GoogleSheetsIntegration({ currentProject, onProjectChange }: GoogleSheetsIntegrationProps) {
  const { isAuthenticated, isGoogleConnected, connectGoogle, disconnectGoogle, googleError } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [showSettings, setShowSettings] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictData, setConflictData] = useState<ConflictData | null>(null);
  const [availableSpreadsheets, setAvailableSpreadsheets] = useState<any[]>([]);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<string>('');
  const [newSpreadsheetName, setNewSpreadsheetName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Sync options state
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState(5);
  const [conflictResolution, setConflictResolution] = useState<'manual' | 'local_wins' | 'remote_wins'>('manual');

  useEffect(() => {
    // Subscribe to sync events
    const handleSyncEvent = (event: any) => {
      switch (event.type) {
        case 'sync_status_changed':
          setSyncStatus(event.status);
          break;
        case 'conflict_detected':
          setConflictData(event.conflictData);
          setShowConflictDialog(true);
          break;
      }
    };

    syncManager.on('sync_status_changed', handleSyncEvent);
    syncManager.on('conflict_detected', handleSyncEvent);

    // Set initial sync status
    setSyncStatus(syncManager.getSyncStatus());

    // Set initial sync options
    const options = syncManager.getOptions();
    setAutoSync(options.autoSync);
    setSyncInterval(options.syncInterval / 1000); // Convert to seconds
    setConflictResolution(options.conflictResolution as any);

    return () => {
      syncManager.off('sync_status_changed', handleSyncEvent);
      syncManager.off('conflict_detected', handleSyncEvent);
    };
  }, []);

  useEffect(() => {
    if (isGoogleConnected) {
      loadAvailableSpreadsheets();
    }
  }, [isGoogleConnected]);

  const loadAvailableSpreadsheets = async () => {
    if (!isGoogleConnected) return;
    
    logger.debug('Loading available spreadsheets', { 
      module: 'UI', 
      action: 'loadAvailableSpreadsheets' 
    });
    
    try {
      setIsLoading(true);
      const sheetsProvider = dataProviderManager.getSheetsProvider();
      // This would need to be added to the GoogleSheetsProvider
      // const spreadsheets = await sheetsProvider.listSpreadsheets();
      // setAvailableSpreadsheets(spreadsheets);
      
      logger.debug('Spreadsheets loaded successfully', { 
        module: 'UI', 
        action: 'loadAvailableSpreadsheets'
      });
    } catch (error) {
      logger.error('Failed to load spreadsheets', error as Error, { 
        module: 'UI', 
        action: 'loadAvailableSpreadsheets' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    logger.info('User initiated Google connection', { 
      module: 'UI', 
      action: 'handleConnect' 
    });
    
    try {
      setIsLoading(true);
      await connectGoogle();
      logger.info('Google connection successful', { 
        module: 'UI', 
        action: 'handleConnect' 
      });
    } catch (error) {
      logger.error('Failed to connect to Google', error as Error, { 
        module: 'UI', 
        action: 'handleConnect' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    logger.info('User disconnected from Google Sheets', { 
      module: 'UI', 
      action: 'handleDisconnect' 
    });
    
    disconnectGoogle();
    dataProviderManager.switchToLocalStorage();
  };

  const handleSwitchToSheets = async () => {
    logger.info('Switching to Google Sheets provider', { 
      module: 'UI', 
      action: 'handleSwitchToSheets',
      isGoogleConnected,
      currentProjectId: currentProject?.id
    });
    
    if (!isGoogleConnected) {
      await handleConnect();
      return;
    }
    
    dataProviderManager.switchToGoogleSheets();
    syncManager.setCurrentProject(currentProject?.id || null);
  };

  const handleSwitchToLocal = () => {
    logger.info('Switching to local storage provider', { 
      module: 'UI', 
      action: 'handleSwitchToLocal' 
    });
    
    dataProviderManager.switchToLocalStorage();
  };

  const handleCreateNewSpreadsheet = async () => {
    if (!newSpreadsheetName.trim()) return;
    
    try {
      setIsLoading(true);
      const sheetsProvider = dataProviderManager.getSheetsProvider();
      
      if (currentProject) {
        // Create new spreadsheet with current project data
        const newProject = await sheetsProvider.createProject(newSpreadsheetName, currentProject.timelineData);
        onProjectChange?.(newProject);
        setNewSpreadsheetName('');
        await loadAvailableSpreadsheets();
      }
    } catch (error) {
      console.error('Failed to create spreadsheet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectToSpreadsheet = async () => {
    if (!selectedSpreadsheetId) return;
    
    try {
      setIsLoading(true);
      const sheetsProvider = dataProviderManager.getSheetsProvider();
      const project = await sheetsProvider.connectToSpreadsheet(selectedSpreadsheetId);
      onProjectChange?.(project);
      setSelectedSpreadsheetId('');
    } catch (error) {
      console.error('Failed to connect to spreadsheet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSync = async () => {
    if (!currentProject) return;
    
    logger.info('Manual sync triggered', { 
      module: 'UI', 
      action: 'handleManualSync',
      projectId: currentProject.id
    });
    
    try {
      await syncManager.syncProject(currentProject.id);
      logger.info('Manual sync completed', { 
        module: 'UI', 
        action: 'handleManualSync',
        projectId: currentProject.id
      });
    } catch (error) {
      logger.error('Manual sync failed', error as Error, { 
        module: 'UI', 
        action: 'handleManualSync',
        projectId: currentProject.id
      });
    }
  };

  const handleForcePush = async () => {
    if (!currentProject) return;
    
    logger.info('Force push triggered', { 
      module: 'UI', 
      action: 'handleForcePush',
      projectId: currentProject.id
    });
    
    try {
      await syncManager.forcePush(currentProject.id);
      logger.info('Force push completed', { 
        module: 'UI', 
        action: 'handleForcePush',
        projectId: currentProject.id
      });
    } catch (error) {
      logger.error('Force push failed', error as Error, { 
        module: 'UI', 
        action: 'handleForcePush',
        projectId: currentProject.id
      });
    }
  };

  const handleForcePull = async () => {
    if (!currentProject) return;
    
    logger.info('Force pull triggered', { 
      module: 'UI', 
      action: 'handleForcePull',
      projectId: currentProject.id
    });
    
    try {
      await syncManager.forcePull(currentProject.id);
      // Reload the project data in the UI
      const provider = dataProviderManager.getCurrentProvider();
      const updatedProject = await provider.loadProject(currentProject.id);
      if (updatedProject) {
        onProjectChange?.(updatedProject);
        logger.debug('UI updated after force pull', { 
          module: 'UI', 
          action: 'handleForcePull',
          projectId: currentProject.id
        });
      }
      
      logger.info('Force pull completed', { 
        module: 'UI', 
        action: 'handleForcePull',
        projectId: currentProject.id
      });
    } catch (error) {
      logger.error('Force pull failed', error as Error, { 
        module: 'UI', 
        action: 'handleForcePull',
        projectId: currentProject.id
      });
    }
  };

  const handleResolveConflict = async (resolution: 'local' | 'remote') => {
    if (!conflictData || !currentProject) return;
    
    logger.info('Resolving conflict', { 
      module: 'UI', 
      action: 'handleResolveConflict',
      projectId: currentProject.id,
      resolution,
      conflictFields: conflictData.conflictFields
    });
    
    try {
      const resolvedData = resolution === 'local' 
        ? conflictData.localProject.timelineData 
        : conflictData.remoteProject.timelineData;
      
      await syncManager.resolveConflict(currentProject.id, resolution, resolvedData);
      
      // Update UI with resolved data
      const provider = dataProviderManager.getCurrentProvider();
      const updatedProject = await provider.loadProject(currentProject.id);
      if (updatedProject) {
        onProjectChange?.(updatedProject);
      }
      
      setShowConflictDialog(false);
      setConflictData(null);
      
      logger.info('Conflict resolved successfully', { 
        module: 'UI', 
        action: 'handleResolveConflict',
        projectId: currentProject.id,
        resolution
      });
    } catch (error) {
      logger.error('Failed to resolve conflict', error as Error, { 
        module: 'UI', 
        action: 'handleResolveConflict',
        projectId: currentProject.id,
        resolution
      });
    }
  };

  const handleUpdateSyncOptions = () => {
    logger.info('Updating sync options', { 
      module: 'UI', 
      action: 'handleUpdateSyncOptions',
      autoSync,
      syncInterval,
      conflictResolution
    });
    
    syncManager.setOptions({
      autoSync,
      syncInterval: syncInterval * 1000, // Convert to milliseconds
      conflictResolution,
      retryAttempts: 3,
    });
    setShowSettings(false);
  };

  const getSyncStatusInfo = () => {
    switch (syncStatus) {
      case 'idle':
        return { icon: CheckCircle, color: 'text-green-500', text: 'Synced' };
      case 'syncing':
        return { icon: Loader2, color: 'text-blue-500', text: 'Syncing...', spin: true };
      case 'error':
        return { icon: AlertTriangle, color: 'text-red-500', text: 'Sync Error' };
      case 'offline':
        return { icon: CloudOff, color: 'text-gray-500', text: 'Offline' };
      default:
        return { icon: Cloud, color: 'text-gray-400', text: 'Unknown' };
    }
  };

  const statusInfo = getSyncStatusInfo();
  const StatusIcon = statusInfo.icon;
  const isUsingSheets = dataProviderManager.isUsingGoogleSheets();
  const hasPendingChanges = currentProject ? syncManager.hasPendingChanges(currentProject.id) : false;

  if (!isAuthenticated) {
    return null; // Only show for authenticated users
  }

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isGoogleConnected ? (
              <Cloud className="w-5 h-5 text-blue-500" />
            ) : (
              <CloudOff className="w-5 h-5 text-gray-400" />
            )}
            <div>
              <h3 className="font-medium">Google Sheets Integration</h3>
              <p className="text-sm text-muted-foreground">
                {isGoogleConnected 
                  ? `Connected • Using ${isUsingSheets ? 'Google Sheets' : 'Local Storage'}` 
                  : 'Not connected'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Sync Status */}
            {isGoogleConnected && isUsingSheets && (
              <div className="flex items-center gap-2 text-sm">
                <StatusIcon 
                  className={`w-4 h-4 ${statusInfo.color} ${statusInfo.spin ? 'animate-spin' : ''}`} 
                />
                <span className={statusInfo.color}>{statusInfo.text}</span>
                {hasPendingChanges && (
                  <Badge variant="outline" className="text-xs">
                    Changes pending
                  </Badge>
                )}
              </div>
            )}
            
            {/* Action Buttons */}
            {!isGoogleConnected ? (
              <Button onClick={handleConnect} disabled={isLoading} size="sm">
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Connect Google
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                {isUsingSheets ? (
                  <>
                    <Button onClick={handleManualSync} size="sm" variant="outline">
                      <Sync className="w-4 h-4 mr-1" />
                      Sync
                    </Button>
                    <Button onClick={handleSwitchToLocal} size="sm" variant="outline">
                      Switch to Local
                    </Button>
                  </>
                ) : (
                  <Button onClick={handleSwitchToSheets} size="sm">
                    <Cloud className="w-4 h-4 mr-1" />
                    Use Google Sheets
                  </Button>
                )}
                
                <Dialog open={showSettings} onOpenChange={setShowSettings}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Sync Settings</DialogTitle>
                      <DialogDescription>
                        Configure how your data syncs with Google Sheets
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      {/* Auto Sync */}
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="autoSync"
                          checked={autoSync}
                          onChange={(e) => setAutoSync(e.target.checked)}
                        />
                        <Label htmlFor="autoSync">Enable automatic sync</Label>
                      </div>
                      
                      {/* Sync Interval */}
                      <div className="space-y-2">
                        <Label htmlFor="syncInterval">Sync interval (seconds)</Label>
                        <Input
                          id="syncInterval"
                          type="number"
                          value={syncInterval}
                          onChange={(e) => setSyncInterval(parseInt(e.target.value) || 5)}
                          min="1"
                          max="300"
                        />
                      </div>
                      
                      {/* Conflict Resolution */}
                      <div className="space-y-2">
                        <Label>Conflict resolution</Label>
                        <Select value={conflictResolution} onValueChange={(value: any) => setConflictResolution(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual resolution</SelectItem>
                            <SelectItem value="local_wins">Local changes win</SelectItem>
                            <SelectItem value="remote_wins">Remote changes win</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowSettings(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleUpdateSyncOptions}>
                          Save Settings
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Button onClick={handleDisconnect} size="sm" variant="outline">
                  Disconnect
                </Button>
              </div>
            )}
          </div>
        </div>
        
        {googleError && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {googleError}
          </div>
        )}
      </Card>

      {/* Advanced Sync Controls */}
      {isGoogleConnected && isUsingSheets && currentProject && (
        <Card className="p-4">
          <h4 className="font-medium mb-3">Sync Controls</h4>
          <div className="flex gap-2">
            <Button onClick={handleForcePush} size="sm" variant="outline">
              <Upload className="w-4 h-4 mr-1" />
              Force Push
            </Button>
            <Button onClick={handleForcePull} size="sm" variant="outline">
              <Download className="w-4 h-4 mr-1" />
              Force Pull
            </Button>
            <Button onClick={handleManualSync} size="sm" variant="outline">
              <RefreshCw className="w-4 h-4 mr-1" />
              Manual Sync
            </Button>
          </div>
        </Card>
      )}

      {/* Conflict Resolution Dialog */}
      <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync Conflict Detected</DialogTitle>
            <DialogDescription>
              Both local and remote versions have been modified. Choose which version to keep.
            </DialogDescription>
          </DialogHeader>
          
          {conflictData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Local Version</h4>
                  <p className="text-sm text-muted-foreground">
                    Modified: {new Date(conflictData.localProject.lastModified).toLocaleString()}
                  </p>
                  <Button onClick={() => handleResolveConflict('local')} className="w-full">
                    Use Local
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Remote Version</h4>
                  <p className="text-sm text-muted-foreground">
                    Modified: {new Date(conflictData.remoteProject.lastModified).toLocaleString()}
                  </p>
                  <Button onClick={() => handleResolveConflict('remote')} className="w-full">
                    Use Remote
                  </Button>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm font-medium text-yellow-800">Conflicted fields:</p>
                <p className="text-sm text-yellow-700">
                  {conflictData.conflictFields.join(', ')}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}