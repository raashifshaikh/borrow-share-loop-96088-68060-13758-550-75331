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

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();
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
          const { data: profileData } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', neg.from_user_id)
            .single();
          return { ...neg, from_profile: profileData };
        })
      );

      return negotiationsWithProfiles;
    },
    enabled: !!id
  });

  const updateOrderMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  });

  const sendNegotiationMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from('order_negotiations')
        .insert([{ ...data, order_id: id, from_user_id: user?.id }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['negotiations', id] });
      setCounterOffer('');
    }
  });

  const handleAcceptOrder = async () => {
    await updateOrderMutation.mutateAsync({ status: 'accepted' });
    toast({ title: 'Order accepted!', description: 'The buyer will be notified and can proceed to payment' });
  };

  const handleDeclineOrder = async () => {
    await updateOrderMutation.mutateAsync({ status: 'cancelled' });
    toast({ title: 'Order declined' });
  };

  const handleAcceptOffer = async (amount: number) => {
    await updateOrderMutation.mutateAsync({
      status: 'accepted',
      final_amount: amount * (order?.quantity || 1)
    });
    await sendNegotiationMutation.mutateAsync({
      action: 'accept',
      amount
    });
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

  const initiatePayment = async () => {
    setIsPaymentLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { order_id: id }
      });
      if (error) throw error;

      if (data?.url) {
        const paymentWindow = window.open(data.url, '_blank');
        if (!paymentWindow || paymentWindow.closed || typeof paymentWindow.closed === 'undefined') {
          toast({ title: 'Popup blocked', description: 'Please allow popups', variant: 'destructive' });
          setTimeout(() => { window.location.href = data.url; }, 2000);
        } else {
          toast({ title: 'Redirecting to payment...', description: 'Complete your payment in the new window' });
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      toast({ title: 'Payment failed', description: errorMessage, variant: 'destructive' });
      console.error('Payment error:', error);
    } finally {
      setIsPaymentLoading(false);
    }
  };

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
      const { data, error } = await supabase.rpc('verify_qr_scan', {
        p_order_id: id,
        p_qr_secret: qrData.secret,
        p_scan_type: scanType
      });
      if (error || !data) throw new Error('Invalid QR code');
      await queryClient.invalidateQueries({ queryKey: ['order', id] });
      setShowScanDialog(false);
      toast({
        title: 'Scan successful!',
        description: scanType === 'delivery' ? 'Item delivered' : scanType === 'return' ? 'Item returned' :
                     scanType === 'service_start' ? 'Service started' : 'Service completed'
      });
    } catch (error: any) {
      toast({ title: 'Scan failed', description: error.message, variant: 'destructive' });
    }
  };

  const [isVerifying, setIsVerifying] = useState(false);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');

    if (params.get('payment') === 'success' && sessionId && !isVerifying) {
      setIsVerifying(true);
      supabase.functions.invoke('verify-payment', { body: { session_id: sessionId, order_id: id } })
        .then(async ({ data, error }) => {
          if (error) toast({ title: 'Payment verification failed', description: error.message, variant: 'destructive' });
          else {
            toast({ title: 'Payment successful!', description: 'Your order has been confirmed.', duration: 5000 });
            await queryClient.invalidateQueries({ queryKey: ['order', id] });
            setTimeout(async () => {
              const { error: qrError } = await supabase.rpc('generate_order_qr_code', { p_order_id: id });
              if (!qrError) await queryClient.invalidateQueries({ queryKey: ['order', id] });
            }, 1000);
          }
          navigate(`/orders/${id}`, { replace: true });
          setIsVerifying(false);
        }).catch((err) => {
          toast({ title: 'Verification error', description: 'Unexpected error', variant: 'destructive' });
          setIsVerifying(false);
        });
    } else if (params.get('payment') === 'cancelled') {
      toast({ title: 'Payment cancelled', description: 'You can try again', variant: 'default' });
      navigate(`/orders/${id}`, { replace: true });
    }
  }, [id, toast, queryClient, navigate, isVerifying]);

  if (isLoading) return <DashboardLayout><div className="animate-pulse space-y-4"><div className="h-32 bg-muted rounded-lg" /></div></DashboardLayout>;
  if (!order) return <DashboardLayout><div className="text-center py-12"><p className="text-muted-foreground">Order not found</p></div></DashboardLayout>;

  const isSeller = user?.id === order.seller_id;
  const isBuyer = user?.id === order.buyer_id;
  const isPaid = order.status === 'paid' || order.status === 'in_progress' || order.status === 'completed';
  const canChat = order.status === 'accepted' || isPaid;
  const canGenerateQR = isPaid && !order.qr_code_data;
  const canShowQR = isPaid && order.qr_code_data && isSeller && !order.delivery_scanned_at;
  const canScanDelivery = isPaid && order.qr_code_data && isBuyer && !order.delivery_scanned_at;
  const canShowReturnQR = order.delivery_scanned_at && isBuyer && !order.return_scanned_at;
  const canScanReturn = order.delivery_scanned_at && isSeller && !order.return_scanned_at;

  const getOrderStage = () => {
    if (order.return_scanned_at) return 5;
    if (order.delivery_scanned_at) return 4;
    if (isPaid) return 3;
    if (order.status === 'accepted') return 2;
    return 1;
  };
  const orderStage = getOrderStage();

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Order Details</h1>
            <p className="text-muted-foreground">Placed {formatDistanceToNow(new Date(order.created_at))} ago</p>
          </div>
          <Badge variant={order.status === 'accepted' ? 'default' :
                          order.status === 'completed' ? 'secondary' :
                          order.status === 'cancelled' ? 'destructive' : 'outline'}
                 className="text-sm px-3 py-1 font-semibold">{order.status.replace('_', ' ').toUpperCase()}</Badge>
        </div>

        {/* Two-column info */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Order Info */}
          <Card>
            <CardHeader><CardTitle>Order Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Link to={`/listing/${order.listing_id}`} className="hover:underline">
                  <p className="font-medium text-lg">{order.listings?.title}</p>
                </Link>
                <p className="text-sm text-muted-foreground">Category: {(order.listings as any)?.category_id || 'N/A'}</p>
              </div>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Original Price:</span><span>${order.original_price}</span></div>
                {order.negotiated_price && <div className="flex justify-between"><span className="text-muted-foreground">Negotiated Price:</span><span className="text-primary">${order.negotiated_price}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Quantity:</span><span>{order.quantity}</span></div>
                <Separator />
                <div className="flex justify-between font-bold text-lg"><span>Total:</span><span className="text-primary">${order.final_amount}</span></div>
              </div>
              {order.notes && (<><Separator /><div><p className="text-sm font-medium mb-1">Notes:</p><p className="text-sm text-muted-foreground">{order.notes}</p></div></>)}
            </CardContent>
          </Card>

          {/* Participants */}
          <Card>
            <CardHeader><CardTitle>Participants</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Buyer</p>
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <span className="truncate">{(order as any).buyer_profile?.name || 'N/A'}</span>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Seller</p>
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <span className="truncate">{(order as any).seller_profile?.name || 'N/A'}</span>
                </div>
              </div>
              {canChat && (<><Separator /><Link to={`/messages?seller=${isBuyer ? order.seller_id : order.buyer_id}&listing=${order.listing_id}`} className="block w-full"><Button className="w-full min-h-[44px]" size="default" variant="outline"><MessageSquare className="h-5 w-5 mr-2" />Open Chat</Button></Link></>)}
            </CardContent>
          </Card>
        </div>

        {/* Negotiations, Actions, Payment (Stripe & COD), Timeline, QR Code cards */}
        {/* -- Keep all your existing JSX for negotiations, actions, timeline, QR code display/scanner -- */}

        {/* PAYMENT OPTIONS: STRIPE or COD */}
        {isBuyer && order.status === 'accepted' && !isPaid && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" /> Next Step: Payment Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The seller has accepted your order. Choose a payment method to proceed.
              </p>
              <div className="flex flex-col gap-3">
                <Button 
                  className="w-full min-h-[52px]" 
                  size="lg" 
                  onClick={initiatePayment}
                  disabled={isPaymentLoading || isVerifying}
                >
                  <CreditCard className="h-6 w-6 mr-2" />
                  {isPaymentLoading ? 'Opening payment page...' : isVerifying ? 'Verifying payment...' : 'Pay with Card'}
                </Button>
                <Button
                  className="w-full min-h-[52px]"
                  size="lg"
                  variant="outline"
                  onClick={async () => {
                    await updateOrderMutation.mutateAsync({ status: 'cod' });
                    toast({ title: 'Order placed as COD', description: 'Pay the seller on delivery' });
                  }}
                >
                  <Package className="h-6 w-6 mr-2" />
                  Pay with Cash on Delivery
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Keep rest of your timeline, QR code, and dialogs unchanged */}
      </div>

      {/* QR Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR Code for {order.delivery_scanned_at && !order.return_scanned_at ? 'Return' : 'Delivery'}</DialogTitle>
          </DialogHeader>
          {order.qr_code_data && <QRCodeDisplay qrData={order.qr_code_data} orderType={order.listings?.type || 'item'} />}
        </DialogContent>
      </Dialog>

      {/* QR Scanner Dialog */}
      <Dialog open={showScanDialog} onOpenChange={setShowScanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
          </DialogHeader>
          <QRScanner onScan={handleQRScan} />
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default OrderDetail;
