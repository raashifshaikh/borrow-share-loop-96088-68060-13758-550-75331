import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { QuickStats } from '@/components/dashboard/QuickStats';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { useGamification } from '@/hooks/useGamification';
import { XPProgressBar } from '@/components/gamification/XPProgressBar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { user, loading } = useAuth();
  const { userLevel, progressToNextLevel, nextLevelXP } = useGamification();

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening.</p>
        </div>

        {userLevel && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Your Progress</h3>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/gamification">View All</Link>
              </Button>
            </div>
            <XPProgressBar
              level={userLevel.level}
              xp={userLevel.xp}
              title={userLevel.title}
              progress={progressToNextLevel}
              nextLevelXP={nextLevelXP}
            />
          </Card>
        )}
        
        <QuickStats />
        <QuickActions />
        <RecentActivity />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
