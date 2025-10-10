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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Check, X, MessageSquare, Package, CreditCard, QrCode, Scan, Clock, CheckCircle2, DollarSign, Shield, Star, User, AlertCircle } from 'lucide-react';
import { QRCodeDisplay } from '@/components/qr/QRCodeDisplay';
import { QRScanner } from '@/components/qr/QRScanner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Currency configuration
const CURRENCY_CONFIG = {
  USD: { symbol: '$', decimalDigits: 2 },
  INR: { symbol: '₹', decimalDigits: 2 },
  PKR: { symbol: 'Rs', decimalDigits: 0 }
} as const;

type Currency = keyof typeof CURRENCY_CONFIG;

const formatCurrency = (amount: number, currency: Currency = 'USD'): string => {
  const config = CURRENCY_CONFIG[currency];
  
  if (currency === 'PKR') {
    return `${config.symbol} ${Math.round(amount).toLocaleString()}`;
  }
  
  return `${config.symbol}${amount.toFixed(config.decimalDigits)}`;
};

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
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [ratingFor, setRatingFor] = useState<'buyer' | 'seller' | null>(null);

  console.log('🔄 OrderDetail component rendering with ID:', id);

  // Enhanced order query with related data
  const { data: order, isLoading, error: queryError } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      console.log('🔄 Fetching order with ID:', id);
      
      if (!id) {
        throw new Error('No order ID provided');
      }

      // First get the basic order data
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();

      if (orderError) {
        console.error('❌ Error fetching order:', orderError);
        throw new Error(`Failed to load order: ${orderError.message}`);
      }

      if (!orderData) {
        throw new Error('Order not found');
      }

      console.log('✅ Basic order data loaded:', orderData);

      // Fetch related data separately with error handling
      const fetchListing = orderData.listing_id 
        ? supabase
            .from('listings')
            .select('title, category_id, type')
            .eq('id', orderData.listing_id)
            .single()
            .then(({ data, error }) => {
              if (error) {
                console.error('❌ Error fetching listing:', error);
                return null;
              }
              return data;
            })
            .catch(error => {
              console.error('❌ Exception fetching listing:', error);
              return null;
            })
        : Promise.resolve(null);

      const fetchBuyer = orderData.buyer_id
        ? supabase
            .from('profiles')
            .select('name, avatar_url')
            .eq('id', orderData.buyer_id)
            .single()
            .then(({ data, error }) => {
              if (error) {
                console.error('❌ Error fetching buyer profile:', error);
                return null;
              }
              return data;
            })
            .catch(error => {
              console.error('❌ Exception fetching buyer profile:', error);
              return null;
            })
        : Promise.resolve(null);

      const fetchSeller = orderData.seller_id
        ? supabase
            .from('profiles')
            .select('name, avatar_url')
            .eq('id', orderData.seller_id)
            .single()
            .then(({ data, error }) => {
              if (error) {
                console.error('❌ Error fetching seller profile:', error);
                return null;
              }
              return data;
            })
            .catch(error => {
              console.error('❌ Exception fetching seller profile:', error);
              return null;
            })
        : Promise.resolve(null);

      const [listingData, buyerData, sellerData] = await Promise.all([
        fetchListing,
        fetchBuyer,
        fetchSeller
      ]);

      const result = {
        ...orderData,
        listings: listingData,
        buyer_profile: buyerData,
        seller_profile: sellerData
      };

      console.log('✅ Final order result with related data:', result);
      return result;
    },
    enabled: !!id,
    retry: 1,
  });

  // Fetch negotiations
  const { data: negotiations } = useQuery({
    queryKey: ['negotiations', id],
    queryFn: async () => {
      if (!id) return [];
      
      const { data, error } = await supabase
        .from('order_negotiations')
        .select('*')
        .eq('order_id', id)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching negotiations:', error);
        return [];
      }
      
      if (!data || data.length === 0) return [];

      // Fetch profile names for negotiations
      const negotiationsWithProfiles = await Promise.all(
        data.map(async (neg) => {
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', neg.from_user_id)
              .single();
            
            return {
              ...neg,
              from_profile: profileData || { name: 'Unknown User' }
            };
          } catch (error) {
            console.error('Error fetching profile for negotiation:', error);
            return {
              ...neg,
              from_profile: { name: 'Unknown User' }
            };
          }
        })
      );
      
      return negotiationsWithProfiles;
    },
    enabled: !!id && !!order,
  });

  // Fetch reviews
  const { data: existingReviews } = useQuery({
    queryKey: ['order-reviews', id],
    queryFn: async () => {
      if (!id) return [];
      
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('order_id', id);
      
      if (error) {
        console.error('Error fetching reviews:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!id && !!order,
  });

  // Calculate derived values AFTER order is loaded
  const isSeller = user?.id === order?.seller_id;
  const isBuyer = user?.id === order?.buyer_id;
  const isPaid = order?.status === 'paid' || order?.status === 'in_progress' || order?.status === 'completed' || 
                (order?.payment_method === 'cod' && order?.status === 'paid');
  const canChat = order?.status === 'accepted' || isPaid;

  // Check if user can rate the other party
  const canRateSeller = isBuyer && order?.status === 'completed' && 
    !existingReviews?.some(review => review.reviewer_id === user?.id && review.reviewed_user_id === order.seller_id);

  const canRateBuyer = isSeller && order?.status === 'completed' && 
    !existingReviews?.some(review => review.reviewer_id === user?.id && review.reviewed_user_id === order.buyer_id);

  // Mutations
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

  const submitReviewMutation = useMutation({
    mutationFn: async (reviewData: any) => {
      const { error } = await supabase
        .from('reviews')
        .insert([reviewData]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Review submitted!',
        description: 'Thank you for your feedback.'
      });
      setShowRatingDialog(false);
      setRating(5);
      setReviewComment('');
      setRatingFor(null);
      queryClient.invalidateQueries({ queryKey: ['order-reviews', id] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to submit review',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Simple handlers for now
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

  const handleRateSeller = () => {
    setRatingFor('seller');
    setShowRatingDialog(true);
  };

  const handleRateBuyer = () => {
    setRatingFor('buyer');
    setShowRatingDialog(true);
  };

  const handleSubmitReview = async () => {
    if (!ratingFor || !user?.id || !order) return;

    const reviewedUserId = ratingFor === 'seller' ? order.seller_id : order.buyer_id;
    
    await submitReviewMutation.mutateAsync({
      order_id: id,
      reviewer_id: user.id,
      reviewed_user_id: reviewedUserId,
      listing_id: order.listing_id,
      rating: rating,
      comment: reviewComment || null
    });
  };

  // Show loading state
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="h-64 bg-muted rounded-lg"></div>
              <div className="h-64 bg-muted rounded-lg"></div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Show error state
  if (queryError || !order) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6 p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {queryError?.message || 'Failed to load order'}
            </AlertDescription>
          </Alert>
          <Button onClick={() => navigate('/orders')}>
            Back to Orders
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const orderCurrency = order.currency as Currency || 'USD';

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Order Details</h1>
            <p className="text-muted-foreground">
              Placed {formatDistanceToNow(new Date(order.created_at))} ago
            </p>
          </div>
          <div className="flex items-center gap-2">
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
            {order.currency && (
              <Badge variant="outline" className="text-xs">
                {order.currency}
              </Badge>
            )}
          </div>
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
                  <p className="font-medium text-lg">{order.listings?.title || 'Loading...'}</p>
                </Link>
                <p className="text-sm text-muted-foreground">
                  Category: {order.listings?.category_id || 'N/A'}
                </p>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Original Price:</span>
                  <span>{formatCurrency(order.original_price, orderCurrency)}</span>
                </div>
                {order.negotiated_price && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Negotiated Price:</span>
                    <span className="text-primary">{formatCurrency(order.negotiated_price, orderCurrency)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quantity:</span>
                  <span>{order.quantity}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span className="text-primary">{formatCurrency(order.final_amount, orderCurrency)}</span>
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
                   <User className="h-5 w-5 text-muted-foreground" />
                   <span className="truncate">{order.buyer_profile?.name || 'Loading...'}</span>
                   {canRateBuyer && (
                     <Button size="sm" variant="outline" onClick={handleRateBuyer} className="ml-auto">
                       <Star className="h-3 w-3 mr-1" />
                       Rate
                     </Button>
                   )}
                 </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium mb-2">Seller</p>
                 <div className="flex items-center gap-2">
                   <User className="h-5 w-5 text-muted-foreground" />
                   <span className="truncate">{order.seller_profile?.name || 'Loading...'}</span>
                   {canRateSeller && (
                     <Button size="sm" variant="outline" onClick={handleRateSeller} className="ml-auto">
                       <Star className="h-3 w-3 mr-1" />
                       Rate
                     </Button>
                   )}
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

        {/* Actions for Seller */}
        {isSeller && order.status === 'pending' && (
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
                      <p className="font-medium">{neg.from_profile?.name || 'User'}</p>
                      <p className="text-sm text-muted-foreground">
                        {neg.action === 'counter' && `Offered ${formatCurrency(neg.amount, orderCurrency)}`}
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
            </CardContent>
          </Card>
        )}

        {/* Rating Section */}
        {existingReviews && existingReviews.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Reviews for this Order</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {existingReviews.map((review) => (
                  <div key={review.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {review.reviewer_id === user?.id ? 'You' : 'User'} rated {review.reviewed_user_id === order.seller_id ? 'Seller' : 'Buyer'}
                        </span>
                      </div>
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < review.rating
                                ? 'fill-current text-yellow-400'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-muted-foreground mt-2">{review.comment}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(review.created_at))} ago
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rating Dialog */}
        <Dialog open={showRatingDialog} onOpenChange={setShowRatingDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Rate {ratingFor === 'seller' ? order.seller_profile?.name || 'the Seller' : order.buyer_profile?.name || 'the Buyer'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  How was your experience with {ratingFor === 'seller' ? 'the seller' : 'the buyer'}?
                </p>
                
                <div className="flex justify-center gap-2 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="text-3xl focus:outline-none"
                    >
                      <Star
                        className={`${
                          star <= rating
                            ? 'fill-current text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  {rating === 1 && 'Poor'}
                  {rating === 2 && 'Fair'}
                  {rating === 3 && 'Good'}
                  {rating === 4 && 'Very Good'}
                  {rating === 5 && 'Excellent'}
                </p>
              </div>

              <div className="space-y-3">
                <Label htmlFor="review-comment">Optional Comment</Label>
                <Textarea
                  id="review-comment"
                  placeholder="Share your experience (optional)"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRatingDialog(false);
                    setRating(5);
                    setReviewComment('');
                    setRatingFor(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitReview}
                  disabled={submitReviewMutation.isPending}
                  className="flex-1"
                >
                  {submitReviewMutation.isPending ? 'Submitting...' : 'Submit Review'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default OrderDetail;
