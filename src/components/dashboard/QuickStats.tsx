import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, ShoppingBag, MessageSquare, DollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const QuickStats = () => {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const [listingsResult, ordersResult, messagesResult] = await Promise.all([
        supabase.from('listings').select('id').eq('seller_id', user.id),
        supabase.from('orders').select('id').or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`),
        supabase.from('chat_messages').select('id').or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
      ]);

      return {
        listings: listingsResult.data?.length || 0,
        orders: ordersResult.data?.length || 0,
        messages: messagesResult.data?.length || 0,
        earnings: 0 // Calculated from completed orders
      };
    },
    enabled: !!user?.id
  });

  const statCards = [
    {
      title: "Active Listings",
      value: stats?.listings || 0,
      icon: Package,
      description: "Items you're sharing"
    },
    {
      title: "Total Orders",
      value: stats?.orders || 0,
      icon: ShoppingBag,
      description: "Borrowed & lent"
    },
    {
      title: "Messages",
      value: stats?.messages || 0,
      icon: MessageSquare,
      description: "Conversations"
    },
    {
      title: "Earnings",
      value: `$${stats?.earnings || 0}`,
      icon: DollarSign,
      description: "This month"
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};