import { Code, Github } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t bg-background mt-8">
      <div className="container mx-auto py-6 px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Code className="w-4 h-4" />
            <span>Timeline Chart Milestones</span>
            <span className="font-semibold">v{__APP_VERSION__}</span>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Built with React & Vite</span>
            <a 
              href="https://github.com/javierhbr/timeline-chart-milestones" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}