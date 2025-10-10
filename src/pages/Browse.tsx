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
import { Search, Filter, Heart, MapPin, Package, Wrench, Star, Clock, Truck, Shield, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { debounce } from 'lodash';

type ListingType = 'all' | 'item' | 'service';

const Browse = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [selectedType, setSelectedType] = useState<ListingType>('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [priceRange, setPriceRange] = useState([0, 1000]);
  const [deliveryFilter, setDeliveryFilter] = useState('all');

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

  const { data: listings, isLoading } = useQuery({
    queryKey: ['listings', searchTerm, selectedCategory, sortBy, locationFilter, priceRange, deliveryFilter],
    queryFn: async () => {
      let query = supabase
        .from('listings')
        .select(`
          *,
          categories (name, icon),
          profiles:seller_id (username, avatar_url, rating)
        `)
        .eq('status', 'active');

      // Text search
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      // Category filter
      if (selectedCategory !== 'all') {
        query = query.eq('category_id', selectedCategory);
      }

      // Price range filter
      if (priceRange[1] < 1000) {
        query = query.gte('price', priceRange[0]).lte('price', priceRange[1]);
      }

      // Location filter
      if (locationFilter) {
        query = query.ilike('address->>city', `%${locationFilter}%`);
      }

      // Delivery options filter
      if (deliveryFilter !== 'all') {
        query = query.contains('delivery_options', [deliveryFilter]);
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
        case 'rating':
          query = query.order('profiles(rating)', { ascending: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching listings:', error);
        return [];
      }
      return data || [];
    }
  });

  // Enhanced categorization with better logic
  const categorizeListings = useCallback((listings: any[]) => {
    const items = listings?.filter(listing => {
      // Use the actual type field from database
      return listing.type === 'item';
    }) || [];

    const services = listings?.filter(listing => {
      return listing.type === 'service';
    }) || [];

    return { items, services };
  }, []);

  const { items, services } = useMemo(() => 
    categorizeListings(listings || []), 
    [listings, categorizeListings]
  );

  // Filter listings based on selected type
  const filteredListings = selectedType === 'all' 
    ? listings 
    : selectedType === 'item' 
      ? items 
      : services;

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
    if (deliveryOptions.includes('both')) {
      return { text: 'Pickup & Delivery', color: 'bg-purple-100 text-purple-800 border-purple-200' };
    }
    if (deliveryOptions.includes('delivery')) {
      return { text: 'Delivery Available', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    }
    return { text: 'Pickup Only', color: 'bg-gray-100 text-gray-800 border-gray-200' };
  };

  const renderListingCard = (listing: any) => {
    const deliveryBadge = getDeliveryBadge(listing.delivery_options || ['pickup']);
    const conditionBadge = listing.condition ? getConditionColor(listing.condition) : '';
    
    return (
      <Card 
        key={listing.id} 
        className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full flex flex-col border border-gray-200/50 bg-white/50 backdrop-blur-sm"
      >
        <div className="relative overflow-hidden rounded-t-lg">
          {listing.images?.[0] ? (
            <div className="relative overflow-hidden">
              <img
                src={listing.images[0]}
                alt={listing.title}
                className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          ) : (
            <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-lg flex items-center justify-center">
              <Package className="h-12 w-12 text-gray-400" />
            </div>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 bg-white/90 hover:bg-white backdrop-blur-sm shadow-lg hover:scale-110 transition-all duration-200"
          >
            <Heart className="h-4 w-4" />
          </Button>

          {/* Condition Badge */}
          {listing.condition && (
            <Badge 
              className={`absolute top-3 left-3 capitalize border ${conditionBadge}`}
              variant="secondary"
            >
              {listing.condition.replace('_', ' ')}
            </Badge>
          )}

          {/* Delivery Badge */}
          <Badge 
            className={`absolute bottom-3 left-3 text-xs border ${deliveryBadge.color}`}
            variant="secondary"
          >
            <Truck className="h-3 w-3 mr-1" />
            {deliveryBadge.text}
          </Badge>
        </div>
        
        <CardHeader className="pb-3 flex-grow-0 space-y-2">
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 text-base leading-tight">
              {listing.title}
            </h3>
            <div className="text-right ml-2">
              <div className="font-bold text-lg text-green-600">
                ${listing.price}
              </div>
              <div className="text-xs text-muted-foreground capitalize">
                {listing.price_type?.replace('_', ' ') || 'fixed'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {listing.categories?.name && (
                <Badge variant="outline" className="text-xs">
                  {listing.categories.name}
                </Badge>
              )}
            </div>
            
            {/* Seller Rating */}
            {listing.profiles?.rating && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span>{listing.profiles.rating}</span>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="pb-3 flex-grow space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {listing.description}
          </p>
          
          {/* Location Information */}
          <div className="space-y-2">
            {listing.address && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium text-foreground">
                    {listing.address.city}, {listing.address.state}
                  </div>
                  {listing.address.area && (
                    <div className="text-xs">{listing.address.area}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {listing.views_count > 0 && (
              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                <span>{listing.views_count} views</span>
              </div>
            )}
            {listing.favorites_count > 0 && (
              <div className="flex items-center gap-1">
                <Heart className="h-3 w-3" />
                <span>{listing.favorites_count} favorites</span>
              </div>
            )}
          </div>
        </CardContent>
        
        <CardFooter className="pt-3 border-t border-gray-100">
          <Link to={`/listing/${listing.id}`} className="w-full">
            <Button 
              className="w-full transition-all duration-200 hover:scale-105" 
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
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="animate-pulse overflow-hidden">
          <div className="h-48 bg-gradient-to-br from-gray-200 to-gray-300" />
          <CardHeader className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="flex justify-between">
              <div className="h-3 bg-gray-200 rounded w-1/3" />
              <div className="h-4 bg-gray-200 rounded w-1/4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-200 rounded w-2/3" />
            <div className="h-8 bg-gray-200 rounded w-full mt-4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-foreground bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Discover & Share
          </h1>
          <p className="text-muted-foreground text-lg">
            Find amazing items to borrow or services you need in your area
          </p>
        </div>

        {/* Enhanced Search and Filters */}
        <div className="space-y-4 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-100/50">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items or services..."
                onChange={(e) => debouncedSearch(e.target.value)}
                className="pl-10 bg-white/80 backdrop-blur-sm border-blue-200/50"
              />
            </div>
            
            {/* Location Filter */}
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="City or area..."
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="pl-10 bg-white/80 backdrop-blur-sm border-blue-200/50"
              />
            </div>

            {/* Type Filter */}
            <Select value={selectedType} onValueChange={(value: ListingType) => setSelectedType(value)}>
              <SelectTrigger className="bg-white/80 backdrop-blur-sm border-blue-200/50">
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
              <SelectTrigger className="bg-white/80 backdrop-blur-sm border-blue-200/50">
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
          </div>

          {/* Advanced Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-blue-200/30">
            {/* Price Range */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                Price Range: ${priceRange[0]} - ${priceRange[1]}
              </label>
              <Slider
                value={priceRange}
                onValueChange={setPriceRange}
                max={1000}
                step={10}
                className="[&_[role=slider]]:bg-primary"
              />
            </div>

            {/* Delivery Options */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Delivery</label>
              <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
                <SelectTrigger className="bg-white/80 backdrop-blur-sm border-blue-200/50">
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
                <SelectTrigger className="bg-white/80 backdrop-blur-sm border-blue-200/50">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Newest First</SelectItem>
                  <SelectItem value="price_low">Price: Low to High</SelectItem>
                  <SelectItem value="price_high">Price: High to Low</SelectItem>
                  <SelectItem value="popular">Most Popular</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {filteredListings?.length || 0} results
            {locationFilter && ` in ${locationFilter}`}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-green-600" />
            <span className="text-muted-foreground">Verified listings only</span>
          </div>
        </div>

        {/* Listings Display */}
        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <Tabs defaultValue="all" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex bg-muted/50 p-1 rounded-lg">
              <TabsTrigger 
                value="all" 
                className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200"
              >
                All Listings ({listings?.length || 0})
              </TabsTrigger>
              <TabsTrigger 
                value="items" 
                className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200"
              >
                <Package className="h-4 w-4" />
                Items ({items.length})
              </TabsTrigger>
              <TabsTrigger 
                value="services" 
                className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all duration-200"
              >
                <Wrench className="h-4 w-4" />
                Services ({services.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-6 animate-fade-in">
              {filteredListings?.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                  <div className="w-24 h-24 mx-auto bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                    <Search className="h-10 w-10 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No listings found</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Try adjusting your filters or search terms to find what you're looking for.
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSearchTerm('');
                      setLocationFilter('');
                      setSelectedCategory('all');
                      setPriceRange([0, 1000]);
                    }}
                  >
                    Clear All Filters
                  </Button>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-fade-in">
                  {filteredListings?.map(renderListingCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="items" className="space-y-6 animate-fade-in">
              {items.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                  <Package className="h-16 w-16 text-muted-foreground mx-auto" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No items found</h3>
                    <p className="text-muted-foreground">Try adjusting your filters to find items.</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-fade-in">
                  {items.map(renderListingCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="services" className="space-y-6 animate-fade-in">
              {services.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                  <Wrench className="h-16 w-16 text-muted-foreground mx-auto" />
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No services found</h3>
                    <p className="text-muted-foreground">Try adjusting your filters to find services.</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-fade-in">
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
