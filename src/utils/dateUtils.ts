import { addDays, format, isWeekend, startOfWeek, endOfWeek, differenceInDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export interface Task {
  taskId: string;
  name: string;
  description: string;
  team: string;
  sprint?: string;
  durationDays: number;
  dependsOn: string[];
  startDate?: string;
  endDate?: string;
}

export interface Milestone {
  milestoneId: string;
  milestoneName: string;
  tasks: Task[];
  startDate?: string;
  endDate?: string;
}

// Colores por equipo
export const teamColors: Record<string, string> = {
  'Analysis': '#3b82f6',     // blue
  'Development': '#f59e0b',  // amber
  'Documentation': '#8b5cf6', // violet  
  'Automation': '#10b981',   // emerald
  'QA': '#ef4444',          // red
  'Infrastructure': '#6366f1', // indigo
  'UX': '#3b82f6',          // blue
  'UI': '#8b5cf6',          // violet  
  'PM': '#10b981',          // emerald
  'Dev': '#f59e0b',         // amber
  'Backend': '#6366f1',     // indigo
  'Frontend': '#06b6d4',    // cyan
  'Design': '#ec4899',      // pink
  'Marketing': '#84cc16',   // lime
  'Default': '#6b7280'      // gray
};

// Añadir días laborables (excluyendo fines de semana)
export function addBusinessDays(startDate: Date, businessDays: number): Date {
  let currentDate = new Date(startDate);
  let remainingDays = businessDays;
  
  while (remainingDays > 0) {
    currentDate = addDays(currentDate, 1);
    if (!isWeekend(currentDate)) {
      remainingDays--;
    }
  }
  
  return currentDate;
}

// Calcular fechas de todas las tareas basado en dependencias
export function calculateProjectDates(milestones: Milestone[], projectStartDate: Date, preserveManualDates: boolean = false): Milestone[] {
  const updatedMilestones = JSON.parse(JSON.stringify(milestones)) as Milestone[];
  const taskDateMap = new Map<string, { start: Date; end: Date }>();
  
  // Auto-create inter-milestone dependencies for sequential execution
  // Sort milestones by their ID to ensure consistent ordering
  const sortedMilestones = [...updatedMilestones].sort((a, b) => a.milestoneId.localeCompare(b.milestoneId));
  
  // Add dependencies between milestones: each milestone's first task depends on previous milestone's last task
  for (let i = 1; i < sortedMilestones.length; i++) {
    const currentMilestone = sortedMilestones[i];
    const previousMilestone = sortedMilestones[i - 1];
    
    if (currentMilestone.tasks.length > 0 && previousMilestone.tasks.length > 0) {
      const firstTaskOfCurrent = currentMilestone.tasks[0];
      const lastTaskOfPrevious = previousMilestone.tasks[previousMilestone.tasks.length - 1];
      
      // Only add dependency if the first task doesn't already have dependencies to previous milestones
      const hasInterMilestoneDependency = firstTaskOfCurrent.dependsOn.some(depId => 
        updatedMilestones.some(m => m.milestoneId !== currentMilestone.milestoneId && m.tasks.some(t => t.taskId === depId))
      );
      
      if (!hasInterMilestoneDependency) {
        // Find the actual task object in the updatedMilestones array and update it
        const milestoneInUpdated = updatedMilestones.find(m => m.milestoneId === currentMilestone.milestoneId);
        if (milestoneInUpdated && milestoneInUpdated.tasks.length > 0) {
          const taskToUpdate = milestoneInUpdated.tasks[0];
          if (!taskToUpdate.dependsOn.includes(lastTaskOfPrevious.taskId)) {
            taskToUpdate.dependsOn.push(lastTaskOfPrevious.taskId);
          }
        }
      }
    }
  }
  
  // Función recursiva para calcular fechas de una tarea
  const calculateTaskDates = (task: Task, milestone: Milestone): { start: Date; end: Date } => {
    if (taskDateMap.has(task.taskId)) {
      return taskDateMap.get(task.taskId)!;
    }
    
    // Si preserveManualDates está activo y la tarea ya tiene fechas, usarlas
    if (preserveManualDates && task.startDate && task.endDate) {
      const dates = {
        start: parseISO(task.startDate),
        end: parseISO(task.endDate)
      };
      taskDateMap.set(task.taskId, dates);
      return dates;
    }
    
    let taskStartDate = projectStartDate;
    
    // Si tiene dependencias, calcular basado en la tarea que termine más tarde
    if (task.dependsOn && task.dependsOn.length > 0) {
      let latestEndDate = projectStartDate;
      
      for (const depId of task.dependsOn) {
        // Buscar la tarea dependiente en todos los milestones
        let depTask: Task | undefined;
        let depMilestone: Milestone | undefined;
        
        for (const ms of updatedMilestones) {
          const found = ms.tasks.find(t => t.taskId === depId);
          if (found) {
            depTask = found;
            depMilestone = ms;
            break;
          }
        }
        
        if (depTask && depMilestone) {
          const depDates = calculateTaskDates(depTask, depMilestone);
          if (depDates.end > latestEndDate) {
            latestEndDate = depDates.end;
          }
        }
      }
      
      taskStartDate = addDays(latestEndDate, 1);
      // Asegurar que no comience en fin de semana
      while (isWeekend(taskStartDate)) {
        taskStartDate = addDays(taskStartDate, 1);
      }
    }
    
    const taskEndDate = addBusinessDays(taskStartDate, task.durationDays - 1);
    
    const dates = { start: taskStartDate, end: taskEndDate };
    taskDateMap.set(task.taskId, dates);
    
    return dates;
  };
  
  // Calcular fechas para todas las tareas
  for (const milestone of updatedMilestones) {
    for (const task of milestone.tasks) {
      const dates = calculateTaskDates(task, milestone);
      task.startDate = format(dates.start, 'yyyy-MM-dd');
      task.endDate = format(dates.end, 'yyyy-MM-dd');
    }
    
    // Calcular fechas del milestone basado en sus tareas
    if (milestone.tasks.length > 0) {
      const taskDates = milestone.tasks.map(t => ({
        start: parseISO(t.startDate!),
        end: parseISO(t.endDate!)
      }));
      
      const milestoneStart = new Date(Math.min(...taskDates.map(d => d.start.getTime())));
      const milestoneEnd = new Date(Math.max(...taskDates.map(d => d.end.getTime())));
      
      milestone.startDate = format(milestoneStart, 'yyyy-MM-dd');
      milestone.endDate = format(milestoneEnd, 'yyyy-MM-dd');
    }
  }
  
  return updatedMilestones;
}

// Generar semanas para el timeline
export function generateWeeks(startDate: Date, endDate: Date): Array<{ weekStart: Date; weekEnd: Date; label: string }> {
  const weeks: Array<{ weekStart: Date; weekEnd: Date; label: string }> = [];
  let currentWeek = startOfWeek(startDate, { locale: es });
  const projectEnd = endOfWeek(endDate, { locale: es });
  
  let weekNumber = 1;
  
  while (currentWeek <= projectEnd) {
    const weekEnd = endOfWeek(currentWeek, { locale: es });
    weeks.push({
      weekStart: currentWeek,
      weekEnd: weekEnd,
      label: `Sem ${weekNumber}`
    });
    
    currentWeek = addDays(weekEnd, 1);
    weekNumber++;
  }
  
  return weeks;
}

// Calcular posición y ancho de una tarea en el timeline
export function getTaskPosition(
  taskStart: Date,
  taskEnd: Date,
  timelineStart: Date,
  totalDays: number
): { left: number; width: number } {
  const dayWidth = 100 / totalDays; // Porcentaje por día
  
  const startOffset = Math.max(0, differenceInDays(taskStart, timelineStart));
  const duration = differenceInDays(taskEnd, taskStart) + 1;
  
  return {
    left: startOffset * dayWidth,
    width: duration * dayWidth
  };
}

// Nueva función para obtener el rango real del timeline alineado con semanas
export function getTimelineRange(projectStart: Date, projectEnd: Date): { timelineStart: Date; timelineEnd: Date; totalDays: number } {
  const timelineStart = startOfWeek(projectStart, { locale: es });
  const timelineEnd = endOfWeek(projectEnd, { locale: es });
  const totalDays = differenceInDays(timelineEnd, timelineStart) + 1;
  
  return { timelineStart, timelineEnd, totalDays };
}

export const calculateMilestoneDates = (milestone: Milestone): { startDate: Date; endDate: Date } => {
  if (!milestone.tasks || milestone.tasks.length === 0) {
    // Si no hay tareas, usar las fechas originales del milestone o fechas por defecto
    const defaultStart = milestone.startDate ? parseISO(milestone.startDate) : new Date();
    const defaultEnd = milestone.endDate ? parseISO(milestone.endDate) : addDays(defaultStart, 7);
    return { startDate: defaultStart, endDate: defaultEnd };
  }

  // Filtrar tareas que tienen fechas válidas
  const tasksWithDates = milestone.tasks.filter(task => task.startDate && task.endDate);
  
  if (tasksWithDates.length === 0) {
    const defaultStart = milestone.startDate ? parseISO(milestone.startDate) : new Date();
    const defaultEnd = milestone.endDate ? parseISO(milestone.endDate) : addDays(defaultStart, 7);
    return { startDate: defaultStart, endDate: defaultEnd };
  }

  // Calcular fecha más temprana (inicio del milestone)
  const startDate = tasksWithDates.reduce((earliest, task) => {
    const taskStart = parseISO(task.startDate!);
    return taskStart < earliest ? taskStart : earliest;
  }, parseISO(tasksWithDates[0].startDate!));

  // Calcular fecha más tardía (fin del milestone) 
  const endDate = tasksWithDates.reduce((latest, task) => {
    const taskEnd = parseISO(task.endDate!);
    return taskEnd > latest ? taskEnd : latest;
  }, parseISO(tasksWithDates[0].endDate!));

  return { startDate, endDate };
};

// Función para encontrar tareas que dependen de una tarea específica
export const findTasksThatDependOn = (taskId: string, allMilestones: Milestone[]): Task[] => {
  const dependentTasks: Task[] = [];
  
  allMilestones.forEach(milestone => {
    milestone.tasks.forEach(task => {
      if (task.dependsOn && task.dependsOn.includes(taskId)) {
        dependentTasks.push(task);
      }
    });
  });
  
  return dependentTasks;
};

// Función para obtener información completa de dependencias de una tarea
export const getTaskDependencyInfo = (task: Task, allMilestones: Milestone[]) => {
  const dependsOnTasks: Task[] = [];
  const dependentTasks = findTasksThatDependOn(task.taskId, allMilestones);
  
  // Buscar las tareas de las que depende esta tarea
  if (task.dependsOn) {
    task.dependsOn.forEach(depId => {
      allMilestones.forEach(milestone => {
        const foundTask = milestone.tasks.find(t => t.taskId === depId);
        if (foundTask) {
          dependsOnTasks.push(foundTask);
        }
      });
    });
  }
  
  return {
    dependsOn: dependsOnTasks,
    dependents: dependentTasks,
    hasDependencies: dependsOnTasks.length > 0 || dependentTasks.length > 0
  };
};