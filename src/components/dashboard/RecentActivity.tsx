import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

export const RecentActivity = () => {
  const { user } = useAuth();

  const { data: recentOrders } = useQuery({
    queryKey: ['recent-orders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data } = await supabase
        .from('orders')
        .select(`
          *,
          listings (title, images)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(5);

      return data || [];
    },
    enabled: !!user?.id
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'default';
      case 'accepted': return 'secondary';
      case 'completed': return 'default';
      case 'cancelled': return 'destructive';
      default: return 'default';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentOrders?.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No recent activity. Start by creating a listing or browsing items!
            </p>
          ) : (
            recentOrders?.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium text-foreground">
                    {order.listings?.title}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {order.buyer_id === user?.id ? 'You borrowed' : 'You lent'} • ${order.final_amount}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(order.created_at))} ago
                  </p>
                </div>
                <Badge variant={getStatusColor(order.status)}>
                  {order.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};