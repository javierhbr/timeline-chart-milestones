# Timeline Chart Milestones

A modern, interactive Gantt chart application for project timeline visualization with hierarchical tasks and milestones. Built with React, TypeScript, and Vite.

## 🚀 Live Demo

**[View Live Application](https://javierhbr.github.io/timeline-chart-milestones/)**

## 📋 Features

### Core Functionality

- **Interactive Gantt Chart**: Drag-and-drop timeline visualization
- **Hierarchical Tasks**: Organize tasks in parent-child relationships
- **Milestone Tracking**: Visual milestone markers with team assignments
- **Interactive Timeline**: Drag-and-drop interface with zoom controls
- **Team Management**: Color-coded team assignments and filtering

### Data Management

- **CSV Import/Export**: Load project data from CSV files with automatic field mapping
- **JSON Import/Export**: Full project data import/export in JSON format
- **Real-time Editing**: Edit task details with instant visual updates
- **Project Statistics**: View completion rates and team distribution

### User Experience

- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Modern UI**: Clean interface built with Radix UI components
- **Smooth Interactions**: Optimized performance with React best practices
- **Accessibility**: Full keyboard navigation and screen reader support

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Components**: Radix UI + Tailwind CSS
- **Date Handling**: Native JavaScript Date API
- **Icons**: Lucide React
- **Deployment**: GitHub Pages

## 🏃‍♂️ Quick Start

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/javierhbr/timeline-chart-milestones.git
   cd timeline-chart-milestones
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start development server**

   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

## 📁 Project Structure

```
src/
├── components/
│   ├── GanttTimeline.tsx       # Interactive timeline component
│   ├── TaskEditModal.tsx       # Task editing interface
│   ├── JsonImportExport.tsx    # Data import/export functionality
│   └── ui/                     # Reusable UI components
├── utils/
│   └── dateUtils.ts           # Date manipulation utilities
├── styles/
│   └── globals.css            # Global styles
└── App.tsx                    # Main application component & chart container
```

## 🎯 Usage Guide

### Creating Tasks

1. Click "Add Task" to create a new task
2. Fill in task details (name, dates, team, description)
3. Set parent task for hierarchical organization
4. Save to add to timeline

### Importing Data

1. Click "Import/Export" button
2. Choose CSV or JSON file
3. Map CSV columns to task fields (if using CSV)
4. Review and confirm import

### Exporting Data

1. Click "Import/Export" button
2. Choose export format (CSV or JSON)
3. Download generated file

### Timeline Interaction

- **Drag Tasks**: Click and drag to move task dates
- **Resize Tasks**: Drag task edges to adjust duration
- **Zoom**: Use zoom controls to adjust timeline granularity
- **Filter**: Toggle team visibility in the legend

## 📊 Data Format

### CSV Format

Required columns:

- `Task Name`: Task title
- `Start Date`: Start date (YYYY-MM-DD format)
- `End Date`: End date (YYYY-MM-DD format)
- `Team`: Team assignment
- `Parent Task`: Parent task name (optional)
- `Description`: Task description (optional)

### JSON Format

```json
{
  "tasks": [
    {
      "id": "unique-id",
      "name": "Task Name",
      "startDate": "2024-01-01",
      "endDate": "2024-01-15",
      "team": "Development",
      "parentId": "parent-task-id",
      "description": "Task description"
    }
  ]
}
```

## 🚀 Deployment

The application is automatically deployed to GitHub Pages using GitHub Actions.

### Manual Deployment

```bash
npm run build    # Build for production
npm run deploy   # Deploy to GitHub Pages
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Original design inspiration from [Figma Community](https://www.figma.com/design/Pg1vs3fwQX5IgqQKLLzDBe/Gantt-Chart-Jer%C3%A1rquico-con-Milestones)
- Built with [Radix UI](https://www.radix-ui.com/) components
- Styled with [Tailwind CSS](https://tailwindcss.com/)

---

**[⬆️ Back to Top](#timeline-chart-milestones)**
