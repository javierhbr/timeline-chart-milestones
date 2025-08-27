import React, { useRef, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Upload,
  Download,
  Calendar,
  Info,
  X,
  FolderOpen,
  Save,
  ChevronDown,
  Plus,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { Milestone } from '../utils/dateUtils';
import {
  Project,
  createProject,
  TimelineData,
  generateDefaultProjectName,
} from '../utils/projectStorage';

interface JsonImportExportProps {
  milestones: Milestone[];
  onImport: (milestones: Milestone[]) => void;
  projectStartDate: Date;
  onStartDateChange: (date: Date) => void;
  currentProject: Project | null;
  onOpenProjectManager: () => void;
}

export function JsonImportExport({
  milestones,
  onImport,
  projectStartDate,
  onStartDateChange,
  currentProject, // eslint-disable-line @typescript-eslint/no-unused-vars
  onOpenProjectManager,
}: JsonImportExportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showImportOptions, setShowImportOptions] = useState(false);

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
    
    // Add the last field
    result.push(current.trim());
    return result;
  };

  const parseCSV = (csvText: string): Milestone[] => {
    const lines = csvText.trim().split('\n');
    const header = parseCSVLine(lines[0]);

    // Validate CSV header (more flexible)
    // const expectedHeader = [
    //   'milestoneId',
    //   'milestoneName',
    //   'taskId',
    //   'taskName',
    //   'taskDescription',
    //   'team',
    //   'sprint',
    //   'durationDays',
    //   'dependsOn',
    // ];
    const hasRequiredHeaders = [
      'milestoneId',
      'milestoneName',
      'taskId',
      'taskName',
    ].every(required => header.includes(required));

    if (!hasRequiredHeaders) {
      throw new Error(
        'CSV must contain at least: milestoneId, milestoneName, taskId, taskName'
      );
    }

    const milestonesMap = new Map<string, Milestone>();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line properly handling quotes
      const values = parseCSVLine(line);
      while (values.length < 9) {
        values.push('');
      }

      const [
        milestoneId,
        milestoneName,
        taskId,
        taskName,
        taskDescription,
        team,
        sprint,
        durationDays,
        dependsOn,
      ] = values;

      // Get or create milestone
      if (!milestonesMap.has(milestoneId)) {
        milestonesMap.set(milestoneId, {
          milestoneId,
          milestoneName,
          tasks: [],
        });
      }

      const milestone = milestonesMap.get(milestoneId)!;

      // Parse dependencies
      const dependencies = dependsOn.trim()
        ? dependsOn.split('|').map(dep => dep.trim())
        : [];

      // Add task to milestone
      milestone.tasks.push({
        taskId,
        name: taskName,
        description: taskDescription || '',
        team: team || 'Default',
        sprint: sprint || '',
        durationDays: durationDays ? parseInt(durationDays, 10) : 1,
        dependsOn: dependencies,
      });
    }

    return Array.from(milestonesMap.values());
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const fileContent = e.target?.result as string;
        const fileExtension = file.name.split('.').pop()?.toLowerCase();

        let parsedData: Milestone[];

        if (fileExtension === 'csv') {
          parsedData = parseCSV(fileContent);
        } else if (fileExtension === 'json') {
          const jsonData = JSON.parse(fileContent);
          if (Array.isArray(jsonData)) {
            parsedData = jsonData;
          } else {
            throw new Error(
              'The JSON file must contain an array of milestones'
            );
          }
        } else {
          throw new Error('Unsupported file format. Use .json or .csv');
        }

        if (showImportOptions) {
          // Show import options dialog
          handleImportWithOptions(parsedData);
        } else {
          onImport(parsedData);
        }
      } catch (error) {
        alert(
          `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(milestones, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `gantt-project-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const escapeCSVField = (field: string): string => {
    // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return `"${field}"`;
  };

  const handleExportCSV = () => {
    const csvHeader =
      'milestoneId,milestoneName,taskId,taskName,taskDescription,team,sprint,durationDays,dependsOn\n';
    const csvRows = milestones.flatMap(milestone =>
      milestone.tasks.map(task => {
        const dependsOn = task.dependsOn.join('|');
        return [
          escapeCSVField(milestone.milestoneId),
          escapeCSVField(milestone.milestoneName),
          escapeCSVField(task.taskId),
          escapeCSVField(task.name),
          escapeCSVField(task.description),
          escapeCSVField(task.team),
          escapeCSVField(task.sprint || ''),
          task.durationDays.toString(),
          escapeCSVField(dependsOn)
        ].join(',');
      })
    );

    const csvContent = csvHeader + csvRows.join('\n');
    const dataBlob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `gantt-project-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoadExample = () => {
    const exampleData: Milestone[] = [
      {
        milestoneId: 'M1',
        milestoneName: 'UI Design',
        tasks: [
          {
            taskId: 'T1',
            name: 'Wireframes',
            description: 'Create initial wireframes',
            team: 'UX',
            sprint: 'Sprint 1',
            durationDays: 4,
            dependsOn: [],
          },
          {
            taskId: 'T2',
            name: 'Mockups',
            description: 'Mockups in Figma',
            team: 'UI',
            sprint: 'Sprint 1',
            durationDays: 5,
            dependsOn: ['T1'],
          },
          {
            taskId: 'T3',
            name: 'Client Review',
            description: 'Client feedback',
            team: 'PM',
            sprint: 'Sprint 2',
            durationDays: 3,
            dependsOn: ['T1'],
          },
        ],
      },
      {
        milestoneId: 'M2',
        milestoneName: 'Frontend Development',
        tasks: [
          {
            taskId: 'T4',
            name: 'Project Setup',
            description: 'Initial React configuration',
            team: 'Frontend',
            sprint: 'Sprint 2',
            durationDays: 2,
            dependsOn: ['T2'],
          },
          {
            taskId: 'T5',
            name: 'UI Components',
            description: 'Component development',
            team: 'Frontend',
            sprint: 'Sprint 3',
            durationDays: 8,
            dependsOn: ['T4'],
          },
          {
            taskId: 'T6',
            name: 'API Integration',
            description: 'Connect with backend',
            team: 'Frontend',
            sprint: 'Sprint 4',
            durationDays: 5,
            dependsOn: ['T5'],
          },
        ],
      },
      {
        milestoneId: 'M3',
        milestoneName: 'Testing',
        tasks: [
          {
            taskId: 'T7',
            name: 'Unit Tests',
            description: 'Automated tests',
            team: 'QA',
            sprint: 'Sprint 4',
            durationDays: 4,
            dependsOn: ['T6'],
          },
          {
            taskId: 'T8',
            name: 'Integration Tests',
            description: 'End-to-end testing',
            team: 'QA',
            sprint: 'Sprint 5',
            durationDays: 3,
            dependsOn: ['T7'],
          },
        ],
      },
    ];

    onImport(exampleData);
  };

  const handleImportWithOptions = (importedMilestones: Milestone[]) => {
    const shouldCreateNewProject = confirm(
      'Do you want to create a new project with this data? Click OK for new project, Cancel to import into current project.'
    );

    if (shouldCreateNewProject) {
      const timelineData: TimelineData = {
        milestones: importedMilestones,
        projectStartDate: projectStartDate.toISOString(),
        expandedMilestones: [],
      };

      const projectName =
        prompt('Enter a name for the new project:') ||
        generateDefaultProjectName();
      createProject(projectName, timelineData, true);

      // Refresh the page to load the new project
      window.location.reload();
    } else {
      onImport(importedMilestones);
    }

    setShowImportOptions(false);
  };

  const handleSaveAsNewProject = () => {
    if (milestones.length === 0) {
      alert('No data to save. Please add some milestones and tasks first.');
      return;
    }

    const projectName = prompt('Enter a name for the new project:');
    if (!projectName) return;

    const timelineData: TimelineData = {
      milestones,
      projectStartDate: projectStartDate.toISOString(),
      expandedMilestones: [],
    };

    createProject(projectName.trim(), timelineData, true);

    // Refresh the page to load the new project
    window.location.reload();
  };

  return (
    <Card className="p-6 mb-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
        <div className="flex-1">
          <label htmlFor="startDate" className="block mb-2">
            <Calendar className="inline w-4 h-4 mr-2" />
            Project start date
          </label>
          <Input
            id="startDate"
            type="date"
            value={projectStartDate.toISOString().split('T')[0]}
            onChange={e => onStartDateChange(new Date(e.target.value))}
            className="w-full md:w-auto"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Projects Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                Projects
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => {
                  const projectName = generateDefaultProjectName();
                  const timelineData: TimelineData = {
                    milestones: [],
                    projectStartDate: new Date().toISOString(),
                    expandedMilestones: [],
                  };
                  createProject(projectName, timelineData, true);
                  window.location.reload();
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenProjectManager}>
                <FolderOpen className="w-4 h-4 mr-2" />
                Open Project
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleSaveAsNewProject}
                disabled={milestones.length === 0}
              >
                <Save className="w-4 h-4 mr-2" />
                Save as New Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Import Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Import
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = '.csv';
                    fileInputRef.current.click();
                  }
                }}
              >
                <FileText className="w-4 h-4 mr-2" />
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = '.json';
                    fileInputRef.current.click();
                  }
                }}
              >
                <FileText className="w-4 h-4 mr-2" />
                JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                disabled={milestones.length === 0}
              >
                <Download className="w-4 h-4" />
                Export
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleExport}>
                <FileText className="w-4 h-4 mr-2" />
                JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV}>
                <FileText className="w-4 h-4 mr-2" />
                CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Examples Button */}
          <Button onClick={handleLoadExample} variant="secondary">
            Load Example
          </Button>

          {/* Help Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                Help
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => setShowInstructions(!showInstructions)}
              >
                <Info className="w-4 h-4 mr-2" />
                {showInstructions ? 'Hide' : 'Show'} File Format
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv"
        onChange={handleFileImport}
        className="hidden"
      />

      {milestones.length === 0 && (
        <div className="mt-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-muted-foreground">
              Import a JSON or CSV file with milestones and tasks, or load the
              example to get started.
            </p>
          </div>
        </div>
      )}

      {showInstructions && (
        <div className="mt-4">
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">
                📋 File Format Guide & Attribute Relationships
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInstructions(false)}
                className="h-8 w-8 p-0 hover:bg-muted-foreground/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-6">
              {/* Overview Section */}
              <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                <h4 className="font-medium mb-2 text-blue-800">
                  🎯 Project Structure Overview
                </h4>
                <p className="text-sm text-blue-700">
                  Your project is organized in a <strong>hierarchy</strong>:{' '}
                  <strong>Milestones</strong> contain multiple{' '}
                  <strong>Tasks</strong>. Tasks can depend on other tasks to
                  create workflow sequences.
                </p>
              </div>

              {/* CSV Format */}
              <div>
                <h2 className="font-medium mb-3 text-lg flex items-center gap-2">
                  📊 CSV Format - Building Your File
                </h2>

                <div className="space-y-3">
                  <div>
                    <h5 className="font-medium mb-1">
                      Required Header Row (must be exact):
                    </h5>
                    <code className="text-xs bg-background p-2 rounded block mb-2">
                      milestoneId,milestoneName,taskId,taskName,taskDescription,team,sprint,durationDays,dependsOn
                    </code>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium mb-2">
                        🏗️ Attribute Definitions:
                      </h5>
                      <ul className="text-sm space-y-2">
                        <li>
                          <strong>milestoneId:</strong> Unique identifier (M1,
                          M2, etc.)
                        </li>
                        <li>
                          <strong>milestoneName:</strong> Milestone title (e.g.,
                          "UI Design")
                        </li>
                        <li>
                          <strong>taskId:</strong> Unique task identifier (T1,
                          T2, etc.)
                        </li>
                        <li>
                          <strong>taskName:</strong> Task title (e.g., "Create
                          Wireframes")
                        </li>
                        <li>
                          <strong>taskDescription:</strong> Detailed task
                          description
                        </li>
                        <li>
                          <strong>team:</strong> Responsible team (UI, Backend,
                          QA, etc.)
                        </li>
                        <li>
                          <strong>sprint:</strong> Sprint assignment (Sprint 1,
                          Sprint 2, etc.)
                        </li>
                        <li>
                          <strong>durationDays:</strong> Working days needed
                          (number only)
                        </li>
                        <li>
                          <strong>dependsOn:</strong> Tasks that must finish
                          first
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h5 className="font-medium mb-2">
                        🔗 Relationship Rules:
                      </h5>
                      <ul className="text-sm space-y-2">
                        <li>
                          <strong>Milestone Grouping:</strong> Tasks with same
                          milestoneId are grouped together
                        </li>
                        <li>
                          <strong>Task Dependencies:</strong> Use taskId values
                          separated by "|"
                        </li>
                        <li>
                          <strong>Sequential Flow:</strong> Tasks wait for
                          dependencies to complete
                        </li>
                        <li>
                          <strong>No Dependencies:</strong> Leave dependsOn
                          column empty
                        </li>
                        <li>
                          <strong>Team Colors:</strong> Each team gets automatic
                          color coding
                        </li>
                        <li>
                          <strong>Duration Logic:</strong> Dates auto-calculated
                          from dependencies
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div>
                    <h5 className="font-medium mb-2">
                      📝 CSV Example with Relationships:
                    </h5>
                    <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
                      {`milestoneId,milestoneName,taskId,taskName,taskDescription,team,sprint,durationDays,dependsOn
M1,Design Phase,T1,Research,User research and analysis,UX,Sprint 1,5,
M1,Design Phase,T2,Wireframes,Create initial wireframes,UX,Sprint 1,3,T1
M1,Design Phase,T3,Mockups,High-fidelity mockups,UI,Sprint 2,4,T2
M2,Development,T4,Setup,Project configuration,Backend,Sprint 2,2,T3
M2,Development,T5,API,Build REST API,Backend,Sprint 3,6,T4
M2,Development,T6,Frontend,Build user interface,Frontend,Sprint 3,8,T3|T5
M3,Testing,T7,Unit Tests,Component testing,QA,Sprint 4,3,T6
M3,Testing,T8,Integration,End-to-end testing,QA,Sprint 4,4,T7`}
                    </pre>
                    <p className="text-xs text-muted-foreground mt-2">
                      Notice: T6 depends on both T3 and T5 (T3|T5), creating
                      parallel workflows that merge.
                    </p>
                  </div>
                </div>
              </div>

              {/* JSON Format */}
              <div>
                <h2 className="font-medium mb-3 text-lg flex items-center gap-2">
                  🗂️ JSON Format - Structured Approach
                </h2>

                <div className="space-y-3">
                  <div>
                    <h5 className="font-medium mb-2">
                      🏗️ JSON Structure Rules:
                    </h5>
                    <ul className="text-sm space-y-1 mb-3">
                      <li>• Root: Array of milestone objects</li>
                      <li>• Each milestone contains a tasks array</li>
                      <li>• dependsOn is an array of taskId strings</li>
                      <li>
                        • All dates are auto-calculated from project start date
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-medium mb-2">
                      📄 Complete JSON Example:
                    </h5>
                    <pre className="text-xs bg-background p-3 rounded overflow-x-auto">
                      {`[
  {
    "milestoneId": "M1",
    "milestoneName": "Design Phase",
    "tasks": [
      {
        "taskId": "T1",
        "name": "User Research",
        "description": "Conduct user interviews and surveys",
        "team": "UX",
        "sprint": "Sprint 1",
        "durationDays": 5,
        "dependsOn": []
      },
      {
        "taskId": "T2",
        "name": "Wireframes",
        "description": "Create low-fidelity wireframes",
        "team": "UX",
        "sprint": "Sprint 1",
        "durationDays": 3,
        "dependsOn": ["T1"]
      },
      {
        "taskId": "T3",
        "name": "UI Mockups",
        "description": "Design high-fidelity mockups",
        "team": "UI",
        "sprint": "Sprint 2",
        "durationDays": 4,
        "dependsOn": ["T2"]
      }
    ]
  },
  {
    "milestoneId": "M2",
    "milestoneName": "Development",
    "tasks": [
      {
        "taskId": "T4",
        "name": "Backend API",
        "description": "Develop REST API endpoints",
        "team": "Backend",
        "sprint": "Sprint 2",
        "durationDays": 6,
        "dependsOn": ["T2"]
      },
      {
        "taskId": "T5",
        "name": "Frontend Components",
        "description": "Build React components",
        "team": "Frontend",
        "sprint": "Sprint 3",
        "durationDays": 8,
        "dependsOn": ["T3", "T4"]
      }
    ]
  }
]`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Best Practices */}
              <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-400">
                <h4 className="font-medium mb-2 text-green-800">
                  ✅ Best Practices for Building Your File
                </h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>
                    • <strong>Start Simple:</strong> Create milestones first,
                    then add tasks
                  </li>
                  <li>
                    • <strong>Logical Grouping:</strong> Group related tasks
                    under meaningful milestones
                  </li>
                  <li>
                    • <strong>Clear Dependencies:</strong> Only add dependencies
                    when tasks truly block others
                  </li>
                  <li>
                    • <strong>Realistic Durations:</strong> Use working days,
                    not calendar days
                  </li>
                  <li>
                    • <strong>Team Consistency:</strong> Use same team names
                    throughout the project
                  </li>
                  <li>
                    • <strong>Sequential IDs:</strong> Use T1, T2, T3... for
                    easy reference
                  </li>
                </ul>
              </div>

              {/* Common Issues */}
              <div className="p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
                <h4 className="font-medium mb-2 text-yellow-800">
                  ⚠️ Common Issues to Avoid
                </h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>
                    • <strong>Circular Dependencies:</strong> Task A depends on
                    B, B depends on A
                  </li>
                  <li>
                    • <strong>Missing Dependencies:</strong> Referencing
                    non-existent taskIds
                  </li>
                  <li>
                    • <strong>Empty Required Fields:</strong> All fields except
                    dependsOn are required
                  </li>
                  <li>
                    • <strong>Invalid Duration:</strong> Use positive numbers
                    only
                  </li>
                  <li>
                    • <strong>Wrong CSV Format:</strong> Missing commas or
                    incorrect column order
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
