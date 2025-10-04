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

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          listings(*, profiles!listings_seller_id_fkey(name, avatar_url)),
          buyer_profile:profiles!orders_buyer_id_fkey(name, avatar_url),
          seller_profile:profiles!orders_seller_id_fkey(name, avatar_url)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    }
  });

  const { data: negotiations } = useQuery({
    queryKey: ['negotiations', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('order_negotiations')
        .select('*, from_profile:profiles!order_negotiations_from_user_id_fkey(name)')
        .eq('order_id', id)
        .order('created_at', { ascending: true });
      return data || [];
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
    toast({ title: 'Order accepted!', description: 'You can now chat with the buyer' });
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
      action: 'counter_offer',
      amount,
      message: `Counter offer: $${amount} per unit`
    });
    toast({ title: 'Counter offer sent!' });
  };

  const initiatePayment = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { order_id: id }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      toast({
        title: 'Payment failed',
        description: error.message,
        variant: 'destructive'
      });
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

  // Listen for payment success from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      toast({ title: 'Payment successful!', description: 'Your order has been confirmed' });
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      navigate(`/orders/${id}`, { replace: true });
    }
  }, [id, toast, queryClient, navigate]);

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
  const canChat = order.status === 'accepted' || order.status === 'paid' || order.status === 'in_progress';
  const isPaid = !!order.stripe_payment_intent_id;
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
          >
            {order.status}
          </Badge>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
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
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span>{(order as any).buyer_profile?.name || 'N/A'}</span>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium mb-2">Seller</p>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span>{(order as any).seller_profile?.name || 'N/A'}</span>
                </div>
              </div>

              {canChat && (
                <>
                  <Separator />
                  <Link to={`/messages?order=${id}`} className="w-full">
                    <Button className="w-full" variant="outline">
                      <MessageSquare className="h-4 w-4 mr-2" />
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
                        {neg.action === 'offer' && `Offered $${neg.amount}`}
                        {neg.action === 'counter' && `Counter offered $${neg.amount}`}
                        {neg.action === 'accept' && 'Accepted offer'}
                        {neg.action === 'reject' && 'Rejected offer'}
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
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button
                className="flex-1"
                onClick={handleAcceptOrder}
                disabled={updateOrderMutation.isPending}
              >
                <Check className="h-4 w-4 mr-2" />
                Accept Order
              </Button>
              <Button
                className="flex-1"
                variant="destructive"
                onClick={handleDeclineOrder}
                disabled={updateOrderMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Decline Order
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Payment Action */}
        {isBuyer && order.status === 'accepted' && !isPaid && (
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <Button className="w-full" size="lg" onClick={initiatePayment}>
                <CreditCard className="h-5 w-5 mr-2" />
                Proceed to Payment
              </Button>
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
              <Button onClick={generateQRCode} className="w-full">
                <QrCode className="h-5 w-5 mr-2" />
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
              <Button onClick={() => setShowQRDialog(true)} className="w-full">
                <QrCode className="h-5 w-5 mr-2" />
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
              <Button onClick={() => { setScanType('delivery'); setShowScanDialog(true); }} className="w-full">
                <Scan className="h-5 w-5 mr-2" />
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
              <Button onClick={() => setShowQRDialog(true)} className="w-full">
                <QrCode className="h-5 w-5 mr-2" />
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
              <Button onClick={() => { setScanType('return'); setShowScanDialog(true); }} className="w-full">
                <Scan className="h-5 w-5 mr-2" />
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
    </DashboardLayout>
  );
};

export default OrderDetail;
