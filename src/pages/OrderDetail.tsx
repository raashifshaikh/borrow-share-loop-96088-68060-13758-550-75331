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
import { Check, X, MessageSquare, Package, CreditCard, QrCode, Scan, Clock, CheckCircle2, DollarSign, Shield } from 'lucide-react';
import { QRCodeDisplay } from '@/components/qr/QRCodeDisplay';
import { QRScanner } from '@/components/qr/QRScanner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'stripe' | 'cod'>('stripe');
  const [showPaymentMethodDialog, setShowPaymentMethodDialog] = useState(false);

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
      
      // Fetch related data separately with error handling
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
      
      // Fetch profile data separately
      const negotiationsWithProfiles = await Promise.all(
        (data || []).map(async (neg) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', neg.from_user_id)
            .single();
          
          return {
            ...neg,
            from_profile: profileData
          };
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

  // Handle COD payment confirmation
  const confirmCODPayment = async () => {
    setIsPaymentLoading(true);
    try {
      await updateOrderMutation.mutateAsync({
        payment_method: 'cod',
        status: 'paid',
        cod_verified: false,
        updated_at: new Date().toISOString()
      });
      
      toast({
        title: 'Cash on Delivery selected!',
        description: 'Please pay the seller upon delivery.'
      });
      
      // Auto-generate QR code for COD orders
      setTimeout(async () => {
        const { error: qrError } = await supabase.rpc('generate_order_qr_code', { p_order_id: id });
        if (!qrError) {
          await queryClient.invalidateQueries({ queryKey: ['order', id] });
        }
      }, 1000);
      
    } catch (error: any) {
      toast({
        title: 'Failed to confirm COD',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsPaymentLoading(false);
      setShowPaymentMethodDialog(false);
    }
  };

  // Verify COD payment (for sellers)
  const verifyCODPayment = async () => {
    try {
      await updateOrderMutation.mutateAsync({
        cod_verified: true,
        cod_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      toast({
        title: 'COD payment verified!',
        description: 'Cash payment has been confirmed.'
      });
    } catch (error: any) {
      toast({
        title: 'Failed to verify payment',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleAcceptOrder = async () => {
    await updateOrderMutation.mutateAsync({ status: 'accepted' });
    toast({ 
      title: 'Order accepted!', 
      description: 'The buyer will be notified and can proceed to payment'
    });
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
    if (selectedPaymentMethod === 'cod') {
      setShowPaymentMethodDialog(true);
      return;
    }

    setIsPaymentLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { 
          order_id: id,
          payment_method: selectedPaymentMethod
        }
      });

      if (error) throw error;

      if (data?.url) {
        const paymentWindow = window.open(data.url, '_blank');
        
        if (!paymentWindow || paymentWindow.closed || typeof paymentWindow.closed === 'undefined') {
          toast({
            title: 'Popup blocked',
            description: 'Please allow popups or we will redirect you',
            variant: 'destructive'
          });
          setTimeout(() => {
            window.location.href = data.url;
          }, 2000);
        } else {
          toast({
            title: 'Redirecting to payment...',
            description: 'Complete your payment in the new window'
          });
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error occurred';
      const isStripeError = errorMessage.includes('stripe') || errorMessage.includes('payment');
      
      toast({
        title: 'Payment initialization failed',
        description: isStripeError 
          ? 'Payment service error. Please try again or contact support.' 
          : errorMessage,
        variant: 'destructive'
      });
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
        description: scanType === 'delivery' ? 'Item delivered' : 
                    scanType === 'return' ? 'Item returned' :
                    scanType === 'service_start' ? 'Service started' : 'Service completed'
      });
    } catch (error: any) {
      toast({ title: 'Scan failed', description: error.message, variant: 'destructive' });
    }
  };

  // Listen for payment success and verify
  const [isVerifying, setIsVerifying] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');

    if (params.get('payment') === 'success' && sessionId && !isVerifying) {
      setIsVerifying(true);
      console.log('[OrderDetail] Starting payment verification...', sessionId);
      
      // Verify payment with backend
      supabase.functions.invoke('verify-payment', {
        body: { session_id: sessionId, order_id: id }
      }).then(async ({ data, error }) => {
        console.log('[OrderDetail] Verification response:', { data, error });
        
        if (error) {
          console.error('[OrderDetail] Verification error:', error);
          toast({ 
            title: 'Payment verification failed', 
            description: error.message || 'Please contact support',
            variant: 'destructive' 
          });
        } else {
          toast({ 
            title: 'Payment successful!', 
            description: 'Your order has been confirmed.',
            duration: 5000
          });
          
          // Refresh order data
          await queryClient.invalidateQueries({ queryKey: ['order', id] });
          
          // Auto-generate QR code after payment
          console.log('[OrderDetail] Generating QR code...');
          setTimeout(async () => {
            const { error: qrError } = await supabase.rpc('generate_order_qr_code', { p_order_id: id });
            if (qrError) {
              console.error('[OrderDetail] QR generation error:', qrError);
            } else {
              await queryClient.invalidateQueries({ queryKey: ['order', id] });
            }
          }, 1000);
        }
        
        // Clean URL
        navigate(`/orders/${id}`, { replace: true });
        setIsVerifying(false);
      }).catch((err) => {
        console.error('[OrderDetail] Unexpected error:', err);
        toast({ 
          title: 'Verification error', 
          description: 'An unexpected error occurred',
          variant: 'destructive' 
        });
        setIsVerifying(false);
      });
    } else if (params.get('payment') === 'cancelled') {
      toast({ 
        title: 'Payment cancelled', 
        description: 'You can try again when ready',
        variant: 'default'
      });
      navigate(`/orders/${id}`, { replace: true });
    }
  }, [id, toast, queryClient, navigate, isVerifying]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded-lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Order not found</p>
        </div>
      </DashboardLayout>
    );
  }

  const isSeller = user?.id === order.seller_id;
  const isBuyer = user?.id === order.buyer_id;
  const isPaid = order.status === 'paid' || order.status === 'in_progress' || order.status === 'completed' || 
                (order.payment_method === 'cod' && order.status === 'paid');
  const canChat = order.status === 'accepted' || isPaid;
  const canGenerateQR = isPaid && !order.qr_code_data;
  const canShowQR = isPaid && order.qr_code_data && isSeller && !order.delivery_scanned_at;
  const canScanDelivery = isPaid && order.qr_code_data && isBuyer && !order.delivery_scanned_at;
  const canShowReturnQR = order.delivery_scanned_at && isBuyer && !order.return_scanned_at;
  const canScanReturn = order.delivery_scanned_at && isSeller && !order.return_scanned_at;

  // Order timeline stages
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Order Details</h1>
            <p className="text-muted-foreground">
              Placed {formatDistanceToNow(new Date(order.created_at))} ago
            </p>
          </div>
          <Badge
            variant={
              order.status === 'accepted' ? 'default' :
              order.status === 'completed' ? 'secondary' :
              order.status === 'cancelled' ? 'destructive' : 'outline'
            }
            className="text-sm px-3 py-1 font-semibold"
          >
            {order.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Order Info */}
          <Card>
            <CardHeader>
              <CardTitle>Order Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Link to={`/listing/${order.listing_id}`} className="hover:underline">
                  <p className="font-medium text-lg">{order.listings?.title}</p>
                </Link>
                <p className="text-sm text-muted-foreground">
                  Category: {(order.listings as any)?.category_id || 'N/A'}
                </p>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Original Price:</span>
                  <span>${order.original_price}</span>
                </div>
                {order.negotiated_price && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Negotiated Price:</span>
                    <span className="text-primary">${order.negotiated_price}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quantity:</span>
                  <span>{order.quantity}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span className="text-primary">${order.final_amount}</span>
                </div>
              </div>

              {order.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-1">Notes:</p>
                    <p className="text-sm text-muted-foreground">{order.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Participants */}
          <Card>
            <CardHeader>
              <CardTitle>Participants</CardTitle>
            </CardHeader>
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

              {canChat && (
                <>
                  <Separator />
                  <Link 
                    to={`/messages?seller=${isBuyer ? order.seller_id : order.buyer_id}&listing=${order.listing_id}`} 
                    className="block w-full"
                  >
                    <Button className="w-full min-h-[44px]" size="default" variant="outline">
                      <MessageSquare className="h-5 w-5 mr-2" />
                      Open Chat
                    </Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Negotiations */}
        {negotiations && negotiations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Negotiation History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {negotiations.map((neg) => (
                  <div
                    key={neg.id}
                    className="flex items-start justify-between p-3 bg-muted rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{(neg as any).from_profile?.name || 'User'}</p>
                      <p className="text-sm text-muted-foreground">
                        {neg.action === 'counter' && `Offered $${neg.amount}`}
                        {neg.action === 'accept' && 'Accepted offer'}
                        {neg.action === 'decline' && 'Declined offer'}
                      </p>
                      {neg.message && (
                        <p className="text-sm mt-1">{neg.message}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(neg.created_at))} ago
                    </span>
                  </div>
                ))}
              </div>

              {isSeller && order.status === 'pending' && negotiations.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Counter offer amount"
                      value={counterOffer}
                      onChange={(e) => setCounterOffer(e.target.value)}
                    />
                    <Button onClick={handleCounterOffer}>Send</Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={() => handleAcceptOffer(negotiations[negotiations.length - 1].amount)}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Accept Offer
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {isSeller && order.status === 'pending' && negotiations.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Action Required</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Review this order and decide whether to accept or decline it.
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  className="w-full min-h-[48px]"
                  size="lg"
                  onClick={handleAcceptOrder}
                  disabled={updateOrderMutation.isPending}
                >
                  <Check className="h-5 w-5 mr-2" />
                  Accept Order
                </Button>
                <Button
                  className="w-full min-h-[48px]"
                  size="lg"
                  variant="destructive"
                  onClick={handleDeclineOrder}
                  disabled={updateOrderMutation.isPending}
                >
                  <X className="h-5 w-5 mr-2" />
                  Decline Order
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Action */}
        {isBuyer && order.status === 'accepted' && !isPaid && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose how you'd like to pay for this order.
              </p>

              <RadioGroup 
                value={selectedPaymentMethod} 
                onValueChange={(value: 'stripe' | 'cod') => setSelectedPaymentMethod(value)}
                className="space-y-3"
              >
                <div className="flex items-center space-x-2 border rounded-lg p-4 hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="stripe" id="stripe" />
                  <Label htmlFor="stripe" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Pay Now (Stripe)</p>
                        <p className="text-sm text-muted-foreground">Secure online payment</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-green-600" />
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 border rounded-lg p-4 hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="cod" id="cod" />
                  <Label htmlFor="cod" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Cash on Delivery</p>
                        <p className="text-sm text-muted-foreground">Pay when you receive the item</p>
                      </div>
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </Label>
                </div>
              </RadioGroup>

              <div className="bg-muted rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Amount:</span>
                  <span className="text-lg font-bold text-primary">${order.final_amount}</span>
                </div>
                {selectedPaymentMethod === 'cod' && (
                  <p className="text-sm text-muted-foreground mt-2">
                    You'll pay this amount in cash when you receive the item.
                  </p>
                )}
              </div>

              <Button 
                className="w-full min-h-[52px]" 
                size="lg" 
                onClick={initiatePayment}
                disabled={isPaymentLoading || isVerifying}
              >
                {selectedPaymentMethod === 'stripe' ? (
                  <>
                    <CreditCard className="h-6 w-6 mr-2" />
                    {isPaymentLoading ? 'Processing...' : isVerifying ? 'Verifying payment...' : `Pay $${order.final_amount}`}
                  </>
                ) : (
                  <>
                    <DollarSign className="h-6 w-6 mr-2" />
                    {isPaymentLoading ? 'Confirming...' : 'Confirm COD Order'}
                  </>
                )}
              </Button>

              {(isPaymentLoading || isVerifying) && (
                <p className="text-xs text-center text-muted-foreground animate-pulse">
                  {selectedPaymentMethod === 'stripe' 
                    ? (isPaymentLoading ? 'Redirecting to secure payment page...' : 'Confirming your payment with Stripe...')
                    : 'Confirming your COD order...'
                  }
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payment Verification Status */}
        {isBuyer && isVerifying && (
          <Card className="border-primary bg-primary/5">
            <CardContent className="py-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <div>
                  <p className="font-medium">Verifying your payment...</p>
                  <p className="text-sm text-muted-foreground">This will only take a moment</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* COD Verification for Seller */}
        {isSeller && order.payment_method === 'cod' && order.status === 'paid' && !order.cod_verified && (
          <Card className="border-yellow-500 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-700">
                <DollarSign className="h-5 w-5" />
                COD Payment Pending Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-yellow-700">
                  This is a Cash on Delivery order. Please verify when you receive payment from the buyer.
                </p>
                <div className="bg-white border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-yellow-800">Amount to collect: ${order.final_amount}</p>
                </div>
              </div>
              <Button 
                onClick={verifyCODPayment}
                className="w-full bg-green-600 hover:bg-green-700 min-h-[48px]"
                size="lg"
              >
                <Check className="h-5 w-5 mr-2" />
                Confirm Cash Received
              </Button>
            </CardContent>
          </Card>
        )}

        {/* COD Status Display */}
        {order.payment_method === 'cod' && (
          <Card className={
            order.cod_verified 
              ? 'border-green-500 bg-green-50' 
              : 'border-yellow-500 bg-yellow-50'
          }>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Cash on Delivery
                {order.cod_verified ? (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    Payment Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    Pending Payment
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm">
                  {order.cod_verified 
                    ? 'The cash payment has been verified and confirmed.'
                    : `Payment of $${order.final_amount} is due upon delivery.`
                  }
                </p>
                {isBuyer && !order.cod_verified && (
                  <div className="bg-white border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-yellow-800">
                      Please have exact cash ready when receiving the item.
                    </p>
                  </div>
                )}
                {isSeller && !order.cod_verified && (
                  <div className="bg-white border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-yellow-800">
                      Collect ${order.final_amount} in cash from the buyer upon delivery.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Steps Card for Seller After Acceptance */}
        {isSeller && order.status === 'accepted' && !isPaid && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle>✓ Order Accepted</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The buyer has been notified and will complete payment shortly. Once payment is confirmed, you can generate a QR code for delivery tracking.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Order Timeline */}
        {isPaid && (
          <Card>
            <CardHeader>
              <CardTitle>Order Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {orderStage >= 1 ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Clock className="h-5 w-5 text-muted-foreground" />}
                  <div className="flex-1">
                    <p className="font-medium">Order Placed</p>
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(order.created_at))} ago</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {orderStage >= 2 ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Clock className="h-5 w-5 text-muted-foreground" />}
                  <div className="flex-1">
                    <p className="font-medium">Order Accepted</p>
                    {order.status === 'accepted' && <p className="text-xs text-muted-foreground">Seller accepted your order</p>}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {orderStage >= 3 ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Clock className="h-5 w-5 text-muted-foreground" />}
                  <div className="flex-1">
                    <p className="font-medium">Payment Confirmed</p>
                    {isPaid && <p className="text-xs text-muted-foreground">Payment processed successfully</p>}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {orderStage >= 4 ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Clock className="h-5 w-5 text-muted-foreground" />}
                  <div className="flex-1">
                    <p className="font-medium">Item Delivered</p>
                    {order.delivery_scanned_at && <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(order.delivery_scanned_at))} ago</p>}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {orderStage >= 5 ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Clock className="h-5 w-5 text-muted-foreground" />}
                  <div className="flex-1">
                    <p className="font-medium">Item Returned</p>
                    {order.return_scanned_at && <p className="text-xs text-muted-foreground">Completed {formatDistanceToNow(new Date(order.return_scanned_at))} ago</p>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* QR Code Actions */}
        {canGenerateQR && isSeller && (
          <Card>
            <CardHeader>
              <CardTitle>Generate QR Code</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Generate a QR code for item delivery tracking</p>
              <Button onClick={generateQRCode} className="w-full min-h-[48px]" size="lg">
                <QrCode className="h-6 w-6 mr-2" />
                Generate QR Code
              </Button>
            </CardContent>
          </Card>
        )}

        {canShowQR && (
          <Card>
            <CardHeader>
              <CardTitle>Show QR Code for Delivery</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Show this QR code to the buyer when delivering the item</p>
              <Button onClick={() => setShowQRDialog(true)} className="w-full min-h-[48px]" size="lg">
                <QrCode className="h-6 w-6 mr-2" />
                Show QR Code
              </Button>
            </CardContent>
          </Card>
        )}

        {canScanDelivery && (
          <Card>
            <CardHeader>
              <CardTitle>Scan for Delivery</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Scan the seller's QR code to confirm you received the item</p>
              <Button onClick={() => { setScanType('delivery'); setShowScanDialog(true); }} className="w-full min-h-[48px]" size="lg">
                <Scan className="h-6 w-6 mr-2" />
                Scan QR Code
              </Button>
            </CardContent>
          </Card>
        )}

        {canShowReturnQR && (
          <Card>
            <CardHeader>
              <CardTitle>Show QR Code for Return</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Show this QR code to the seller when returning the item</p>
              <Button onClick={() => setShowQRDialog(true)} className="w-full min-h-[48px]" size="lg">
                <QrCode className="h-6 w-6 mr-2" />
                Show QR Code
              </Button>
            </CardContent>
          </Card>
        )}

        {canScanReturn && (
          <Card>
            <CardHeader>
              <CardTitle>Scan for Return</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Scan the buyer's QR code to confirm the item has been returned</p>
              <Button onClick={() => { setScanType('return'); setShowScanDialog(true); }} className="w-full min-h-[48px]" size="lg">
                <Scan className="h-6 w-6 mr-2" />
                Scan QR Code
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* QR Code Display Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR Code for {canShowReturnQR ? 'Return' : 'Delivery'}</DialogTitle>
          </DialogHeader>
          {order.qr_code_data && (
            <QRCodeDisplay qrData={order.qr_code_data} orderType={order.listings?.type || 'item'} />
          )}
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

      {/* Payment Method Confirmation Dialog */}
      <Dialog open={showPaymentMethodDialog} onOpenChange={setShowPaymentMethodDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Cash on Delivery</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">Cash on Delivery Order</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    You'll pay <span className="font-bold">${order.final_amount}</span> in cash when you receive the item.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Important Notes:</p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Payment is due upon delivery inspection</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Have exact cash ready for the seller</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Verify the item condition before payment</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Seller will confirm payment receipt</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowPaymentMethodDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmCODPayment}
                disabled={isPaymentLoading}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isPaymentLoading ? 'Confirming...' : 'Confirm COD Order'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default OrderDetail;
