import { useState, useMemo, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search, Filter, Heart, MapPin, Package, Wrench, Star, Truck, Eye, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { debounce } from 'lodash';

type ListingType = 'all' | 'item' | 'service';
type CurrencyCode = 'USD' | 'INR' | 'PKR';

// Currency configuration
const CURRENCIES = {
  USD: { symbol: '$', name: 'US Dollar', icon: '💵', conversionRate: 1 },
  INR: { symbol: '₹', name: 'Indian Rupee', icon: '🇮🇳', conversionRate: 83 },
  PKR: { symbol: 'Rs', name: 'Pakistani Rupee', icon: '🇵🇰', conversionRate: 280 }
} as const;

const Browse = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [selectedType, setSelectedType] = useState<ListingType>('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [priceRange, setPriceRange] = useState([0, 1000]);
  const [deliveryFilter, setDeliveryFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>('USD');

  // Debounced search for better performance
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearchTerm(value);
    }, 300),
    []
  );

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*');
      if (error) {
        console.error('Error fetching categories:', error);
        return [];
      }
      return data || [];
    }
  });

  // Convert price based on selected currency
  const convertPrice = useCallback((price: number, fromCurrency: string, toCurrency: CurrencyCode) => {
    if (fromCurrency === toCurrency) return price;
    
    const fromRate = CURRENCIES[fromCurrency as CurrencyCode]?.conversionRate || 1;
    const toRate = CURRENCIES[toCurrency].conversionRate;
    
    return (price * fromRate) / toRate;
  }, []);

  // Format price display
  const formatPrice = useCallback((price: number, currency: CurrencyCode) => {
    const formattedPrice = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(price);
    
    return `${CURRENCIES[currency].symbol}${formattedPrice}`;
  }, []);

  // Get display price for listing
  const getDisplayPrice = useCallback((listing: any) => {
    const listingCurrency = (listing.currency as CurrencyCode) || 'USD';
    return convertPrice(listing.price, listingCurrency, selectedCurrency);
  }, [selectedCurrency, convertPrice]);

  // Fixed database query - handle currency conversion in UI only
  const { data: listings, isLoading, error } = useQuery({
    queryKey: ['listings', searchTerm, selectedCategory, sortBy, locationFilter, deliveryFilter, selectedType],
    queryFn: async () => {
      console.log('Fetching listings with filters:', {
        searchTerm,
        selectedCategory,
        locationFilter,
        deliveryFilter,
        selectedType
      });

      let query = supabase
        .from('listings')
        .select('*')
        .eq('status', 'active');

      // Text search
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      // Category filter
      if (selectedCategory !== 'all') {
        query = query.eq('category_id', selectedCategory);
      }

      // Location filter - handle both address and location columns
      if (locationFilter) {
        query = query.or(`address->>city.ilike.%${locationFilter}%,location->>city.ilike.%${locationFilter}%`);
      }

      // Delivery options filter
      if (deliveryFilter !== 'all') {
        query = query.contains('delivery_options', [deliveryFilter]);
      }

      // Type filter
      if (selectedType !== 'all') {
        query = query.eq('type', selectedType);
      }

      // Sorting
      switch (sortBy) {
        case 'price_low':
          query = query.order('price', { ascending: true });
          break;
        case 'price_high':
          query = query.order('price', { ascending: false });
          break;
        case 'popular':
          query = query.order('views_count', { ascending: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error: queryError } = await query;
      
      if (queryError) {
        console.error('Error fetching listings:', queryError);
        throw queryError;
      }

      console.log('Fetched listings:', data?.length);
      return data || [];
    },
    retry: 1
  });

  // Filter listings by price range (client-side after currency conversion)
  const filteredListingsByPrice = useMemo(() => {
    if (!listings) return [];
    
    return listings.filter(listing => {
      const displayPrice = getDisplayPrice(listing);
      return displayPrice >= priceRange[0] && displayPrice <= priceRange[1];
    });
  }, [listings, priceRange, getDisplayPrice]);

  // Get category names for display
  const { data: categoryMap } = useQuery({
    queryKey: ['category-map'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('id, name');
      const map = new Map();
      data?.forEach(cat => map.set(cat.id, cat.name));
      return map;
    }
  });

  // Enhanced categorization with better logic
  const categorizeListings = useCallback((listings: any[]) => {
    const items = listings?.filter(listing => listing.type === 'item') || [];
    const services = listings?.filter(listing => listing.type === 'service') || [];
    return { items, services };
  }, []);

  const { items, services } = useMemo(() => 
    categorizeListings(filteredListingsByPrice || []), 
    [filteredListingsByPrice, categorizeListings]
  );

  // Filter listings based on selected type
  const filteredListings = selectedType === 'all' 
    ? filteredListingsByPrice 
    : selectedType === 'item' 
      ? items 
      : services;

  // Currency selector component
  const CurrencySelector = () => {
    return (
      <Select value={selectedCurrency} onValueChange={(value: CurrencyCode) => setSelectedCurrency(value)}>
        <SelectTrigger className="min-w-[130px]">
          <div className="flex items-center gap-2">
            <span className="text-sm">{CURRENCIES[selectedCurrency].icon}</span>
            <SelectValue placeholder="Currency" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(CURRENCIES).map(([code, currency]) => (
            <SelectItem key={code} value={code} className="text-sm">
              <div className="flex items-center gap-2">
                <span className="text-sm">{currency.icon}</span>
                <span>{currency.name} ({currency.symbol})</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const getConditionColor = (condition: string) => {
    const colors = {
      new: 'bg-green-100 text-green-800 border-green-200',
      like_new: 'bg-blue-100 text-blue-800 border-blue-200',
      good: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      fair: 'bg-orange-100 text-orange-800 border-orange-200',
      poor: 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[condition as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getDeliveryBadge = (deliveryOptions: string[]) => {
    if (!deliveryOptions || !Array.isArray(deliveryOptions)) {
      return { text: 'Pickup Only', color: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
    if (deliveryOptions.includes('both')) {
      return { text: 'Pickup & Delivery', color: 'bg-purple-100 text-purple-800 border-purple-200' };
    }
    if (deliveryOptions.includes('delivery')) {
      return { text: 'Delivery Available', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    }
    return { text: 'Pickup Only', color: 'bg-gray-100 text-gray-800 border-gray-200' };
  };

  const getLocationInfo = (listing: any) => {
    // Handle both address and location columns
    const location = listing.address || listing.location;
    if (!location) return null;
    
    if (typeof location === 'object') {
      return {
        city: location.city,
        state: location.state,
        area: location.area
      };
    }
    return null;
  };

  const getCurrencyIcon = (currencyCode: string) => {
    return CURRENCIES[currencyCode as CurrencyCode]?.icon || '💵';
  };

  const renderListingCard = (listing: any) => {
    const deliveryBadge = getDeliveryBadge(listing.delivery_options);
    const conditionBadge = listing.condition ? getConditionColor(listing.condition) : '';
    const locationInfo = getLocationInfo(listing);
    const categoryName = categoryMap?.get(listing.category_id);
    
    // Get display price
    const displayPrice = getDisplayPrice(listing);
    const listingCurrency = (listing.currency as CurrencyCode) || 'USD';
    const currencyIcon = getCurrencyIcon(listingCurrency);
    
    return (
      <Card 
        key={listing.id} 
        className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full flex flex-col border border-gray-200"
      >
        <div className="relative overflow-hidden rounded-t-lg">
          {listing.images?.[0] ? (
            <div className="relative overflow-hidden">
              <img
                src={listing.images[0]}
                alt={listing.title}
                className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
            </div>
          ) : (
            <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <Package className="h-12 w-12 text-gray-400" />
            </div>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 bg-white/90 hover:bg-white shadow-sm hover:scale-110 transition-all duration-200 h-8 w-8"
          >
            <Heart className="h-4 w-4" />
          </Button>

          {/* Condition Badge */}
          {listing.condition && (
            <Badge 
              className={`absolute top-2 left-2 capitalize border text-xs ${conditionBadge}`}
            >
              {listing.condition.replace('_', ' ')}
            </Badge>
          )}

          {/* Delivery Badge */}
          <Badge 
            className={`absolute bottom-2 left-2 text-xs border ${deliveryBadge.color}`}
          >
            <Truck className="h-3 w-3 mr-1" />
            {deliveryBadge.text}
          </Badge>

          {/* Currency Badge */}
          <Badge 
            variant="secondary" 
            className="absolute top-2 right-10 text-xs border bg-white/90"
          >
            <span className="mr-1">{currencyIcon}</span>
            {listingCurrency}
          </Badge>
        </div>
        
        <CardHeader className="pb-3 flex-grow-0 space-y-2 px-4 pt-4">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 text-sm leading-tight flex-1 mr-2">
              {listing.title}
            </h3>
            <div className="text-right flex-shrink-0">
              <div className="font-bold text-base text-green-600 flex items-center gap-1 justify-end">
                <span>{formatPrice(displayPrice, selectedCurrency)}</span>
              </div>
              <div className="text-xs text-muted-foreground capitalize">
                {listing.price_type?.replace('_', ' ') || 'fixed'}
                {listing.price_type === 'negotiable' && ' • Best offer'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {categoryName && (
                <Badge variant="outline" className="text-xs">
                  {categoryName}
                </Badge>
              )}
            </div>
            
            <Badge 
              variant={listing.type === 'service' ? 'secondary' : 'default'} 
              className="text-xs capitalize"
            >
              {listing.type}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="pb-3 flex-grow space-y-3 px-4">
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {listing.description}
          </p>
          
          {/* Location Information */}
          {locationInfo && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium text-foreground text-xs">
                  {locationInfo.city}{locationInfo.state ? `, ${locationInfo.state}` : ''}
                </div>
                {locationInfo.area && (
                  <div className="text-xs">{locationInfo.area}</div>
                )}
              </div>
            </div>
          )}

          {/* Original Price in Listing Currency */}
          {listingCurrency !== selectedCurrency && (
            <div className="text-xs text-muted-foreground">
              Original: {CURRENCIES[listingCurrency].symbol}{listing.price} {listingCurrency}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {listing.views_count > 0 && (
              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                <span>{listing.views_count} views</span>
              </div>
            )}
          </div>
        </CardContent>
        
        <CardFooter className="pt-3 border-t border-gray-100 px-4 pb-4">
          <Link to={`/listing/${listing.id}`} className="w-full">
            <Button 
              className="w-full transition-all duration-200 hover:scale-105 text-sm" 
              variant={listing.type === 'service' ? 'default' : 'outline'}
              size="sm"
            >
              {listing.type === 'service' ? 'Book Service' : 'View Details'}
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  };

  const LoadingSkeleton = () => (
    <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="animate-pulse overflow-hidden">
          <div className="h-48 bg-gradient-to-br from-gray-200 to-gray-300" />
          <CardHeader className="space-y-3 px-4 pt-4">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="flex justify-between">
              <div className="h-3 bg-gray-200 rounded w-1/3" />
              <div className="h-4 bg-gray-200 rounded w-1/4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2 px-4">
            <div className="h-3 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-200 rounded w-2/3" />
            <div className="h-8 bg-gray-200 rounded w-full mt-4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const clearFilters = () => {
    setSearchTerm('');
    setLocationFilter('');
    setSelectedType('all');
    setSelectedCategory('all');
    setPriceRange([0, 1000]);
    setDeliveryFilter('all');
  };

  const hasActiveFilters = searchTerm || locationFilter || selectedType !== 'all' || selectedCategory !== 'all' || priceRange[1] < 1000 || deliveryFilter !== 'all';

  // Update price range label based on selected currency
  const priceRangeLabel = `${formatPrice(priceRange[0], selectedCurrency)} - ${formatPrice(priceRange[1], selectedCurrency)}`;

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6 min-h-screen pb-8">
        {/* Header */}
        <div className="text-center space-y-2 px-4">
          <h1 className="text-2xl md:text-4xl font-bold text-foreground">
            Discover & Share
          </h1>
          <p className="text-muted-foreground text-sm md:text-lg">
            Find amazing items to borrow or services you need
          </p>
        </div>

        {/* Mobile Filter Toggle */}
        <div className="px-4 md:hidden">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="w-full flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center">
                !
              </Badge>
            )}
          </Button>
        </div>

        {/* Search and Filters */}
        <div className={`space-y-4 p-4 md:p-6 bg-white border-b md:border md:rounded-2xl ${showFilters ? 'block' : 'hidden md:block'}`}>
          {/* Main Search Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items or services..."
                onChange={(e) => debouncedSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Location Filter */}
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="City or area..."
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Type Filter */}
            <Select value={selectedType} onValueChange={(value: ListingType) => setSelectedType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="item">Items</SelectItem>
                <SelectItem value="service">Services</SelectItem>
              </SelectContent>
            </Select>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Currency Selector */}
            <CurrencySelector />
          </div>

          {/* Advanced Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 pt-4 border-t border-gray-200">
            {/* Price Range */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                Price: {priceRangeLabel}
              </label>
              <Slider
                value={priceRange}
                onValueChange={setPriceRange}
                max={1000}
                step={10}
              />
              <p className="text-xs text-muted-foreground">
                Filtering in {selectedCurrency}
              </p>
            </div>

            {/* Delivery Options */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Delivery</label>
              <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
                <SelectTrigger>
                  <Truck className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Delivery Options" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Options</SelectItem>
                  <SelectItem value="pickup">Pickup Only</SelectItem>
                  <SelectItem value="delivery">Delivery Available</SelectItem>
                  <SelectItem value="both">Pickup & Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Options */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Sort By</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Newest First</SelectItem>
                  <SelectItem value="price_low">Price: Low to High</SelectItem>
                  <SelectItem value="price_high">Price: High to Low</SelectItem>
                  <SelectItem value="popular">Most Popular</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters & Clear */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="text-sm text-muted-foreground">
                Active filters applied
              </div>
              <Button variant="ghost" size="sm" onClick={clearFilters} className="flex items-center gap-2">
                <X className="h-4 w-4" />
                Clear All
              </Button>
            </div>
          )}
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between px-4">
          <div className="text-sm text-muted-foreground">
            {isLoading ? 'Loading...' : `${filteredListings?.length || 0} results`}
            {locationFilter && ` in ${locationFilter}`}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Displaying prices in:</span>
            <Badge variant="outline" className="text-xs">
              {CURRENCIES[selectedCurrency].icon} {selectedCurrency}
            </Badge>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mx-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-800 text-sm">
              <strong>Error loading listings:</strong> Please check your connection and try again.
            </div>
          </div>
        )}

        {/* Listings Display */}
        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <Tabs defaultValue="all" className="space-y-4 md:space-y-6 px-4">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-lg">
              <TabsTrigger value="all" className="text-xs md:text-sm">
                All ({filteredListingsByPrice?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="items" className="text-xs md:text-sm flex items-center gap-1">
                <Package className="h-3 w-3 md:h-4 md:w-4" />
                Items ({items.length})
              </TabsTrigger>
              <TabsTrigger value="services" className="text-xs md:text-sm flex items-center gap-1">
                <Wrench className="h-3 w-3 md:h-4 md:w-4" />
                Services ({services.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4 md:space-y-6">
              {filteredListings?.length === 0 ? (
                <div className="text-center py-8 md:py-16 space-y-4">
                  <div className="w-16 h-16 md:w-24 md:h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                    <Search className="h-8 w-8 md:h-10 md:w-10 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No listings found</h3>
                    <p className="text-muted-foreground text-sm md:text-base">
                      Try adjusting your filters or search terms.
                    </p>
                  </div>
                  {hasActiveFilters && (
                    <Button variant="outline" onClick={clearFilters}>
                      Clear All Filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredListings?.map(renderListingCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="items" className="space-y-4 md:space-y-6">
              {items.length === 0 ? (
                <div className="text-center py-8 md:py-16 space-y-4">
                  <Package className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground mx-auto" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No items found</h3>
                    <p className="text-muted-foreground">Try adjusting your filters.</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map(renderListingCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="services" className="space-y-4 md:space-y-6">
              {services.length === 0 ? (
                <div className="text-center py-8 md:py-16 space-y-4">
                  <Wrench className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground mx-auto" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No services found</h3>
                    <p className="text-muted-foreground">Try adjusting your filters.</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {services.map(renderListingCard)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Browse;
