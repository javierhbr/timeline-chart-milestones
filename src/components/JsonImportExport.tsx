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

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        if (Array.isArray(jsonData)) {
          onImport(jsonData);
        } else {
          alert('El archivo debe contener un array de milestones');
        }
      } catch (error) {
        alert('Error al leer el archivo JSON');
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

  const handleLoadExample = () => {
    const exampleData: Milestone[] = [
      {
        milestoneId: "M1",
        milestoneName: "Diseño UI",
        tasks: [
          {
            taskId: "T1",
            name: "Wireframes",
            description: "Crear wireframes iniciales",
            team: "UX",
            sprint: "Sprint 1",
            durationDays: 4,
            dependsOn: []
          },
          {
            taskId: "T2",
            name: "Mockups",
            description: "Mockups en Figma",
            team: "UI",
            sprint: "Sprint 1",
            durationDays: 5,
            dependsOn: ["T1"]
          },
          {
            taskId: "T3",
            name: "Revisión con cliente",
            description: "Feedback de cliente",
            team: "PM",
            sprint: "Sprint 2",
            durationDays: 3,
            dependsOn: ["T1"]
          }
        ]
      },
      {
        milestoneId: "M2",
        milestoneName: "Desarrollo Frontend",
        tasks: [
          {
            taskId: "T4",
            name: "Setup del proyecto",
            description: "Configuración inicial React",
            team: "Frontend",
            sprint: "Sprint 2",
            durationDays: 2,
            dependsOn: ["T2"]
          },
          {
            taskId: "T5",
            name: "Componentes UI",
            description: "Desarrollo de componentes",
            team: "Frontend",
            sprint: "Sprint 3",
            durationDays: 8,
            dependsOn: ["T4"]
          },
          {
            taskId: "T6",
            name: "Integración API",
            description: "Conectar con backend",
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
            name: "Test unitarios",
            description: "Tests automatizados",
            team: "QA",
            sprint: "Sprint 4",
            durationDays: 4,
            dependsOn: ["T6"]
          },
          {
            taskId: "T8",
            name: "Test de integración",
            description: "Testing end-to-end",
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
            Fecha de inicio del proyecto
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
            Importar JSON
          </Button>
          
          <Button 
            onClick={handleExport}
            variant="outline"
            disabled={milestones.length === 0}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exportar JSON
          </Button>
          
          <Button 
            onClick={handleLoadExample}
            variant="secondary"
          >
            Cargar Ejemplo
          </Button>
        </div>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileImport}
        className="hidden"
      />
      
      {milestones.length === 0 && (
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <p className="text-muted-foreground">
            Importa un archivo JSON con milestones y tareas, o carga el ejemplo para comenzar.
          </p>
        </div>
      )}
    </Card>
  );
}