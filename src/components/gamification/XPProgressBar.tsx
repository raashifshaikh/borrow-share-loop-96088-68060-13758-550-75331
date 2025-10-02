import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';

interface XPProgressBarProps {
  level: number;
  xp: number;
  title: string;
  progress: number;
  nextLevelXP: number;
}

export const XPProgressBar = ({ level, xp, title, progress, nextLevelXP }: XPProgressBarProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-lg px-4 py-1">
            Level {level}
          </Badge>
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
        </div>
        <div className="flex items-center gap-1 text-primary">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-semibold">{xp} XP</span>
        </div>
      </div>
      
      <div className="space-y-1">
        <Progress value={progress} className="h-3" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{Math.round(progress)}% to next level</span>
          <span>{nextLevelXP} XP needed</span>
        </div>
      </div>
    </div>
  );
};
