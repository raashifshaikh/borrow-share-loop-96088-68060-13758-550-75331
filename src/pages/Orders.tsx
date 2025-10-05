import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { ShoppingBag, Package, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const Orders = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: borrowedOrders, isLoading: loadingBorrowed, error: errorBorrowed } = useQuery({
    queryKey: ['borrowed-orders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching borrowed orders:', error);
        throw error;
      }

      // Fetch related data separately
      const ordersWithData = await Promise.all(
        (data || []).map(async (order) => {
          const [listingData, sellerData] = await Promise.all([
            supabase.from('listings').select('title, images').eq('id', order.listing_id).single(),
            supabase.from('profiles').select('name').eq('id', order.seller_id).single()
          ]);

          return {
            ...order,
            listings: listingData.data,
            seller_profile: sellerData.data
          };
        })
      );

      return ordersWithData;
    },
    enabled: !!user?.id
  });

  const { data: lentOrders, isLoading: loadingLent, error: errorLent } = useQuery({
    queryKey: ['lent-orders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching lent orders:', error);
        throw error;
      }

      // Fetch related data separately
      const ordersWithData = await Promise.all(
        (data || []).map(async (order) => {
          const [listingData, buyerData] = await Promise.all([
            supabase.from('listings').select('title, images').eq('id', order.listing_id).single(),
            supabase.from('profiles').select('name').eq('id', order.buyer_id).single()
          ]);

          return {
            ...order,
            listings: listingData.data,
            buyer_profile: buyerData.data
          };
        })
      );

      return ordersWithData;
    },
    enabled: !!user?.id
  });

  const { data: serviceOrdersBooked, isLoading: loadingServicesBooked, error: errorServicesBooked } = useQuery({
    queryKey: ['service-orders-booked', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('service_orders')
        .select('*')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching service orders booked:', error);
        throw error;
      }

      // Fetch related data separately
      const ordersWithData = await Promise.all(
        (data || []).map(async (order) => {
          const [serviceData, providerData] = await Promise.all([
            supabase.from('services').select('title, category').eq('id', order.service_id).single(),
            supabase.from('profiles').select('name').eq('id', order.provider_id).single()
          ]);

          return {
            ...order,
            services: serviceData.data,
            provider_profile: providerData.data
          };
        })
      );

      return ordersWithData;
    },
    enabled: !!user?.id
  });

  const { data: serviceOrdersProvided, isLoading: loadingServicesProvided, error: errorServicesProvided } = useQuery({
    queryKey: ['service-orders-provided', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('service_orders')
        .select('*')
        .eq('provider_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching service orders provided:', error);
        throw error;
      }

      // Fetch related data separately
      const ordersWithData = await Promise.all(
        (data || []).map(async (order) => {
          const [serviceData, buyerData] = await Promise.all([
            supabase.from('services').select('title, category').eq('id', order.service_id).single(),
            supabase.from('profiles').select('name').eq('id', order.buyer_id).single()
          ]);

          return {
            ...order,
            services: serviceData.data,
            buyer_profile: buyerData.data
          };
        })
      );

      return ordersWithData;
    },
    enabled: !!user?.id
  });

  // Realtime subscriptions - separate channels for buyer and seller
  useEffect(() => {
    if (!user?.id) return;

    const buyerOrdersChannel = supabase
      .channel('buyer-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `buyer_id=eq.${user.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['borrowed-orders'] });
        }
      )
      .subscribe();

    const sellerOrdersChannel = supabase
      .channel('seller-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `seller_id=eq.${user.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['lent-orders'] });
        }
      )
      .subscribe();

    const buyerServiceOrdersChannel = supabase
      .channel('buyer-service-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_orders',
          filter: `buyer_id=eq.${user.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['service-orders-booked'] });
        }
      )
      .subscribe();

    const providerServiceOrdersChannel = supabase
      .channel('provider-service-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_orders',
          filter: `provider_id=eq.${user.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['service-orders-provided'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(buyerOrdersChannel);
      supabase.removeChannel(sellerOrdersChannel);
      supabase.removeChannel(buyerServiceOrdersChannel);
      supabase.removeChannel(providerServiceOrdersChannel);
    };
  }, [user?.id, queryClient]);

  // Mutations for accept/decline
  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: 'accepted' | 'cancelled' }) => {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.status === 'accepted' ? 'Order Accepted' : 'Order Cancelled',
        description: variables.status === 'accepted' 
          ? 'The buyer can now proceed with payment' 
          : 'The order has been cancelled'
      });
      queryClient.invalidateQueries({ queryKey: ['lent-orders'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update order status',
        variant: 'destructive'
      });
      console.error('Error updating order:', error);
    }
  });

  const updateServiceOrderMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { error } = await supabase
        .from('service_orders')
        .update({ status })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast({
        title: variables.status === 'accepted' ? 'Request Accepted' : 'Request Declined',
        description: variables.status === 'accepted' 
          ? 'The client can now proceed with payment' 
          : 'The request has been declined'
      });
      queryClient.invalidateQueries({ queryKey: ['service-orders-provided'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update request status',
        variant: 'destructive'
      });
      console.error('Error updating service order:', error);
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'default';
      case 'accepted': return 'secondary';
      case 'paid': return 'default';
      case 'in_progress': return 'default';
      case 'completed': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'default';
    }
  };

  const LoadingSkeleton = () => (
    <div className="grid gap-4 md:grid-cols-2">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-10 w-full mt-4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const ErrorAlert = ({ error }: { error: any }) => (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        Failed to load orders. Please try again later.
      </AlertDescription>
    </Alert>
  );

  const OrderCard = ({ order, type }: { order: any, type: 'borrowed' | 'lent' }) => (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {order.listings?.title}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {type === 'borrowed' ? 'From' : 'To'}: {type === 'borrowed' ? order.seller_profile?.name : order.buyer_profile?.name}
            </p>
          </div>
          <Badge variant={getStatusColor(order.status)} className="shrink-0">
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
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <Link to={`/orders/${order.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              View Details
            </Button>
          </Link>
          
          {type === 'lent' && order.status === 'pending' && (
            <>
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={() => updateOrderMutation.mutate({ orderId: order.id, status: 'accepted' })}
                disabled={updateOrderMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Accept</span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={() => updateOrderMutation.mutate({ orderId: order.id, status: 'cancelled' })}
                disabled={updateOrderMutation.isPending}
              >
                <XCircle className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Decline</span>
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const ServiceOrderCard = ({ order, type }: { order: any, type: 'booked' | 'provided' }) => (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {order.services?.title}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {type === 'booked' ? 'Provider' : 'Client'}: {type === 'booked' ? order.provider_profile?.name : order.buyer_profile?.name}
            </p>
          </div>
          <Badge variant={getStatusColor(order.status)} className="shrink-0">
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
        
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <Link to={`/service-orders/${order.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              View Details
            </Button>
          </Link>
          
          {type === 'provided' && order.status === 'pending' && (
            <>
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={() => updateServiceOrderMutation.mutate({ orderId: order.id, status: 'accepted' })}
                disabled={updateServiceOrderMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Accept</span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={() => updateServiceOrderMutation.mutate({ orderId: order.id, status: 'cancelled' })}
                disabled={updateServiceOrderMutation.isPending}
              >
                <XCircle className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Decline</span>
              </Button>
            </>
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
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="borrowed" className="text-xs sm:text-sm px-2">
              <ShoppingBag className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Borrowed</span>
              <span className="sm:hidden">Rent</span> ({borrowedOrders?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="lent" className="text-xs sm:text-sm px-2">
              <Package className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Lent</span>
              <span className="sm:hidden">Lend</span> ({lentOrders?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="services-booked" className="text-xs sm:text-sm px-2">
              <ShoppingBag className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Services</span>
              <span className="sm:hidden">Svc</span> ({serviceOrdersBooked?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="services-provided" className="text-xs sm:text-sm px-2">
              <Package className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Provided</span>
              <span className="sm:hidden">Prov</span> ({serviceOrdersProvided?.length || 0})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="borrowed" className="space-y-4">
            {loadingBorrowed ? (
              <LoadingSkeleton />
            ) : errorBorrowed ? (
              <ErrorAlert error={errorBorrowed} />
            ) : borrowedOrders?.length === 0 ? (
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
            {loadingLent ? (
              <LoadingSkeleton />
            ) : errorLent ? (
              <ErrorAlert error={errorLent} />
            ) : lentOrders?.length === 0 ? (
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
            {loadingServicesBooked ? (
              <LoadingSkeleton />
            ) : errorServicesBooked ? (
              <ErrorAlert error={errorServicesBooked} />
            ) : serviceOrdersBooked?.length === 0 ? (
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
                  <ServiceOrderCard key={order.id} order={order} type="booked" />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="services-provided" className="space-y-4">
            {loadingServicesProvided ? (
              <LoadingSkeleton />
            ) : errorServicesProvided ? (
              <ErrorAlert error={errorServicesProvided} />
            ) : serviceOrdersProvided?.length === 0 ? (
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
                  <ServiceOrderCard key={order.id} order={order} type="provided" />
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
