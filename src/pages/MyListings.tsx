import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Edit, Eye, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const MyListings = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: listings, isLoading, refetch } = useQuery({
    queryKey: ['my-listings', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data } = await supabase
        .from('listings')
        .select(`
          *,
          categories (name)
        `)
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      return data || [];
    },
    enabled: !!user?.id
  });

  const handleDelete = async (listingId: string) => {
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', listingId);

    if (error) {
      toast({
        title: "Error deleting listing",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Listing deleted",
        description: "Your listing has been removed"
      });
      refetch();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'inactive': return 'secondary';
      case 'completed': return 'outline';
      default: return 'default';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Listings</h1>
            <p className="text-muted-foreground">Manage your shared items and services</p>
          </div>
          <Link to="/create-listing">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Listing
            </Button>
          </Link>
        </div>

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
        ) : listings?.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-lg font-medium mb-2">No listings yet</h3>
              <p className="text-muted-foreground mb-4">
                Start sharing your items and services with the community
              </p>
              <Link to="/create-listing">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Listing
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {listings?.map((listing) => (
              <Card key={listing.id}>
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
                  <Badge 
                    variant={getStatusColor(listing.status)}
                    className="absolute top-2 right-2"
                  >
                    {listing.status}
                  </Badge>
                </div>
                
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-foreground truncate">
                      {listing.title}
                    </h3>
                    <Badge variant="outline">
                      ${listing.price}/{listing.price_type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {listing.categories?.name && (
                      <span>{listing.categories.name}</span>
                    )}
                    <span>•</span>
                    <span>{listing.views_count} views</span>
                  </div>
                </CardHeader>
                
                <CardContent className="pb-2">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {listing.description}
                  </p>
                </CardContent>
                
                <CardFooter className="flex gap-2">
                  <Link to={`/listing/${listing.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </Link>
                  <Link to={`/edit-listing/${listing.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDelete(listing.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MyListings;