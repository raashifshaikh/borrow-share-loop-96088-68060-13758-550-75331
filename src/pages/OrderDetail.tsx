import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Check, X, MessageSquare, Package, CreditCard, QrCode, Scan, Clock, CheckCircle2 } from 'lucide-react';
import { QRCodeDisplay } from '@/components/qr/QRCodeDisplay';
import { QRScanner } from '@/components/qr/QRScanner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const OrderDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [counterOffer, setCounterOffer] = useState('');
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [scanType, setScanType] = useState<'delivery' | 'return' | 'service_start' | 'service_end'>('delivery');
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'cod'>('stripe'); // Added COD support
  const [isVerifying, setIsVerifying] = useState(false);

  // Fetch order details
  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
      if (error) throw error;
      if (!data) throw new Error('Order not found');

      const [listingData, buyerData, sellerData] = await Promise.all([
        data.listing_id
          ? supabase.from('listings').select('*, seller_profile:profiles(name, avatar_url)').eq('id', data.listing_id).single()
          : Promise.resolve({ data: null, error: null }),
        data.buyer_id
          ? supabase.from('profiles').select('name, avatar_url').eq('id', data.buyer_id).single()
          : Promise.resolve({ data: null, error: null }),
        data.seller_id
          ? supabase.from('profiles').select('name, avatar_url').eq('id', data.seller_id).single()
          : Promise.resolve({ data: null, error: null })
      ]);

      return {
        ...data,
        listings: listingData.data,
        buyer_profile: buyerData.data,
        seller_profile: sellerData.data
      };
    },
    enabled: !!id
  });

  // Fetch negotiations
  const { data: negotiations } = useQuery({
    queryKey: ['negotiations', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_negotiations')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const negotiationsWithProfiles = await Promise.all(
        (data || []).map(async (neg) => {
          const { data: profileData } = await supabase.from('profiles').select('name').eq('id', neg.from_user_id).single();
          return { ...neg, from_profile: profileData };
        })
      );
      return negotiationsWithProfiles;
    },
    enabled: !!id
  });

  // Mutations
  const updateOrderMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase.from('orders').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  });

  const sendNegotiationMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('order_negotiations').insert([{ ...data, order_id: id, from_user_id: user?.id }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['negotiations', id] });
      setCounterOffer('');
    }
  });

  // Order actions
  const handleAcceptOrder = async () => {
    await updateOrderMutation.mutateAsync({ status: 'accepted' });
    toast({ title: 'Order accepted!', description: 'The buyer will be notified and can proceed to payment' });
  };

  const handleDeclineOrder = async () => {
    await updateOrderMutation.mutateAsync({ status: 'cancelled' });
    toast({ title: 'Order declined' });
  };

  const handleAcceptOffer = async (amount: number) => {
    await updateOrderMutation.mutateAsync({ status: 'accepted', final_amount: amount * (order?.quantity || 1) });
    await sendNegotiationMutation.mutateAsync({ action: 'accept', amount });
    toast({ title: 'Offer accepted!', description: 'Proceeding to payment' });
  };

  const handleCounterOffer = async () => {
    const amount = parseFloat(counterOffer);
    if (isNaN(amount) || amount <= 0) return;

    await sendNegotiationMutation.mutateAsync({
      action: 'counter',
      amount,
      message: `Counter offer: $${amount} per unit`
    });
    toast({ title: 'Counter offer sent!' });
  };

  // Stripe Payment
  const initiatePayment = async () => {
    setIsPaymentLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', { body: { order_id: id } });
      if (error) throw error;

      if (data?.url) {
        const paymentWindow = window.open(data.url, '_blank');
        if (!paymentWindow || paymentWindow.closed || typeof paymentWindow.closed === 'undefined') {
          toast({ title: 'Popup blocked', description: 'Please allow popups or we will redirect you', variant: 'destructive' });
          setTimeout(() => { window.location.href = data.url; }, 2000);
        } else {
          toast({ title: 'Redirecting to payment...', description: 'Complete your payment in the new window' });
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error occurred';
      const isStripeError = errorMessage.includes('stripe') || errorMessage.includes('payment');
      toast({ title: 'Payment initialization failed', description: isStripeError ? 'Payment service error. Please try again or contact support.' : errorMessage, variant: 'destructive' });
      console.error('Payment error:', error);
    } finally {
      setIsPaymentLoading(false);
    }
  };

  // QR Code
  const generateQRCode = async () => {
    try {
      const { data, error } = await supabase.rpc('generate_order_qr_code', { p_order_id: id });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['order', id] });
      setShowQRDialog(true);
      toast({ title: 'QR Code generated!' });
    } catch (error: any) {
      toast({ title: 'Failed to generate QR code', description: error.message, variant: 'destructive' });
    }
  };

  const handleQRScan = async (qrData: any) => {
    try {
      const { data, error } = await supabase.rpc('verify_qr_scan', { p_order_id: id, p_qr_secret: qrData.secret, p_scan_type: scanType });
      if (error || !data) throw new Error('Invalid QR code');
      await queryClient.invalidateQueries({ queryKey: ['order', id] });
      setShowScanDialog(false);
      toast({ title: 'Scan successful!', description: scanType === 'delivery' ? 'Item delivered' : scanType === 'return' ? 'Item returned' : scanType === 'service_start' ? 'Service started' : 'Service completed' });
    } catch (error: any) {
      toast({ title: 'Scan failed', description: error.message, variant: 'destructive' });
    }
  };

  // Payment Verification
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (params.get('payment') === 'success' && sessionId && !isVerifying) {
      setIsVerifying(true);
      supabase.functions.invoke('verify-payment', { body: { session_id: sessionId, order_id: id } })
        .then(async ({ data, error }) => {
          if (error) {
            toast({ title: 'Payment verification failed', description: error.message || 'Please contact support', variant: 'destructive' });
          } else {
            toast({ title: 'Payment successful!', description: 'Your order has been confirmed.', duration: 5000 });
            await queryClient.invalidateQueries({ queryKey: ['order', id] });
            setTimeout(async () => {
              await supabase.rpc('generate_order_qr_code', { p_order_id: id });
              await queryClient.invalidateQueries({ queryKey: ['order', id] });
            }, 1000);
          }
          navigate(`/orders/${id}`, { replace: true });
          setIsVerifying(false);
        })
        .catch((err) => {
          toast({ title: 'Verification error', description: 'An unexpected error occurred', variant: 'destructive' });
          setIsVerifying(false);
        });
    } else if (params.get('payment') === 'cancelled') {
      toast({ title: 'Payment cancelled', description: 'You can try again when ready', variant: 'default' });
      navigate(`/orders/${id}`, { replace: true });
    }
  }, [id, queryClient, navigate, isVerifying, toast]);

  if (isLoading) {
    return <DashboardLayout><div className="animate-pulse space-y-4"><div className="h-32 bg-muted rounded-lg" /></div></DashboardLayout>;
  }

  if (!order) {
    return <DashboardLayout><div className="text-center py-12"><p className="text-muted-foreground">Order not found</p></div></DashboardLayout>;
  }

  const isSeller = user?.id === order.seller_id;
  const isBuyer = user?.id === order.buyer_id;
  const isPaid = order.status === 'paid' || order.status === 'in_progress' || order.status === 'completed' || order.status === 'cod'; // Include COD

  // ... Keep all your existing JSX here for order display, timeline, messages, etc.

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Order info */}
        <Card>
          <CardHeader>
            <CardTitle>Order #{order.id}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Status: <Badge>{order.status}</Badge></p>
            <p>Buyer: {order.buyer_profile?.name}</p>
            <p>Seller: {order.seller_profile?.name}</p>
            <p>Quantity: {order.quantity}</p>
            <p>Total: ${order.final_amount || order.amount}</p>
          </CardContent>
        </Card>

        {/* Payment section for buyer */}
        {isBuyer && order.status === 'accepted' && !isPaid && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Next Step: Payment Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The seller has accepted your order. Complete payment to proceed with delivery.
              </p>

              {/* Payment Method Selector */}
              <div className="flex gap-4 mb-4">
                <Button
                  variant={paymentMethod === 'stripe' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setPaymentMethod('stripe')}
                >
                  <CreditCard className="h-5 w-5 mr-2" />
                  Pay Online
                </Button>

                <Button
                  variant={paymentMethod === 'cod' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setPaymentMethod('cod')}
                >
                  <Package className="h-5 w-5 mr-2" />
                  Cash on Delivery
                </Button>
              </div>

              {/* Stripe Payment */}
              {paymentMethod === 'stripe' && (
                <Button
                  className="w-full min-h-[52px]"
                  size="lg"
                  onClick={initiatePayment}
                  disabled={isPaymentLoading || isVerifying}
                >
                  <CreditCard className="h-6 w-6 mr-2" />
                  {isPaymentLoading
                    ? 'Opening payment page...'
                    : isVerifying
                    ? 'Verifying payment...'
                    : 'Proceed to Payment'}
                </Button>
              )}

              {/* COD Payment */}
              {paymentMethod === 'cod' && (
                <Button
                  className="w-full min-h-[52px]"
                  size="lg"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await updateOrderMutation.mutateAsync({ status: 'cod' });
                      toast({
                        title: 'Order marked as COD',
                        description: 'The seller will prepare your order for cash on delivery.',
                      });
                      await queryClient.invalidateQueries({ queryKey: ['order', id] });
                    } catch (err: any) {
                      toast({
                        title: 'Failed to set COD',
                        description: err.message || 'Something went wrong',
                        variant: 'destructive',
                      });
                    }
                  }}
                >
                  <Package className="h-6 w-6 mr-2" />
                  Confirm Cash on Delivery
                </Button>
              )}

              {(isPaymentLoading || isVerifying) && paymentMethod === 'stripe' && (
                <p className="text-xs text-center text-muted-foreground animate-pulse">
                  {isPaymentLoading
                    ? 'Redirecting to secure payment page...'
                    : 'Confirming your payment with Stripe...'}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Keep your existing negotiations, QR dialogs, scans, etc. */}
      </div>
    </DashboardLayout>
  );
};

export default OrderDetail;
