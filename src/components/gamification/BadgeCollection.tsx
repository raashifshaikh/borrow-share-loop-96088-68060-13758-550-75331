import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LucideIcon, Trophy, Star, Shield, Users, UserCheck, Award, Heart, Crown, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap: Record<string, LucideIcon> = {
  trophy: Trophy,
  star: Star,
  shield: Shield,
  users: Users,
  'user-check': UserCheck,
  award: Award,
  heart: Heart,
  crown: Crown,
  zap: Zap,
};

interface BadgeItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  earned?: boolean;
  earned_at?: string;
}

interface BadgeCollectionProps {
  badges: BadgeItem[];
  earnedBadgeIds: string[];
}

const rarityColors = {
  common: 'border-muted bg-muted/20',
  rare: 'border-primary/50 bg-primary/5',
  epic: 'border-purple-500/50 bg-purple-500/5',
  legendary: 'border-amber-500/50 bg-amber-500/5',
};

export const BadgeCollection = ({ badges, earnedBadgeIds }: BadgeCollectionProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {badges.map((badge) => {
        const Icon = iconMap[badge.icon] || Trophy;
        const isEarned = earnedBadgeIds.includes(badge.id);
        
        return (
          <Card
            key={badge.id}
            className={cn(
              'p-4 border-2 transition-all duration-200',
              isEarned 
                ? rarityColors[badge.rarity as keyof typeof rarityColors] || rarityColors.common
                : 'border-border bg-background opacity-50 grayscale'
            )}
          >
            <div className="flex flex-col items-center text-center space-y-2">
              <div className={cn(
                'p-3 rounded-full',
                isEarned ? 'bg-primary/10' : 'bg-muted'
              )}>
                <Icon className={cn(
                  'h-6 w-6',
                  isEarned ? 'text-primary' : 'text-muted-foreground'
                )} />
              </div>
              <div>
                <h4 className="font-semibold text-sm">{badge.name}</h4>
                <p className="text-xs text-muted-foreground mt-1">{badge.description}</p>
              </div>
              {isEarned && (
                <Badge variant="secondary" className="text-xs">
                  Earned
                </Badge>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
};
