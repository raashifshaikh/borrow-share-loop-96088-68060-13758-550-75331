import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const TestFlow = () => {
  const { user } = useAuth();

  // Test database connectivity
  const { data: ordersTest, isLoading: ordersLoading, error: ordersError } = useQuery({
    queryKey: ['test-orders', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, created_at')
        .limit(1);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const { data: listingsTest, isLoading: listingsLoading, error: listingsError } = useQuery({
    queryKey: ['test-listings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('id, title, status')
        .eq('status', 'active')
        .limit(1);
      if (error) throw error;
      return data;
    }
  });

  const { data: profileTest, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['test-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const tests = [
    {
      name: 'Authentication',
      status: user ? 'pass' : 'fail',
      message: user ? `Logged in as ${user.email}` : 'Not logged in',
      action: user ? null : { label: 'Login', link: '/auth' }
    },
    {
      name: 'Profile Data',
      status: profileLoading ? 'loading' : profileError ? 'fail' : profileTest ? 'pass' : 'fail',
      message: profileLoading ? 'Checking...' : profileError ? profileError.message : profileTest ? `Profile found: ${profileTest.name}` : 'No profile',
      action: null
    },
    {
      name: 'Orders Table',
      status: ordersLoading ? 'loading' : ordersError ? 'fail' : ordersTest ? 'pass' : 'fail',
      message: ordersLoading ? 'Checking...' : ordersError ? ordersError.message : ordersTest && ordersTest.length > 0 ? `${ordersTest.length} orders found` : 'No orders yet',
      action: { label: 'View Orders', link: '/orders' }
    },
    {
      name: 'Listings Table',
      status: listingsLoading ? 'loading' : listingsError ? 'fail' : listingsTest ? 'pass' : 'fail',
      message: listingsLoading ? 'Checking...' : listingsError ? listingsError.message : listingsTest && listingsTest.length > 0 ? `${listingsTest.length} active listings` : 'No active listings',
      action: { label: 'Browse Listings', link: '/browse' }
    },
    {
      name: 'Edge Functions',
      status: 'info',
      message: 'create-payment, verify-payment, process-referral configured',
      action: null
    },
    {
      name: 'Notifications System',
      status: 'info',
      message: 'Realtime notifications enabled',
      action: { label: 'View Notifications', link: '/notifications' }
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'fail':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'loading':
        return <Circle className="h-5 w-5 text-muted-foreground animate-pulse" />;
      default:
        return <Circle className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground">System Status</h1>
          <p className="text-muted-foreground">Test end-to-end app functionality</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>System Tests</CardTitle>
            <CardDescription>Verify all components are working correctly</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tests.map((test, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(test.status)}
                    <div>
                      <p className="font-medium">{test.name}</p>
                      <p className="text-sm text-muted-foreground">{test.message}</p>
                    </div>
                  </div>
                  {test.action && (
                    <Link to={test.action.link}>
                      <Button variant="outline" size="sm">
                        {test.action.label}
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Complete User Flow</CardTitle>
            <CardDescription>Follow these steps to test the entire application</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 list-decimal list-inside">
              <li className="text-sm">
                <span className="font-medium">Browse Items:</span> Go to Browse and find an item to rent
              </li>
              <li className="text-sm">
                <span className="font-medium">Place Order:</span> Click "Rent" and submit your order
              </li>
              <li className="text-sm">
                <span className="font-medium">Seller Accepts:</span> As seller, accept the order from Orders page
              </li>
              <li className="text-sm">
                <span className="font-medium">Payment:</span> As buyer, complete payment via Stripe
              </li>
              <li className="text-sm">
                <span className="font-medium">Chat:</span> Communicate via the Messages page
              </li>
              <li className="text-sm">
                <span className="font-medium">QR Codes:</span> Seller generates QR, buyer scans for delivery
              </li>
              <li className="text-sm">
                <span className="font-medium">Return:</span> Buyer generates return QR, seller scans
              </li>
              <li className="text-sm">
                <span className="font-medium">Completion:</span> Order marked complete, XP awarded
              </li>
              <li className="text-sm">
                <span className="font-medium">Gamification:</span> Check your level, badges, and achievements
              </li>
            </ol>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Link to="/browse">
            <Button className="w-full" size="lg">
              Start Testing - Browse Items
            </Button>
          </Link>
          <Link to="/create-listing">
            <Button className="w-full" variant="outline" size="lg">
              Create Test Listing
            </Button>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TestFlow;
