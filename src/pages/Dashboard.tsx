import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { QuickStats } from '@/components/dashboard/QuickStats';
import { QuickActions } from '@/components/dashboard/QuickActions';

const Dashboard = () => {
  const { user, loading } = useAuth();

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
        
        <QuickStats />
        <QuickActions />
        <RecentActivity />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;