import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search, Filter, Heart, MapPin, Package, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';

type ListingType = 'all' | 'item' | 'service';

const Browse = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<ListingType>('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('*').order('name');
      return data || [];
    }
  });

  const { data: listings, isLoading } = useQuery({
    queryKey: ['listings', searchTerm, selectedType, selectedCategory, sortBy],
    queryFn: async () => {
      let query = supabase
        .from('listings')
        .select(`
          *,
          categories (name, type)
        `)
        .eq('status', 'active');

      // Search filter
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      // Type filter (item/service)
      if (selectedType !== 'all') {
        query = query.eq('type', selectedType);
      }

      // Category filter
      if (selectedCategory !== 'all') {
        query = query.eq('category_id', selectedCategory);
      }

      // Sorting
      query = query.order(sortBy, { ascending: sortBy === 'price' });

      const { data } = await query;
      return data || [];
    }
  });

  // Filter categories based on selected type
  const filteredCategories = categories?.filter(category => {
    if (selectedType === 'all') return true;
    return category.type === selectedType;
  });

  // Group listings by type for the tab view
  const items = listings?.filter(listing => listing.type === 'item') || [];
  const services = listings?.filter(listing => listing.type === 'service') || [];

  const renderListingCard = (listing: any) => (
    <Card key={listing.id} className="group hover:shadow-lg transition-shadow h-full flex flex-col">
      <div className="relative">
        {listing.images?.[0] ? (
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="w-full h-48 object-cover rounded-t-lg"
          />
        ) : (
          <div className="w-full h-48 bg-muted rounded-t-lg flex items-center justify-center">
            <span className="text-muted-foreground">No image</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 bg-background/80 hover:bg-background"
        >
          <Heart className="h-4 w-4" />
        </Button>
        <Badge 
          className="absolute top-2 left-2 capitalize"
          variant={listing.type === 'item' ? 'default' : 'secondary'}
        >
          {listing.type}
        </Badge>
      </div>
      
      <CardHeader className="pb-2 flex-grow-0">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {listing.title}
          </h3>
          <Badge variant="outline" className="whitespace-nowrap">
            ${listing.price}/{listing.price_type}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {listing.categories?.name && (
            <span>{listing.categories.name}</span>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pb-2 flex-grow">
        <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
          {listing.description}
        </p>
        {listing.location && typeof listing.location === 'object' && 'city' in listing.location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>{(listing.location as any).city}</span>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-4">
        <Link to={`/listing/${listing.id}`} className="w-full">
          <Button className="w-full" variant={listing.type === 'service' ? 'default' : 'outline'}>
            {listing.type === 'service' ? 'Book Service' : 'View Details'}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Browse Marketplace</h1>
          <p className="text-muted-foreground">Find items to borrow or services you need</p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for items or services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={selectedType} onValueChange={(value: ListingType) => {
            setSelectedType(value);
            setSelectedCategory('all'); // Reset category when type changes
          }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="item">Items</SelectItem>
              <SelectItem value="service">Services</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {filteredCategories?.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Newest</SelectItem>
              <SelectItem value="price">Price: Low to High</SelectItem>
              <SelectItem value="views_count">Most Popular</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Listings Display */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-muted rounded-t-lg" />
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </CardHeader>
                <CardContent>
                  <div className="h-3 bg-muted rounded w-full mb-2" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Tabs defaultValue="all" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
              <TabsTrigger value="all" className="flex items-center gap-2">
                All Listings ({listings?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="items" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Items ({items.length})
              </TabsTrigger>
              <TabsTrigger value="services" className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Services ({services.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-6">
              {listings?.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No listings found matching your search.</p>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {listings?.map(renderListingCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="items" className="space-y-6">
              {items.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No items found matching your search.</p>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {items.map(renderListingCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="services" className="space-y-6">
              {services.length === 0 ? (
                <div className="text-center py-12">
                  <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No services found matching your search.</p>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
