import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, MessageCircle, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

const ServiceOrderDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['service-order', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_orders')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      // Fetch related data separately
      const [serviceData, buyerData, providerData] = await Promise.all([
        supabase.from('services').select('id, title, description, category, price, duration_hours, images, provider_id').eq('id', data.service_id).single(),
        supabase.from('profiles').select('id, name, avatar_url, email').eq('id', data.buyer_id).single(),
        supabase.from('profiles').select('id, name, avatar_url, email').eq('id', data.provider_id).single()
      ]);

      return {
        ...data,
        services: serviceData.data,
        buyer_profile: buyerData.data,
        provider_profile: providerData.data
      };
    },
    enabled: !!id
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from('service_orders')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, status) => {
      toast({
        title: 'Status Updated',
        description: `Service request ${status}`
      });
      queryClient.invalidateQueries({ queryKey: ['service-order', id] });
      queryClient.invalidateQueries({ queryKey: ['service-orders-booked'] });
      queryClient.invalidateQueries({ queryKey: ['service-orders-provided'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive'
      });
    }
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Service request not found or you don't have permission to view it.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  const isProvider = user?.id === order.provider_id;
  const isBuyer = user?.id === order.buyer_id;
  const canAcceptDecline = isProvider && order.status === 'pending';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'default';
      case 'accepted': return 'secondary';
      case 'completed': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'default';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Service Request Details</h1>
            <p className="text-muted-foreground">#{order.id.slice(0, 8)}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{order.services?.title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {order.services?.category}
                    </p>
                  </div>
                  <Badge variant={getStatusColor(order.status)}>
                    {order.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Description</h3>
                  <p className="text-muted-foreground">{order.services?.description}</p>
                </div>

                {order.notes && (
                  <div>
                    <h3 className="font-medium mb-2">Client Notes</h3>
                    <p className="text-muted-foreground">{order.notes}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-medium">{order.services?.duration_hours} hours</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="font-medium">${order.final_amount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {canAcceptDecline && (
              <Card>
                <CardHeader>
                  <CardTitle>Action Required</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Review this service request and decide whether to accept or decline it.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      className="flex-1"
                      onClick={() => updateStatusMutation.mutate('accepted')}
                      disabled={updateStatusMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Accept Request
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => updateStatusMutation.mutate('cancelled')}
                      disabled={updateStatusMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Decline Request
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {isProvider ? 'Client' : 'Provider'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    {(isProvider ? order.buyer_profile : order.provider_profile)?.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {(isProvider ? order.buyer_profile : order.provider_profile)?.name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {(isProvider ? order.buyer_profile : order.provider_profile)?.email}
                    </p>
                  </div>
                </div>
                <Link
                  to={`/messages?user=${isProvider ? order.buyer_id : order.provider_id}&serviceOrder=${order.id}`}
                  className="block"
                >
                  <Button variant="outline" className="w-full">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Send Message
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Request Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    <div className="flex-1">
                      <p className="font-medium">Request Placed</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(order.created_at))} ago
                      </p>
                    </div>
                  </div>

                  {order.status !== 'pending' && (
                    <div className="flex gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        order.status === 'accepted' ? 'bg-green-500' : 'bg-destructive'
                      }`} />
                      <div className="flex-1">
                        <p className="font-medium">
                          {order.status === 'accepted' ? 'Accepted' : 'Cancelled'}
                        </p>
                        <p className="text-sm text-muted-foreground">Status updated</p>
                      </div>
                    </div>
                  )}

                  {order.status === 'completed' && (
                    <div className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                      <div className="flex-1">
                        <p className="font-medium">Completed</p>
                        <p className="text-sm text-muted-foreground">Service completed</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ServiceOrderDetail;
