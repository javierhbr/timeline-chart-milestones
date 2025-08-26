import React, { useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Upload, Download, Calendar } from 'lucide-react';
import { Milestone } from '../utils/dateUtils';

interface JsonImportExportProps {
  milestones: Milestone[];
  onImport: (milestones: Milestone[]) => void;
  projectStartDate: Date;
  onStartDateChange: (date: Date) => void;
}

export function JsonImportExport({ 
  milestones, 
  onImport, 
  projectStartDate, 
  onStartDateChange 
}: JsonImportExportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (csvText: string): Milestone[] => {
    const lines = csvText.trim().split('\n');
    const header = lines[0].split(',');
    
    // Validate CSV header
    const expectedHeader = ['milestoneId', 'milestoneName', 'taskId', 'taskName', 'taskDescription', 'team', 'sprint', 'durationDays', 'dependsOn'];
    if (!expectedHeader.every((col, index) => header[index] === col)) {
      throw new Error('CSV header does not match expected format');
    }

    const milestonesMap = new Map<string, Milestone>();
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',');
      if (values.length !== 9) continue;
      
      const [milestoneId, milestoneName, taskId, taskName, taskDescription, team, sprint, durationDays, dependsOn] = values;
      
      // Get or create milestone
      if (!milestonesMap.has(milestoneId)) {
        milestonesMap.set(milestoneId, {
          milestoneId,
          milestoneName,
          tasks: []
        });
      }
      
      const milestone = milestonesMap.get(milestoneId)!;
      
      // Parse dependencies
      const dependencies = dependsOn.trim() ? dependsOn.split('|').map(dep => dep.trim()) : [];
      
      // Add task to milestone
      milestone.tasks.push({
        taskId,
        name: taskName,
        description: taskDescription,
        team,
        sprint,
        durationDays: parseInt(durationDays, 10),
        dependsOn: dependencies
      });
    }
    
    return Array.from(milestonesMap.values());
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
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
            throw new Error('The JSON file must contain an array of milestones');
          }
        } else {
          throw new Error('Unsupported file format. Use .json or .csv');
        }
        
        onImport(parsedData);
      } catch (error) {
        alert(`Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  const handleExportCSV = () => {
    const csvHeader = 'milestoneId,milestoneName,taskId,taskName,taskDescription,team,sprint,durationDays,dependsOn\n';
    const csvRows = milestones.flatMap(milestone => 
      milestone.tasks.map(task => {
        const dependsOn = task.dependsOn.join('|');
        return `${milestone.milestoneId},${milestone.milestoneName},${task.taskId},${task.name},${task.description},${task.team},${task.sprint},${task.durationDays},${dependsOn}`;
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
        milestoneId: "M1",
        milestoneName: "UI Design",
        tasks: [
          {
            taskId: "T1",
            name: "Wireframes",
            description: "Create initial wireframes",
            team: "UX",
            sprint: "Sprint 1",
            durationDays: 4,
            dependsOn: []
          },
          {
            taskId: "T2",
            name: "Mockups",
            description: "Mockups in Figma",
            team: "UI",
            sprint: "Sprint 1",
            durationDays: 5,
            dependsOn: ["T1"]
          },
          {
            taskId: "T3",
            name: "Client Review",
            description: "Client feedback",
            team: "PM",
            sprint: "Sprint 2",
            durationDays: 3,
            dependsOn: ["T1"]
          }
        ]
      },
      {
        milestoneId: "M2",
        milestoneName: "Frontend Development",
        tasks: [
          {
            taskId: "T4",
            name: "Project Setup",
            description: "Initial React configuration",
            team: "Frontend",
            sprint: "Sprint 2",
            durationDays: 2,
            dependsOn: ["T2"]
          },
          {
            taskId: "T5",
            name: "UI Components",
            description: "Component development",
            team: "Frontend",
            sprint: "Sprint 3",
            durationDays: 8,
            dependsOn: ["T4"]
          },
          {
            taskId: "T6",
            name: "API Integration",
            description: "Connect with backend",
            team: "Frontend",
            sprint: "Sprint 4",
            durationDays: 5,
            dependsOn: ["T5"]
          }
        ]
      },
      {
        milestoneId: "M3",
        milestoneName: "Testing",
        tasks: [
          {
            taskId: "T7",
            name: "Unit Tests",
            description: "Automated tests",
            team: "QA",
            sprint: "Sprint 4",
            durationDays: 4,
            dependsOn: ["T6"]
          },
          {
            taskId: "T8",
            name: "Integration Tests",
            description: "End-to-end testing",
            team: "QA",
            sprint: "Sprint 5",
            durationDays: 3,
            dependsOn: ["T7"]
          }
        ]
      }
    ];
    
    onImport(exampleData);
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
            onChange={(e) => onStartDateChange(new Date(e.target.value))}
            className="w-full md:w-auto"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Import CSV/JSON
          </Button>
          
          <Button 
            onClick={handleExport}
            variant="outline"
            disabled={milestones.length === 0}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export JSON
          </Button>
          
          <Button 
            onClick={handleExportCSV}
            variant="outline"
            disabled={milestones.length === 0}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          
          <Button 
            onClick={handleLoadExample}
            variant="secondary"
          >
            Load Example
          </Button>
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
              Import a JSON or CSV file with milestones and tasks, or load the example to get started.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}