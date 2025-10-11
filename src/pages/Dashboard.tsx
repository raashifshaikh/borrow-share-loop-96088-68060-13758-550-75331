import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, TrendingUp, DollarSign, Zap, Eye, Heart, Clock, Users, Package } from 'lucide-react';
import { Link } from 'react-router-dom';

const WarRoomDashboard = () => {
  const { user, loading } = useAuth();

  // Live Revenue Data
  const { data: revenue } = useQuery({
    queryKey: ['revenue-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_revenue_dashboard')
        .select('*')
        .single();
      
      if (error) {
        console.error('Error fetching revenue:', error);
        return {
          today_revenue: 0,
          today_orders: 0,
          total_revenue: 0,
          total_orders: 0,
          pending_orders: 0,
          completed_orders: 0,
          avg_order_value: 0
        };
      }
      return data;
    }
  });

  // Critical Alerts
  const { data: alerts } = useQuery({
    queryKey: ['critical-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_critical_alerts')
        .select('*')
        .order('alert_time', { ascending: false });
      
      if (error) {
        console.error('Error fetching alerts:', error);
        return [];
      }
      return data;
    }
  });

  // Leverage Opportunities
  const { data: opportunities } = useQuery({
    queryKey: ['leverage-opportunities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_leverage_opportunities')
        .select('*');
      
      if (error) {
        console.error('Error fetching opportunities:', error);
        return [];
      }
      return data;
    }
  });

  // Active Listings Count
  const { data: listingsCount } = useQuery({
    queryKey: ['active-listings-count'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('id', { count: 'exact' })
        .eq('seller_id', user?.id)
        .eq('status', 'active');
      
      return data?.length || 0;
    }
  });

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const leverageScore = opportunities?.filter(o => o.opportunity_type !== 'HEALTHY').length || 0;
  const criticalAlertsCount = alerts?.length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* BATTLE STATION HEADER */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">War Room</h1>
          <p className="text-muted-foreground">Real-time business intelligence. No fluff.</p>
        </div>

        {/* KEY METRICS - BATTLE STATION */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* LIVE REVENUE */}
          <Card className="p-6 border-l-4 border-l-green-500">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <h3 className="text-sm font-medium text-muted-foreground">TODAY'S REVENUE</h3>
                </div>
                <div className="text-2xl font-bold">${revenue?.today_revenue || 0}</div>
                <div className="text-sm text-muted-foreground">{revenue?.today_orders} orders</div>
              </div>
              <Button variant="outline" className="bg-green-50 text-green-700 border-green-200">
                +{revenue?.today_orders || 0}
              </Button>
            </div>
          </Card>

          {/* URGENT ACTIONS */}
          <Card className="p-6 border-l-4 border-l-red-500">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <h3 className="text-sm font-medium text-muted-foreground">URGENT ACTIONS</h3>
                </div>
                <div className="text-2xl font-bold">{criticalAlertsCount}</div>
                <div className="text-sm text-muted-foreground">Require attention</div>
              </div>
              {criticalAlertsCount > 0 && (
                <Button variant="outline" className="bg-red-50 text-red-700 border-red-200 animate-pulse">
                  CRITICAL
                </Button>
              )}
            </div>
          </Card>

          {/* LEVERAGE SCORE */}
          <Card className="p-6 border-l-4 border-l-blue-500">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-medium text-muted-foreground">LEVERAGE POINTS</h3>
                </div>
                <div className="text-2xl font-bold">{leverageScore}</div>
                <div className="text-sm text-muted-foreground">High-impact</div>
              </div>
              {leverageScore > 0 && (
                <Button variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  ACTIVE
                </Button>
              )}
            </div>
          </Card>

          {/* ACTIVE LISTINGS */}
          <Card className="p-6 border-l-4 border-l-purple-500">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-purple-600" />
                  <h3 className="text-sm font-medium text-muted-foreground">ACTIVE LISTINGS</h3>
                </div>
                <div className="text-2xl font-bold">{listingsCount || 0}</div>
                <div className="text-sm text-muted-foreground">Live items</div>
              </div>
              <Button variant="outline" className="bg-purple-50 text-purple-700 border-purple-200" asChild>
                <Link to="/create-listing">+ Add</Link>
              </Button>
            </div>
          </Card>
        </div>

        {/* WAR ROOM - CRITICAL ALERTS */}
        {criticalAlertsCount > 0 && (
          <Card className="p-6 border-l-4 border-l-red-500">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                BATTLE STATIONS - {criticalAlertsCount} URGENT ITEMS
              </h3>
              <Button variant="destructive" className="animate-pulse">
                CRITICAL
              </Button>
            </div>
            <div className="space-y-3">
              {alerts?.map(alert => (
                <CriticalAlertItem key={`${alert.alert_type}-${alert.entity_id}`} alert={alert} />
              ))}
            </div>
          </Card>
        )}

        {/* LEVERAGE OPPORTUNITIES */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              LEVERAGE OPPORTUNITIES - {leverageScore} ACTIONS
            </h3>
            <Button variant="outline">
              ${revenue?.total_revenue?.toFixed(2) || 0} total
            </Button>
          </div>
          
          {leverageScore > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {opportunities?.filter(o => o.opportunity_type !== 'HEALTHY').map(opp => (
                <LeverageOpportunity key={opp.id} opportunity={opp} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>All listings performing well. Consider expanding your inventory.</p>
              <Button className="mt-4" asChild>
                <Link to="/create-listing">Create New Listing</Link>
              </Button>
            </div>
          )}
        </Card>

        {/* PERFORMANCE OVERVIEW */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Performance Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{revenue?.total_orders || 0}</div>
              <div className="text-sm text-muted-foreground">Total Orders</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{revenue?.completed_orders || 0}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{revenue?.pending_orders || 0}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600">${revenue?.total_revenue?.toFixed(2) || 0}</div>
              <div className="text-sm text-muted-foreground">Total Revenue</div>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

// Critical Alert Component
const CriticalAlertItem = ({ alert }) => {
  const getActionConfig = (type) => {
    const config = {
      expiring_listing: { label: 'RENEW NOW', variant: 'default', icon: Clock },
      stalled_negotiation: { label: 'FOLLOW UP', variant: 'secondary', icon: Zap },
      negative_review_risk: { label: 'REQUEST REVIEW', variant: 'outline', icon: AlertTriangle },
      high_demand_no_listings: { label: 'ADD LISTING', variant: 'default', icon: TrendingUp }
    };
    return config[type] || { label: 'VIEW', variant: 'outline', icon: Eye };
  };

  const actionConfig = getActionConfig(alert.alert_type);
  const ActionIcon = actionConfig.icon;

  return (
    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
      <div className="flex-1">
        <div className="font-medium text-sm text-red-800">{alert.message}</div>
        <div className="text-xs text-red-600 mt-1">{alert.title}</div>
      </div>
      <Button variant={actionConfig.variant} size="sm" asChild>
        <Link to={alert.action_url}>
          <ActionIcon className="h-3 w-3 mr-1" />
          {actionConfig.label}
        </Link>
      </Button>
    </div>
  );
};

// Leverage Opportunity Component
const LeverageOpportunity = ({ opportunity }) => {
  const getConfig = (type) => {
    const config = {
      HIGH_VIEWS_NO_FAVES: { color: 'orange', icon: Eye, action: 'Adjust Price' },
      FAVORITED_NO_BOOKINGS: { color: 'blue', icon: Heart, action: 'Send Offers' },
      OVERPRICED: { color: 'red', icon: TrendingUp, action: 'Reduce Price' },
      LOW_VISIBILITY: { color: 'yellow', icon: Eye, action: 'Improve Listing' }
    };
    return config[type] || { color: 'gray', icon: Eye, action: 'View' };
  };

  const config = getConfig(opportunity.opportunity_type);
  const OpportunityIcon = config.icon;

  const getActionUrl = (type, id) => {
    const urls = {
      HIGH_VIEWS_NO_FAVES: `/listings/${id}/edit`,
      FAVORITED_NO_BOOKINGS: `/listings/${id}`,
      OVERPRICED: `/listings/${id}/edit`,
      LOW_VISIBILITY: `/listings/${id}/edit`
    };
    return urls[type] || `/listings/${id}`;
  };

  return (
    <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
      <div className="flex items-start justify-between mb-2">
        <div className="font-medium text-sm flex items-center gap-2">
          <OpportunityIcon className={`h-4 w-4 text-${config.color}-600`} />
          {opportunity.title}
        </div>
        <Badge variant="outline" className={`bg-${config.color}-50 text-${config.color}-700`}>
          {opportunity.views_count} views
        </Badge>
      </div>
      
      <div className="text-xs text-muted-foreground mb-3">
        {opportunity.insight_message}
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex gap-2 text-xs">
          <Badge variant="secondary">{opportunity.favorites_count} favorites</Badge>
          <Badge variant="secondary">${opportunity.price}</Badge>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to={getActionUrl(opportunity.opportunity_type, opportunity.id)}>
            {config.action}
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default WarRoomDashboard;
