import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { ShoppingBag, Package } from 'lucide-react';
import { Link } from 'react-router-dom';

const Orders = () => {
  const { user } = useAuth();

  const { data: borrowedOrders } = useQuery({
    queryKey: ['borrowed-orders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          listings (title, images, seller_id),
          seller_profile:profiles!fk_orders_seller (name)
        `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  const { data: lentOrders } = useQuery({
    queryKey: ['lent-orders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          listings (title, images),
          buyer_profile:profiles!fk_orders_buyer (name)
        `)
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  // Service orders queries
  const { data: serviceOrdersBooked } = useQuery({
    queryKey: ['service-orders-booked', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('service_orders')
        .select(`
          *,
          services (title, category),
          provider_profile:profiles!service_orders_provider_id_fkey (name)
        `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  const { data: serviceOrdersProvided } = useQuery({
    queryKey: ['service-orders-provided', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('service_orders')
        .select(`
          *,
          services (title, category),
          buyer_profile:profiles!service_orders_buyer_id_fkey (name)
        `)
        .eq('provider_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'default';
      case 'accepted': return 'secondary';
      case 'completed': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'default';
    }
  };

  const OrderCard = ({ order, type }: { order: any, type: 'borrowed' | 'lent' }) => (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">
              {order.listings?.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {type === 'borrowed' ? 'Borrowed from' : 'Lent to'}: {type === 'borrowed' ? order.seller_profile?.name : order.buyer_profile?.name}
            </p>
          </div>
          <Badge variant={getStatusColor(order.status)}>
            {order.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Amount:</span>
            <span className="font-medium">${order.final_amount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Quantity:</span>
            <span>{order.quantity}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Ordered:</span>
            <span>{formatDistanceToNow(new Date(order.created_at))} ago</span>
          </div>
          {order.notes && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">Notes:</p>
              <p className="text-sm">{order.notes}</p>
            </div>
          )}
        </div>
        
        <div className="flex gap-2 mt-4">
          <Link to={`/orders/${order.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              View Details
            </Button>
          </Link>
          {order.status === 'accepted' && (
            <Link to={`/messages?order=${order.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                Message
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Orders</h1>
          <p className="text-muted-foreground">Track your borrowing and lending activity</p>
        </div>

        <Tabs defaultValue="borrowed" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="borrowed">
              <ShoppingBag className="h-4 w-4 mr-2" />
              Borrowed ({borrowedOrders?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="lent">
              <Package className="h-4 w-4 mr-2" />
              Lent ({lentOrders?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="services-booked">
              Services Booked ({serviceOrdersBooked?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="services-provided">
              Services Provided ({serviceOrdersProvided?.length || 0})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="borrowed" className="space-y-4">
            {borrowedOrders?.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No borrowed items</h3>
                  <p className="text-muted-foreground mb-4">
                    Start browsing to find items you need
                  </p>
                  <Link to="/browse">
                    <Button>Browse Items</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {borrowedOrders?.map((order) => (
                  <OrderCard key={order.id} order={order} type="borrowed" />
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="lent" className="space-y-4">
            {lentOrders?.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No lent items</h3>
                  <p className="text-muted-foreground mb-4">
                    Create listings to start sharing your items
                  </p>
                  <Link to="/create-listing">
                    <Button>Create Listing</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {lentOrders?.map((order) => (
                  <OrderCard key={order.id} order={order} type="lent" />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="services-booked" className="space-y-4">
            {serviceOrdersBooked?.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No services booked</h3>
                  <p className="text-muted-foreground mb-4">
                    Browse services to get started
                  </p>
                  <Link to="/browse">
                    <Button>Browse Services</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {serviceOrdersBooked?.map((order: any) => (
                  <Card key={order.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">
                            {order.services?.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Provider: {order.provider_profile?.name}
                          </p>
                        </div>
                        <Badge variant={order.status === 'accepted' ? 'default' : 'outline'}>
                          {order.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Amount:</span>
                          <span className="font-medium">${order.final_amount}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Booked:</span>
                          <span>{formatDistanceToNow(new Date(order.created_at))} ago</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full mt-4">
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="services-provided" className="space-y-4">
            {serviceOrdersProvided?.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No services provided</h3>
                  <p className="text-muted-foreground mb-4">
                    Create service listings to get started
                  </p>
                  <Link to="/create-listing">
                    <Button>Create Service</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {serviceOrdersProvided?.map((order: any) => (
                  <Card key={order.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">
                            {order.services?.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Client: {order.buyer_profile?.name}
                          </p>
                        </div>
                        <Badge variant={order.status === 'accepted' ? 'default' : 'outline'}>
                          {order.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Amount:</span>
                          <span className="font-medium">${order.final_amount}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Received:</span>
                          <span>{formatDistanceToNow(new Date(order.created_at))} ago</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full mt-4">
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Orders;