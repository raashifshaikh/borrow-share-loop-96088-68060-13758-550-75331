import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';
import { Heart, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Favorites = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: favorites, isLoading } = useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_favorites')
        .select(`
          id,
          listing_id,
          created_at,
          listings (
            id,
            title,
            description,
            price,
            currency,
            images,
            type,
            status,
            seller_id,
            profiles (name)
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      return data;
    },
    enabled: !!user?.id
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: async (favoriteId: string) => {
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('id', favoriteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      toast({ title: 'Removed from favorites' });
    }
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Favorites</h1>
            <p className="text-muted-foreground">Items you've saved for later</p>
          </div>
          <Heart className="h-8 w-8 text-primary" />
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-muted rounded-t-lg" />
                <CardContent className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : favorites?.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No favorites yet</h3>
              <p className="text-muted-foreground mb-4">
                Start browsing to find items you love
              </p>
              <Link to="/browse">
                <Button>Browse Items</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {favorites?.map((favorite: any) => (
              <Card key={favorite.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <Link to={`/listing/${favorite.listing_id}`}>
                  <div className="relative h-48 bg-muted">
                    {favorite.listings?.images?.[0] && (
                      <img
                        src={favorite.listings.images[0]}
                        alt={favorite.listings.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                </Link>
                <CardContent className="p-4">
                  <Link to={`/listing/${favorite.listing_id}`}>
                    <h3 className="font-semibold text-lg mb-2 hover:text-primary transition-colors">
                      {favorite.listings?.title}
                    </h3>
                  </Link>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {favorite.listings?.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-primary">
                      {favorite.listings?.currency} {favorite.listings?.price}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFavoriteMutation.mutate(favorite.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Favorites;
