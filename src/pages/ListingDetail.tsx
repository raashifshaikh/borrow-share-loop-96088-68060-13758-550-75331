import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Heart, MapPin, Star, MessageSquare, Calendar, Package } from 'lucide-react';
import { NegotiationDialog } from '@/components/NegotiationDialog';

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

const getCurrencySymbol = (currency: Currency): string => {
  return CURRENCY_CONFIG[currency].symbol;
};

const ListingDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [showNegotiation, setShowNegotiation] = useState(false);

  const { data: listing, isLoading } = useQuery({
    queryKey: ['listing', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          categories(name),
          profiles!listings_seller_id_fkey(name, avatar_url, bio)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    }
  });

  const { data: reviews } = useQuery({
    queryKey: ['reviews', listing?.seller_id],
    queryFn: async () => {
      if (!listing?.seller_id) return [];
      const { data } = await supabase
        .from('reviews')
        .select('*')
        .eq('reviewed_user_id', listing.seller_id);
      return data || [];
    },
    enabled: !!listing?.seller_id
  });

  const { data: userPreferences } = useQuery({
    queryKey: ['user-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profile_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id
  });

  // Get display currency (user preference or listing currency)
  const displayCurrency = (userPreferences?.preferred_currency as Currency) || listing?.currency || 'USD';

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const { data, error } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (order) => {
      toast({ title: 'Order placed!', description: 'Waiting for seller approval' });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      navigate(`/orders`);
    },
    onError: (error: any) => {
      toast({
        title: 'Order failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from('user_favorites')
        .select('id')
        .eq('user_id', user?.id)
        .eq('listing_id', id)
        .maybeSingle();

      if (existing) {
        await supabase.from('user_favorites').delete().eq('id', existing.id);
      } else {
        await supabase.from('user_favorites').insert([{
          user_id: user?.id,
          listing_id: id
        }]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    }
  });

  const handleOrder = () => {
    if (!user) {
      toast({ title: 'Please sign in', description: 'You need to be logged in to place an order' });
      navigate('/auth');
      return;
    }

    if (listing.price_type === 'negotiable') {
      setShowNegotiation(true);
      return;
    }

    const orderData = {
      buyer_id: user.id,
      seller_id: listing.seller_id,
      listing_id: listing.id,
      original_price: listing.price,
      final_amount: listing.price * quantity,
      quantity,
      notes,
      status: 'pending',
      currency: listing.currency || 'USD'
    };

    createOrderMutation.mutate(orderData);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-96 bg-muted rounded-lg" />
          <div className="h-32 bg-muted rounded-lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (!listing) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Listing not found</p>
        </div>
      </DashboardLayout>
    );
  }

  const avgRating = reviews?.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  const isOwner = user?.id === listing.seller_id;
  const listingCurrency = listing.currency as Currency || 'USD';

  // Helper: Build chat link for this listing and seller
  const chatLink = `/messages?seller=${listing.seller_id}&listing=${listing.id}`;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Currency Display Banner */}
        {displayCurrency !== listingCurrency && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="py-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-blue-700">
                    Displaying prices in {displayCurrency} {CURRENCY_CONFIG[displayCurrency].symbol}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    Original: {listingCurrency}
                  </Badge>
                </div>
                <Link to="/settings">
                  <Button variant="ghost" size="sm" className="text-blue-700 hover:text-blue-800">
                    Change Currency
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Images */}
          <div className="space-y-4">
            <div className="aspect-square rounded-lg overflow-hidden bg-muted">
              {listing.images?.[selectedImage] ? (
                <img
                  src={listing.images[selectedImage]}
                  alt={listing.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-24 w-24 text-muted-foreground" />
                </div>
              )}
            </div>
            {listing.images?.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {listing.images.map((img: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 ${
                      selectedImage === idx ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    <img src={img} alt={`${listing.title} ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between mb-2">
                <h1 className="text-3xl font-bold text-foreground">{listing.title}</h1>
                {!isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleFavoriteMutation.mutate()}
                  >
                    <Heart className="h-5 w-5" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {listing.categories?.name && (
                  <Badge variant="outline">{listing.categories.name}</Badge>
                )}
                <Badge variant="secondary">{listing.type}</Badge>
                {listing.condition && (
                  <Badge variant="outline">{listing.condition}</Badge>
                )}
                {listing.currency && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {listing.currency}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-primary">
                {formatCurrency(listing.price, listingCurrency)}
              </span>
              <span className="text-lg text-muted-foreground">/ {listing.price_type}</span>
            </div>

            {/* Converted Price Display */}
            {displayCurrency !== listingCurrency && (
              <div className="text-sm text-muted-foreground">
                ≈ {formatCurrency(listing.price, displayCurrency)} in {displayCurrency}
              </div>
            )}

            <div className="space-y-2">
              <h3 className="font-semibold">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{listing.description}</p>
            </div>

            {listing.location && typeof listing.location === 'object' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{(listing.location as any).city}, {(listing.location as any).state}</span>
              </div>
            )}

            {/* Seller Info */}
            <Card>
              <CardHeader>
                <CardTitle>Seller Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={(listing as any).profiles?.avatar_url} />
                    <AvatarFallback>{(listing as any).profiles?.name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{(listing as any).profiles?.name}</p>
                    {avgRating > 0 && (
                      <div className="flex items-center gap-1 text-sm">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span>{avgRating.toFixed(1)}</span>
                        <span className="text-muted-foreground">({reviews?.length} reviews)</span>
                      </div>
                    )}
                  </div>
                  {!isOwner && (
                    <>
                      <Link to={chatLink}>
                        <Button variant="secondary" size="sm" className="mr-2">
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Open Chat
                        </Button>
                      </Link>
                      <Link to={`/profile/${listing.seller_id}`}>
                        <Button variant="outline" size="sm">View Profile</Button>
                      </Link>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Order Form */}
            {!isOwner ? (
              <Card>
                <CardHeader>
                  <CardTitle>Place Order</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Any special requirements or delivery instructions..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between py-4 border-t">
                    <div>
                      <span className="text-lg font-medium">Total:</span>
                      {displayCurrency !== listingCurrency && (
                        <div className="text-sm text-muted-foreground">
                          in {listingCurrency}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-primary">
                        {formatCurrency(listing.price * quantity, listingCurrency)}
                      </span>
                      {displayCurrency !== listingCurrency && (
                        <div className="text-sm text-muted-foreground">
                          ≈ {formatCurrency(listing.price * quantity, displayCurrency)}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleOrder}
                    disabled={createOrderMutation.isPending}
                  >
                    {listing.price_type === 'negotiable' ? 'Make Offer' : 'Place Order'}
                  </Button>
                  <div className="text-xs text-center text-muted-foreground">
                    Payment will be processed in {listingCurrency}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Link to={`/edit-listing/${listing.id}`}>
                <Button className="w-full" size="lg">Edit Listing</Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {listing && (
        <NegotiationDialog
          open={showNegotiation}
          onOpenChange={setShowNegotiation}
          listing={listing}
          quantity={quantity}
          notes={notes}
        />
      )}
    </DashboardLayout>
  );
};

export default ListingDetail;
