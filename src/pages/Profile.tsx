import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Star, MapPin, Phone, Mail, Camera, Edit } from 'lucide-react';

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      return data;
    },
    enabled: !!user?.id
  });

  const { data: reviews } = useQuery({
    queryKey: ['user-reviews', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data } = await supabase
        .from('reviews')
        .select(`
          *,
          listings(title)
        `)
        .eq('reviewed_user_id', user.id)
        .order('created_at', { ascending: false });

      return data || [];
    },
    enabled: !!user?.id
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: any) => {
      const { error } = await supabase
        .from('profiles')
        .upsert([{ ...profileData, id: user?.id }]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated"
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating profile",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    updateProfileMutation.mutate({
      name: formData.get('name'),
      bio: formData.get('bio'),
      phone: formData.get('phone'),
      email: formData.get('email')
    });
  };

  const averageRating = reviews && reviews.length > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Profile Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex flex-col items-center md:items-start">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className="text-2xl">
                      {profile?.name?.[0] || user?.email?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="icon"
                    variant="outline"
                    className="absolute -bottom-2 -right-2 h-8 w-8"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
                {profile?.is_verified && (
                  <Badge variant="outline" className="mt-2">
                    Verified
                  </Badge>
                )}
              </div>

              <div className="flex-1">
                {isEditing ? (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Full Name</Label>
                        <Input 
                          id="name" 
                          name="name" 
                          defaultValue={profile?.name || ''} 
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input 
                          id="email" 
                          name="email" 
                          type="email"
                          defaultValue={profile?.email || user?.email || ''} 
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <Input 
                          id="phone" 
                          name="phone" 
                          defaultValue={profile?.phone || ''} 
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea 
                        id="bio" 
                        name="bio" 
                        placeholder="Tell us about yourself..."
                        defaultValue={profile?.bio || ''} 
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={updateProfileMutation.isPending}>
                        {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsEditing(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h1 className="text-3xl font-bold">
                        {profile?.name || 'Anonymous User'}
                      </h1>
                      <Button onClick={() => setIsEditing(true)} variant="outline">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Profile
                      </Button>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {profile?.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-4 w-4" />
                          {profile.email}
                        </div>
                      )}
                      {profile?.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          {profile.phone}
                        </div>
                      )}
                    </div>

                    {averageRating > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          <Star className="h-4 w-4 fill-current text-yellow-400" />
                          <span className="ml-1 font-medium">
                            {averageRating.toFixed(1)}
                          </span>
                        </div>
                        <span className="text-muted-foreground">
                          ({reviews?.length} review{reviews?.length !== 1 ? 's' : ''})
                        </span>
                      </div>
                    )}

                    {profile?.bio && (
                      <p className="text-muted-foreground">{profile.bio}</p>
                    )}

                    <div className="grid grid-cols-3 gap-4 pt-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">${profile?.wallet_balance || 0}</div>
                        <div className="text-sm text-muted-foreground">Wallet Balance</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">${profile?.pending_balance || 0}</div>
                        <div className="text-sm text-muted-foreground">Pending</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{reviews?.length || 0}</div>
                        <div className="text-sm text-muted-foreground">Reviews</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reviews */}
        <Card>
          <CardHeader>
            <CardTitle>Reviews & Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            {reviews?.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No reviews yet. Complete some transactions to get feedback!
              </p>
            ) : (
              <div className="space-y-4">
                {reviews?.map((review) => (
                  <div key={review.id} className="border-b border-border pb-4 last:border-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>U</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">Reviewer</p>
                          <p className="text-sm text-muted-foreground">
                            {review.listings?.title}
                          </p>
                        </div>
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
                      <p className="text-muted-foreground">{review.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Profile;