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
  const [isVerifying, setIsVerifying] = useState(false);

  // Fetch order
  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      if (!id) throw new Error('Order ID missing');

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id) // ✅ Correct query
        .single();

      if (error) throw error;
      if (!data) throw new Error('Order not found');

      // Fetch related listing, buyer, seller
      const [listingData, buyerData, sellerData] = await Promise.all([
        data.listing_id
          ? supabase.from('listings').select('*, seller_profile:profiles(name, avatar_url)').eq('id', data.listing_id).single()
          : Promise.resolve({ data: null }),
        data.buyer_id
          ? supabase.from('profiles').select('name, avatar_url').eq('id', data.buyer_id).single()
          : Promise.resolve({ data: null }),
        data.seller_id
          ? supabase.from('profiles').select('name, avatar_url').eq('id', data.seller_id).single()
          : Promise.resolve({ data: null }),
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

      // Attach from_user profile
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

  // Update order mutation
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

  // Send negotiation mutation
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

  // Payment check including COD
  const isPaidOrCOD = order?.status === 'paid' 
    || order?.status === 'in_progress' 
    || order?.status === 'completed'
    || order?.payment_method === 'cod';

  const isSeller = user?.id === order?.seller_id;
  const isBuyer = user?.id === order?.buyer_id;

  // Actions
  const handleAcceptOrder = async () => {
    await updateOrderMutation.mutateAsync({ status: 'accepted' });
    toast({ title: 'Order accepted!', description: 'The buyer will be notified and can proceed to payment or COD.' });
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
    await sendNegotiationMutation.mutateAsync({ action: 'accept', amount });
    toast({ title: 'Offer accepted!', description: 'Proceed to payment or COD' });
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

  // Stripe Payment initiation
  const initiatePayment = async () => {
    if (order?.payment_method === 'cod') {
      toast({ title: 'COD selected', description: 'Confirm payment on delivery.' });
      return;
    }

    setIsPaymentLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', { body: { order_id: id } });
      if (error) throw error;

      if (data?.url) {
        const paymentWindow = window.open(data.url, '_blank');
        if (!paymentWindow || paymentWindow.closed || typeof paymentWindow.closed === 'undefined') {
          toast({ title: 'Popup blocked', description: 'Redirecting in 2s...', variant: 'destructive' });
          setTimeout(() => window.location.href = data.url, 2000);
        } else {
          toast({ title: 'Redirecting to payment...', description: 'Complete payment in new window.' });
        }
      }
    } catch (err: any) {
      toast({ title: 'Payment failed', description: err.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setIsPaymentLoading(false);
    }
  };

  // QR Code generation
  const generateQRCode = async () => {
    try {
      const { error } = await supabase.rpc('generate_order_qr_code', { p_order_id: id });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['order', id] });
      setShowQRDialog(true);
      toast({ title: 'QR code generated!' });
    } catch (err: any) {
      toast({ title: 'QR generation failed', description: err.message, variant: 'destructive' });
    }
  };

  // QR scanning
  const handleQRScan = async (qrData: any) => {
    try {
      const { data, error } = await supabase.rpc('verify_qr_scan', { p_order_id: id, p_qr_secret: qrData.secret, p_scan_type: scanType });
      if (error || !data) throw new Error('Invalid QR code');
      await queryClient.invalidateQueries({ queryKey: ['order', id] });
      setShowScanDialog(false);
      toast({ title: 'Scan successful!', description: scanType === 'delivery' ? 'Item delivered' : 'Item returned' });
    } catch (err: any) {
      toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
    }
  };

  if (isLoading) return <DashboardLayout><p>Loading...</p></DashboardLayout>;
  if (!order) return <DashboardLayout><p>Order not found</p></DashboardLayout>;

  // Order timeline
  const getOrderStage = () => {
    if (order.return_scanned_at) return 5;
    if (order.delivery_scanned_at) return 4;
    if (isPaidOrCOD) return 3;
    if (order.status === 'accepted') return 2;
    return 1;
  };
  const orderStage = getOrderStage();

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Order #{order.id}</h1>
            <Badge variant="secondary">{order.status.toUpperCase()}</Badge>
          </div>
          <div>
            {isBuyer && order.status === 'accepted' && order.payment_method !== 'cod' && (
              <Button onClick={initiatePayment} disabled={isPaymentLoading || isVerifying}>
                Pay Now
              </Button>
            )}
            {isBuyer && order.payment_method === 'cod' && (
              <Button disabled>COD – Confirm on Delivery</Button>
            )}
          </div>
        </div>

        {/* Order details */}
        <Card>
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><strong>Listing:</strong> {order.listings?.title || 'N/A'}</p>
            <p><strong>Quantity:</strong> {order.quantity}</p>
            <p><strong>Final Amount:</strong> ${order.final_amount}</p>
            <p><strong>Buyer:</strong> {order.buyer_profile?.name || 'N/A'}</p>
            <p><strong>Seller:</strong> {order.seller_profile?.name || 'N/A'}</p>
            <p><strong>Payment Method:</strong> {order.payment_method.toUpperCase()}</p>
          </CardContent>
        </Card>

        {/* Negotiations */}
        <Card>
          <CardHeader>
            <CardTitle>Negotiations</CardTitle>
          </CardHeader>
          <CardContent>
            {negotiations?.length === 0 && <p>No negotiations yet</p>}
            <ul className="space-y-2">
              {negotiations?.map((neg) => (
                <li key={neg.id} className="flex justify-between items-center">
                  <span>{neg.from_profile?.name || 'User'}: {neg.message || `$${neg.amount}`}</span>
                  <span className="text-xs text-gray-500">{formatDistanceToNow(new Date(neg.created_at))} ago</span>
                  {isSeller && neg.action === 'counter' && (
                    <Button size="sm" onClick={() => handleAcceptOffer(neg.amount)}>Accept</Button>
                  )}
                </li>
              ))}
            </ul>
            {isBuyer && order.status === 'negotiating' && (
              <div className="flex mt-2 space-x-2">
                <Input
                  type="number"
                  placeholder="Counter offer"
                  value={counterOffer}
                  onChange={(e) => setCounterOffer(e.target.value)}
                />
                <Button onClick={handleCounterOffer}>Send</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* QR code */}
        {isSeller && !order.qr_code_data && isPaidOrCOD && (
          <Button onClick={generateQRCode} icon={<QrCode />}>Generate QR Code</Button>
        )}
        {order.qr_code_data && (
          <Button onClick={() => setShowQRDialog(true)} icon={<QrCode />}>View QR Code</Button>
        )}

        {/* Scan QR */}
        {order.qr_code_data && ((isBuyer && !order.delivery_scanned_at) || (isSeller && !order.delivery_scanned_at)) && (
          <Button onClick={() => { setScanType('delivery'); setShowScanDialog(true); }} icon={<Scan />}>Scan Delivery</Button>
        )}

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Order Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <TimelineStep number={1} label="Order Placed" completed={true} />
            <TimelineStep number={2} label="Order Accepted" completed={orderStage >= 2} />
            <TimelineStep number={3} label="Payment / COD Done" completed={orderStage >= 3} />
            <TimelineStep number={4} label="Delivered" completed={orderStage >= 4} />
            <TimelineStep number={5} label="Returned" completed={orderStage >= 5} />
          </CardContent>
        </Card>
      </div>

      {/* QR Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order QR Code</DialogTitle>
          </DialogHeader>
          <QRCodeDisplay value={order.qr_code_data} />
        </DialogContent>
      </Dialog>

      {/* QR Scan Dialog */}
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

// Timeline step component
const TimelineStep = ({ number, label, completed }: { number: number; label: string; completed: boolean }) => (
  <div className="flex items-center space-x-3">
    <div className={`w-8 h-8 flex items-center justify-center rounded-full ${completed ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
      {completed ? <Check size={16} /> : number}
    </div>
    <span className={`${completed ? 'font-semibold' : 'text-gray-500'}`}>{label}</span>
  </div>
);
