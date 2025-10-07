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

  // ... other queries remain the same

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

  const initiatePayment = async () => {
    if (selectedPaymentMethod === 'cod') {
      setShowPaymentMethodDialog(true);
      return;
    }

    // Existing Stripe payment logic
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

  // Update payment status check to include COD
  const isPaid = order?.status === 'paid' || order?.status === 'in_progress' || order?.status === 'completed' || 
                (order?.payment_method === 'cod' && order?.status === 'paid');

  const isSeller = user?.id === order?.seller_id;
  const isBuyer = user?.id === order?.buyer_id;

  // ... rest of your existing functions

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* ... existing order info JSX ... */}

        {/* Payment Method Selection */}
        {isBuyer && order?.status === 'accepted' && !isPaid && (
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
                  <span className="text-lg font-bold text-primary">${order?.final_amount}</span>
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
                disabled={isPaymentLoading}
              >
                {selectedPaymentMethod === 'stripe' ? (
                  <>
                    <CreditCard className="h-6 w-6 mr-2" />
                    {isPaymentLoading ? 'Processing...' : `Pay $${order?.final_amount}`}
                  </>
                ) : (
                  <>
                    <DollarSign className="h-6 w-6 mr-2" />
                    {isPaymentLoading ? 'Confirming...' : 'Confirm COD Order'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* COD Verification for Seller */}
        {isSeller && order?.payment_method === 'cod' && order?.status === 'paid' && !order?.cod_verified && (
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
                  <p className="text-sm font-medium text-yellow-800">Amount to collect: ${order?.final_amount}</p>
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
        {order?.payment_method === 'cod' && (
          <Card className={
            order?.cod_verified 
              ? 'border-green-500 bg-green-50' 
              : 'border-yellow-500 bg-yellow-50'
          }>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Cash on Delivery
                {order?.cod_verified ? (
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
                  {order?.cod_verified 
                    ? 'The cash payment has been verified and confirmed.'
                    : `Payment of $${order?.final_amount} is due upon delivery.`
                  }
                </p>
                {isBuyer && !order?.cod_verified && (
                  <div className="bg-white border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-yellow-800">
                      Please have exact cash ready when receiving the item.
                    </p>
                  </div>
                )}
                {isSeller && !order?.cod_verified && (
                  <div className="bg-white border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-yellow-800">
                      Collect ${order?.final_amount} in cash from the buyer upon delivery.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Status Summary */}
        {isPaid && (
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    order?.payment_method === 'cod' 
                      ? 'bg-yellow-100 text-yellow-600' 
                      : 'bg-green-100 text-green-600'
                  }`}>
                    {order?.payment_method === 'cod' ? (
                      <DollarSign className="h-5 w-5" />
                    ) : (
                      <CreditCard className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">
                      {order?.payment_method === 'cod' ? 'Cash on Delivery' : 'Online Payment'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {order?.payment_method === 'cod' 
                        ? (order?.cod_verified ? 'Payment verified' : 'Pay upon delivery')
                        : 'Payment completed'
                      }
                    </p>
                  </div>
                </div>
                <Badge variant={order?.cod_verified ? "default" : "secondary"}>
                  {order?.payment_method === 'cod' 
                    ? (order?.cod_verified ? 'Verified' : 'Pending') 
                    : 'Paid'
                  }
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ... rest of your existing JSX (QR codes, timeline, etc) ... */}
      </div>

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
                    You'll pay <span className="font-bold">${order?.final_amount}</span> in cash when you receive the item.
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

      {/* ... existing dialogs ... */}
    </DashboardLayout>
  );
};

export default OrderDetail;
