import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Milestone, Task, teamColors } from '../utils/dateUtils';
import { format, parseISO, startOfYear, endOfYear, eachMonthOfInterval, startOfMonth, endOfMonth, differenceInDays, isAfter, isBefore, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

interface MonthlyGanttTimelineProps {
  milestones: Milestone[];
}

interface MilestoneMarker {
  name: string;
  date: Date;
  position: number;
}

export function MonthlyGanttTimeline({ milestones }: MonthlyGanttTimelineProps) {
  // Estados para zoom y navegación
  const [currentStartMonth, setCurrentStartMonth] = useState(0); // Offset del mes inicial
  const [zoomLevel, setZoomLevel] = useState<1 | 3 | 6 | 12>(6); // Número de meses a mostrar
  
  // Referencias para scroll horizontal
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null);

  // Paleta de colores para diferentes milestones
  const milestoneColors = [
    { 
      main: '#fb923c', 
      secondary: '#ea580c', 
      bg: 'bg-orange-500', 
      bgSecondary: 'bg-orange-400',
      gentle: 'rgba(251, 146, 60, 0.08)', // Orange gentle background
      gentleHover: 'rgba(251, 146, 60, 0.12)'
    },
    { 
      main: '#22d3ee', 
      secondary: '#0891b2', 
      bg: 'bg-cyan-500', 
      bgSecondary: 'bg-cyan-400',
      gentle: 'rgba(34, 211, 238, 0.08)', // Cyan gentle background
      gentleHover: 'rgba(34, 211, 238, 0.12)'
    },
    { 
      main: '#8b5cf6', 
      secondary: '#7c3aed', 
      bg: 'bg-purple-500', 
      bgSecondary: 'bg-purple-400',
      gentle: 'rgba(139, 92, 246, 0.08)', // Purple gentle background
      gentleHover: 'rgba(139, 92, 246, 0.12)'
    },
    { 
      main: '#10b981', 
      secondary: '#059669', 
      bg: 'bg-emerald-500', 
      bgSecondary: 'bg-emerald-400',
      gentle: 'rgba(16, 185, 129, 0.08)', // Emerald gentle background
      gentleHover: 'rgba(16, 185, 129, 0.12)'
    },
    { 
      main: '#f59e0b', 
      secondary: '#d97706', 
      bg: 'bg-amber-500', 
      bgSecondary: 'bg-amber-400',
      gentle: 'rgba(245, 158, 11, 0.08)', // Amber gentle background
      gentleHover: 'rgba(245, 158, 11, 0.12)'
    },
    { 
      main: '#ef4444', 
      secondary: '#dc2626', 
      bg: 'bg-red-500', 
      bgSecondary: 'bg-red-400',
      gentle: 'rgba(239, 68, 68, 0.08)', // Red gentle background
      gentleHover: 'rgba(239, 68, 68, 0.12)'
    },
  ];

  const getMilestoneColor = (index: number) => {
    return milestoneColors[index % milestoneColors.length];
  };

  const yearData = useMemo(() => {
    if (milestones.length === 0) return null;

    // Calcular el rango de fechas del proyecto
    const allDates = milestones.flatMap(m => 
      m.tasks.map(t => [parseISO(t.startDate!), parseISO(t.endDate!)])
    ).flat();
    
    if (allDates.length === 0) return null;
    
    const projectStart = new Date(Math.min(...allDates.map(d => d.getTime())));
    
    // Calcular el rango total de 12 meses
    const fullTimelineStart = new Date(projectStart.getFullYear(), projectStart.getMonth(), 1);
    const fullTimelineEnd = new Date(fullTimelineStart.getFullYear(), fullTimelineStart.getMonth() + 12, 0);
    
    // Para scroll horizontal: generar todos los 12 meses
    const allMonths = eachMonthOfInterval({ start: fullTimelineStart, end: fullTimelineEnd }).slice(0, 12);
    
    // Calcular el rango visible actual basado en zoom y navegación
    const viewStart = addMonths(fullTimelineStart, currentStartMonth);
    const viewEnd = addMonths(viewStart, zoomLevel);
    
    const months = eachMonthOfInterval({ start: viewStart, end: viewEnd }).slice(0, zoomLevel);
    
    const totalDays = differenceInDays(viewEnd, viewStart) + 1;
    const fullYearDays = differenceInDays(fullTimelineEnd, fullTimelineStart) + 1;
    
    // Calcular marcadores de milestones que están en el rango visible
    const milestoneMarkers: MilestoneMarker[] = milestones
      .filter(m => m.startDate && m.endDate)
      .map(m => {
        const milestoneDate = parseISO(m.startDate!);
        const daysDiff = differenceInDays(milestoneDate, viewStart);
        const position = (daysDiff / totalDays) * 100;
        
        return {
          name: m.milestoneName,
          date: milestoneDate,
          position: position
        };
      })
      .filter(marker => marker.position >= 0 && marker.position <= 100);

    // Calcular marcadores de deliverables (banderas rojas al final de milestones)
    const deliverableMarkers = milestones
      .filter(m => m.endDate)
      .map(m => {
        const deliverableDate = parseISO(m.endDate!);
        const daysDiff = differenceInDays(deliverableDate, viewStart);
        const position = (daysDiff / totalDays) * 100;
        
        return {
          name: m.milestoneName,
          date: deliverableDate,
          position: position
        };
      })
      .filter(marker => marker.position >= 0 && marker.position <= 100);

    return {
      year: format(viewStart, 'yyyy'),
      yearStart: viewStart,
      yearEnd: viewEnd,
      months,
      allMonths,
      totalDays,
      fullYearDays,
      milestoneMarkers,
      deliverableMarkers,
      fullTimelineStart,
      fullTimelineEnd,
      maxMonthOffset: 12 - zoomLevel
    };
  }, [milestones, currentStartMonth, zoomLevel]);

  // Función para calcular la posición y ancho de las tareas
  const getTaskBarStyle = (task: Task) => {
    if (!yearData || !task.startDate || !task.endDate) return { left: 0, width: 0 };

    const taskStart = parseISO(task.startDate);
    const taskEnd = parseISO(task.endDate);
    
    const startOffset = Math.max(0, differenceInDays(taskStart, yearData.yearStart));
    const taskDuration = differenceInDays(taskEnd, taskStart) + 1;
    
    const left = (startOffset / yearData.totalDays) * 100;
    const width = (taskDuration / yearData.totalDays) * 100;
    
    return {
      left: Math.max(0, left),
      width: Math.max(0.5, width) // Mínimo ancho visible
    };
  };

  // Calcular porcentaje de progreso simulado (basado en fechas actuales)
  const getProgressPercentage = (task: Task): number => {
    if (!task.startDate || !task.endDate) return 0;
    
    const taskStart = parseISO(task.startDate);
    const taskEnd = parseISO(task.endDate);
    const now = new Date();
    
    if (isBefore(now, taskStart)) return 0;
    if (isAfter(now, taskEnd)) return 100;
    
    const totalDays = differenceInDays(taskEnd, taskStart) + 1;
    const elapsedDays = differenceInDays(now, taskStart) + 1;
    
    return Math.round((elapsedDays / totalDays) * 100);
  };

  // Funciones de navegación y zoom con scroll
  const scrollToMonth = (monthIndex: number) => {
    if (!scrollContainerRef.current || zoomLevel === 12) return;
    
    const containerWidth = scrollContainerRef.current.clientWidth;
    const totalScrollWidth = scrollContainerRef.current.scrollWidth;
    const scrollPercentage = monthIndex / 12;
    const scrollPosition = scrollPercentage * (totalScrollWidth - containerWidth);
    
    scrollContainerRef.current.scrollTo({
      left: scrollPosition,
      behavior: 'smooth'
    });
  };

  const navigatePrevious = () => {
    const newMonth = Math.max(0, currentStartMonth - 1);
    setCurrentStartMonth(newMonth);
    scrollToMonth(newMonth);
  };

  const navigateNext = () => {
    if (!yearData) return;
    const newMonth = Math.min(yearData.maxMonthOffset, currentStartMonth + 1);
    setCurrentStartMonth(newMonth);
    scrollToMonth(newMonth);
  };

  const handleZoomChange = (newZoom: 1 | 3 | 6 | 12) => {
    setZoomLevel(newZoom);
    // Ajustar currentStartMonth si es necesario
    const maxOffset = 12 - newZoom;
    if (currentStartMonth > maxOffset) {
      setCurrentStartMonth(maxOffset);
    }
    
    // Reset scroll position when changing zoom
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  };

  // Efecto para sincronizar scroll con navegación
  useEffect(() => {
    if (zoomLevel < 12) {
      scrollToMonth(currentStartMonth);
    }
  }, [currentStartMonth, zoomLevel]);

  // Manejar el evento de scroll para actualizar currentStartMonth
  const handleScroll = () => {
    if (!scrollContainerRef.current || zoomLevel === 12) return;
    
    const container = scrollContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const containerWidth = container.clientWidth;
    const totalScrollWidth = container.scrollWidth;
    
    // Calcular el mes actual basado en la posición del scroll
    const scrollPercentage = scrollLeft / (totalScrollWidth - containerWidth);
    const currentMonth = Math.round(scrollPercentage * (12 - zoomLevel));
    
    if (currentMonth !== currentStartMonth) {
      setCurrentStartMonth(Math.max(0, Math.min(12 - zoomLevel, currentMonth)));
    }
  };

  if (!yearData) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No hay datos para mostrar en el timeline mensual</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Controles de navegación y zoom */}
      <div className="border-b bg-muted/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Navegación:</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={navigatePrevious}
              disabled={currentStartMonth === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm px-3 py-1 bg-background rounded border">
              {format(yearData.yearStart, 'MMM yyyy', { locale: es })} - {format(addMonths(yearData.yearStart, zoomLevel - 1), 'MMM yyyy', { locale: es })}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={navigateNext}
              disabled={currentStartMonth >= yearData.maxMonthOffset}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Zoom:</span>
            <Button 
              variant={zoomLevel === 1 ? "default" : "outline"} 
              size="sm" 
              onClick={() => handleZoomChange(1)}
              className="flex items-center gap-1"
            >
              <ZoomIn className="w-3 h-3" />
              1m
            </Button>
            <Button 
              variant={zoomLevel === 3 ? "default" : "outline"} 
              size="sm" 
              onClick={() => handleZoomChange(3)}
              className="flex items-center gap-1"
            >
              <ZoomIn className="w-3 h-3" />
              3m
            </Button>
            <Button 
              variant={zoomLevel === 6 ? "default" : "outline"} 
              size="sm" 
              onClick={() => handleZoomChange(6)}
              className="flex items-center gap-1"
            >
              6m
            </Button>
            <Button 
              variant={zoomLevel === 12 ? "default" : "outline"} 
              size="sm" 
              onClick={() => handleZoomChange(12)}
              className="flex items-center gap-1"
            >
              <ZoomOut className="w-3 h-3" />
              12m
            </Button>
          </div>
        </div>

        {/* Indicador de progreso del timeline */}
        {zoomLevel < 12 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Posición:</span>
            <div className="flex-1 max-w-xs">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-200"
                  style={{ 
                    width: `${((currentStartMonth + zoomLevel) / 12) * 100}%`,
                    marginLeft: `${(currentStartMonth / 12) * 100}%`
                  }}
                />
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              {currentStartMonth + 1}-{currentStartMonth + zoomLevel} de 12 meses
            </span>
          </div>
        )}
      </div>

      {/* Header con año y meses - con scroll horizontal */}
      <div className="border-b">
        <div className="flex">
          {/* Columna de año */}
          <div className="w-32 bg-slate-600 text-white flex items-center justify-center font-bold text-xl border-r border-slate-400 flex-shrink-0">
            {yearData.year}
          </div>
          
          {/* Contenedor scrolleable de meses */}
          <div 
            className={`flex-1 ${zoomLevel < 12 ? 'overflow-x-auto' : ''}`}
            ref={scrollContainerRef}
            onScroll={handleScroll}
          >
            <div 
              className="flex"
              style={{ 
                width: zoomLevel < 12 ? `${(12 / zoomLevel) * 100}%` : '100%',
                minWidth: '100%'
              }}
            >
              {(zoomLevel < 12 ? yearData.allMonths : yearData.months).map((month, index) => {
                const isVisible = zoomLevel === 12 || (index >= currentStartMonth && index < currentStartMonth + zoomLevel);
                const monthWidth = zoomLevel < 12 ? `${100 / 12}%` : `${100 / zoomLevel}%`;
                
                return (
                  <div
                    key={index}
                    className={`bg-slate-500 text-white text-center py-4 border-r border-slate-400 last:border-r-0 font-medium flex-shrink-0 ${
                      !isVisible && zoomLevel < 12 ? 'opacity-50' : ''
                    }`}
                    style={{ width: monthWidth }}
                  >
                    {format(month, 'MMM', { locale: es })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Marcadores de milestones - con scroll horizontal */}
      <div className="relative h-20 border-b bg-gray-100">
        <div className="flex">
          <div className="w-32 border-r border-gray-300 flex-shrink-0"></div>
          <div 
            className={`flex-1 relative ${zoomLevel < 12 ? 'overflow-x-auto' : ''}`}
            style={{ 
              width: zoomLevel < 12 ? `${(12 / zoomLevel) * 100}%` : '100%'
            }}
          >
            <div 
              className="relative w-full h-full"
              style={{ 
                width: zoomLevel < 12 ? `${(12 / zoomLevel) * 100}%` : '100%',
                minWidth: '100%'
              }}
            >
              {yearData.milestoneMarkers.map((marker, index) => (
                <div
                  key={index}
                  className="absolute top-2 flex flex-col items-center z-10"
                  style={{ left: `${marker.position}%`, transform: 'translateX(-50%)' }}
                >
                  {/* Nueva bandera estilo imagen: triángulo rojo + caja verde */}
                  <div className="flex flex-col items-center">
                    {/* Triángulo rojo apuntando hacia abajo */}
                    <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[16px] border-t-red-500 drop-shadow-sm"></div>
                    {/* Línea conectora muy corta */}
                    <div className="w-0.5 h-1 bg-red-500"></div>
                  </div>
                  
                  {/* Caja verde con texto del milestone */}
                  <div className="absolute top-6 bg-green-100 border-2 border-green-500 rounded-md px-3 py-2 text-xs whitespace-nowrap shadow-md min-w-[80px] text-center">
                    <div className="font-semibold text-green-800">Milestone</div>
                    <div className="text-green-700 text-[11px] mt-0.5">{format(marker.date, 'd MMM', { locale: es })}</div>
                  </div>
                </div>
              ))}
              
              {/* Banderas de deliverables */}
              {yearData.deliverableMarkers.map((marker, index) => (
                <div
                  key={`deliverable-${index}`}
                  className="absolute top-2 flex flex-col items-center z-20"
                  style={{ left: `${marker.position}%`, transform: 'translateX(-50%)' }}
                >
                  {/* Bandera roja de deliverable */}
                  <div className="flex flex-col items-center">
                    <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[12px] border-t-red-600 drop-shadow-sm"></div>
                    <div className="w-0.5 h-3 bg-red-600"></div>
                  </div>
                  
                  {/* Tooltip del deliverable */}
                  <div className="absolute top-5 bg-white border border-gray-300 rounded-md px-2 py-1 text-xs whitespace-nowrap shadow-lg opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="font-medium text-gray-900">Deliverable</div>
                    <div className="text-gray-600 text-[10px]">{marker.name}</div>
                    <div className="text-gray-500 text-[10px]">{format(marker.date, 'd MMM yyyy', { locale: es })}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Contenido del timeline - con scroll horizontal */}
      <div className="relative bg-gray-100">
        {milestones.map((milestone, milestoneIndex) => {
          const milestoneColor = getMilestoneColor(milestoneIndex);
          
          return (
            <div 
              key={milestone.milestoneId}
              style={{ 
                backgroundColor: milestoneColor.gentle,
                borderLeft: `4px solid ${milestoneColor.main}`
              }}
              className="transition-colors duration-200"
            >
              {/* Header de la fase */}
              <div className="flex border-b border-gray-300">
                <div 
                  className="w-32 text-white p-3 font-bold border-r border-gray-300 flex-shrink-0"
                  style={{ backgroundColor: getMilestoneColor(milestoneIndex).main }}
                >
                  {milestone.milestoneName}
                </div>
                <div 
                  className={`flex-1 relative h-12 ${zoomLevel < 12 ? 'overflow-x-auto' : ''}`}
                  style={{ 
                    width: zoomLevel < 12 ? `${(12 / zoomLevel) * 100}%` : '100%',
                    backgroundColor: milestoneColor.gentle
                  }}
                >
                  <div 
                    className="relative w-full h-full"
                    style={{ 
                      width: zoomLevel < 12 ? `${(12 / zoomLevel) * 100}%` : '100%',
                      minWidth: '100%'
                    }}
                  >
                    {/* Barra del milestone completo */}
                    {milestone.startDate && milestone.endDate && (
                      <div
                        className="absolute top-2 h-8 rounded flex items-center justify-between px-2 shadow-sm"
                        style={{
                          backgroundColor: getMilestoneColor(milestoneIndex).main,
                          ...getTaskBarStyle({
                            taskId: milestone.milestoneId,
                            name: milestone.milestoneName,
                            description: '',
                            team: 'Default',
                            durationDays: 0,
                            dependsOn: [],
                            startDate: milestone.startDate,
                            endDate: milestone.endDate
                          } as Task)
                        }}
                      >
                        <span className="text-white text-xs font-medium">95%</span>
                        <span className="text-white text-xs">
                          {format(parseISO(milestone.startDate!), 'MMM d', { locale: es })} - {format(parseISO(milestone.endDate!), 'MMM d', { locale: es })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tareas de la fase */}
              {milestone.tasks.map((task, taskIndex) => {
                const taskStyle = getTaskBarStyle(task);
                const progress = getProgressPercentage(task);
                const barColor = milestoneColor.main;
                const progressColor = milestoneColor.secondary;

                return (
                  <div 
                    key={task.taskId} 
                    className="flex border-b border-gray-300 min-h-[50px] transition-colors duration-200"
                    style={{
                      backgroundColor: milestoneColor.gentle
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = milestoneColor.gentleHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = milestoneColor.gentle;
                    }}
                  >
                    <div className="w-32 p-2 border-r border-gray-300 bg-white flex items-center flex-shrink-0">
                      <div className="text-sm font-medium text-gray-700 truncate" title={task.name}>
                        {task.name}
                      </div>
                    </div>
                    <div 
                      className={`flex-1 relative flex items-center px-2 ${zoomLevel < 12 ? 'overflow-x-auto' : ''}`}
                      style={{ 
                        width: zoomLevel < 12 ? `${(12 / zoomLevel) * 100}%` : '100%',
                        backgroundColor: milestoneColor.gentle
                      }}
                    >
                      <div 
                        className="relative w-full h-full"
                        style={{ 
                          width: zoomLevel < 12 ? `${(12 / zoomLevel) * 100}%` : '100%',
                          minWidth: '100%'
                        }}
                      >
                        {/* Barra de la tarea */}
                        {task.startDate && task.endDate && (
                          <div
                            className="absolute h-6 rounded-md flex items-center justify-between px-3 shadow-sm border border-white/20 relative overflow-hidden"
                            style={{
                              left: `${taskStyle.left}%`,
                              width: `${taskStyle.width}%`,
                              backgroundColor: barColor,
                              minWidth: '90px',
                              top: '50%',
                              transform: 'translateY(-50%)'
                            }}
                          >
                            {/* Barra de progreso completada */}
                            <div 
                              className="absolute inset-0 rounded-md"
                              style={{
                                backgroundColor: progressColor,
                                width: `${progress}%`,
                                opacity: 0.8
                              }}
                            />
                            
                            {/* Contenido del texto */}
                            <div className="relative z-10 flex items-center justify-between w-full">
                              <span className="text-white text-xs font-medium drop-shadow-sm">
                                {progress}%
                              </span>
                              <span className="text-white text-xs drop-shadow-sm">
                                {format(parseISO(task.startDate), 'd MMM', { locale: es })} - {format(parseISO(task.endDate), 'd MMM', { locale: es })}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="border-t border-gray-300 p-4 bg-white">
        <div className="flex items-center gap-6 flex-wrap">
          {milestones.map((milestone, index) => (
            <div key={milestone.milestoneId} className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded"
                style={{ backgroundColor: getMilestoneColor(index).main }}
              ></div>
              <span className="text-sm text-gray-700">{milestone.milestoneName}</span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-red-600">%</span>
            <span className="text-sm text-red-600">Completion</span>
          </div>
        </div>
      </div>
    </Card>
  );
}