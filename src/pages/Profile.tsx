import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { 
  Star, MapPin, Phone, Mail, Camera, Edit, Globe, Calendar, 
  Trophy, Award, Users, BarChart3, Settings, Link2,
  Shield, TrendingUp, Clock, Eye, DollarSign
} from 'lucide-react';

const Profile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch user profile
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

  // Fetch user level and XP
  const { data: userLevel } = useQuery({
    queryKey: ['user-level', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('user_levels')
        .select('*')
        .eq('user_id', user.id)
        .single();
      return data || { level: 1, xp: 0, title: 'Rookie', xp_to_next_level: 1000, total_xp_earned: 0 };
    },
    enabled: !!user?.id
  });

  // Fetch user badges
  const { data: userBadges } = useQuery({
    queryKey: ['user-badges', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('user_badges')
        .select(`
          *,
          badges (*)
        `)
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false });
      return data || [];
    },
    enabled: !!user?.id
  });

  // Fetch social links
  const { data: socialLinks } = useQuery({
    queryKey: ['social-links', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('social_links')
        .select('*')
        .eq('user_id', user.id)
        .order('display_order');
      return data || [];
    },
    enabled: !!user?.id
  });

  // Fetch user listings for stats
  const { data: userListings } = useQuery({
    queryKey: ['user-listings', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('listings')
        .select('*')
        .eq('seller_id', user.id);
      return data || [];
    },
    enabled: !!user?.id
  });

  // Fetch reviews
  const { data: reviews } = useQuery({
    queryKey: ['user-reviews', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('reviews')
        .select(`
          *,
          listings(title),
          profiles:reviewer_id(name, avatar_url)
        `)
        .eq('reviewed_user_id', user.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user?.id
  });

  // Fetch profile preferences
  const { data: preferences } = useQuery({
    queryKey: ['profile-preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profile_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      return data || {
        email_notifications: true,
        push_notifications: true,
        show_online_status: true,
        profile_visibility: 'public',
        language: 'en',
        timezone: 'UTC'
      };
    },
    enabled: !!user?.id
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: any) => {
      const { error } = await supabase
        .from('profiles')
        .upsert([{ ...profileData, id: user?.id }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Profile updated", description: "Your profile has been successfully updated" });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
    onError: (error: any) => {
      toast({ title: "Error updating profile", description: error.message, variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    updateProfileMutation.mutate({
      name: formData.get('name'),
      bio: formData.get('bio'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      website_url: formData.get('website_url'),
      location: formData.get('location'),
      preferred_language: formData.get('preferred_language'),
      timezone: formData.get('timezone')
    });
  };

  // Calculate stats
  const averageRating = reviews && reviews.length > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  const activeListings = userListings?.filter(listing => listing.status === 'active') || [];
  const totalRevenue = userListings?.reduce((sum, listing) => sum + (listing.price || 0), 0) || 0;

  const xpProgress = userLevel ? (userLevel.xp / userLevel.xp_to_next_level) * 100 : 0;

  const ratingDistribution = [0, 0, 0, 0, 0];
  reviews?.forEach(review => {
    if (review.rating >= 1 && review.rating <= 5) {
      ratingDistribution[review.rating - 1]++;
    }
  });

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Profile Header */}
        <Card className="relative overflow-hidden">
          {profile?.profile_color && (
            <div 
              className="absolute top-0 left-0 w-full h-2"
              style={{ backgroundColor: profile.profile_color }}
            />
          )}
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Avatar Section */}
              <div className="flex flex-col items-center md:items-start space-y-4">
                <div className="relative">
                  <div className={`relative rounded-full p-1 ${profile?.profile_frame === 'premium' ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : profile?.profile_frame === 'vip' ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'border-2 border-gray-200'}`}>
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={profile?.avatar_url} />
                      <AvatarFallback className="text-2xl">
                        {profile?.name?.[0] || user?.email?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <Button size="icon" variant="outline" className="absolute -bottom-2 -right-2 h-8 w-8">
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Level Badge */}
                <div className="text-center">
                  <Badge variant="secondary" className="mb-1">
                    Level {userLevel?.level || 1}
                  </Badge>
                  <div className="w-32">
                    <Progress value={xpProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">
                      {userLevel?.xp || 0}/{userLevel?.xp_to_next_level || 1000} XP
                    </p>
                  </div>
                </div>

                {profile?.is_verified && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Verified
                  </Badge>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1">
                {isEditing ? (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Full Name</Label>
                        <Input id="name" name="name" defaultValue={profile?.name || ''} />
                      </div>
                      <div>
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" name="email" type="email" defaultValue={profile?.email || user?.email || ''} />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <Input id="phone" name="phone" defaultValue={profile?.phone || ''} />
                      </div>
                      <div>
                        <Label htmlFor="location">Location</Label>
                        <Input id="location" name="location" defaultValue={profile?.location || ''} />
                      </div>
                      <div>
                        <Label htmlFor="website_url">Website</Label>
                        <Input id="website_url" name="website_url" defaultValue={profile?.website_url || ''} />
                      </div>
                      <div>
                        <Label htmlFor="preferred_language">Language</Label>
                        <Input id="preferred_language" name="preferred_language" defaultValue={profile?.preferred_language || 'en'} />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea id="bio" name="bio" placeholder="Tell us about yourself..." defaultValue={profile?.bio || ''} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={updateProfileMutation.isPending}>
                        {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h1 className="text-3xl font-bold">
                            {profile?.name || 'Anonymous User'}
                          </h1>
                          {profile?.custom_title && (
                            <Badge variant="outline" className="text-xs">
                              {profile.custom_title}
                            </Badge>
                          )}
                        </div>
                        {userLevel?.title && (
                          <p className="text-lg text-muted-foreground">{userLevel.title}</p>
                        )}
                      </div>
                      <Button onClick={() => setIsEditing(true)} variant="outline">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Profile
                      </Button>
                    </div>

                    {/* Contact & Info */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
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
                      {profile?.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {profile.location}
                        </div>
                      )}
                      {profile?.website_url && (
                        <div className="flex items-center gap-1">
                          <Globe className="h-4 w-4" />
                          <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            Website
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Rating & Trust */}
                    <div className="flex items-center gap-6">
                      {averageRating > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center">
                            <Star className="h-4 w-4 fill-current text-yellow-400" />
                            <span className="ml-1 font-medium">{averageRating.toFixed(1)}</span>
                          </div>
                          <span className="text-muted-foreground">
                            ({reviews?.length} review{reviews?.length !== 1 ? 's' : ''})
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-blue-500" />
                        <span>Trust Score: {profile?.trust_score || 50}/100</span>
                      </div>
                      {profile?.streak_days > 0 && (
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          <span>Streak: {profile.streak_days} days</span>
                        </div>
                      )}
                    </div>

                    {profile?.bio && (
                      <p className="text-muted-foreground">{profile.bio}</p>
                    )}

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <DollarSign className="h-6 w-6 mx-auto mb-2 text-green-500" />
                        <div className="text-xl font-bold">${profile?.wallet_balance || 0}</div>
                        <div className="text-sm text-muted-foreground">Wallet</div>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <BarChart3 className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                        <div className="text-xl font-bold">{activeListings.length}</div>
                        <div className="text-sm text-muted-foreground">Active Listings</div>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <Users className="h-6 w-6 mx-auto mb-2 text-purple-500" />
                        <div className="text-xl font-bold">{reviews?.length || 0}</div>
                        <div className="text-sm text-muted-foreground">Reviews</div>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <Trophy className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
                        <div className="text-xl font-bold">{userBadges?.length || 0}</div>
                        <div className="text-sm text-muted-foreground">Badges</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="achievements" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Achievements
            </TabsTrigger>
            <TabsTrigger value="reviews" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Reviews
            </TabsTrigger>
            <TabsTrigger value="listings" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              My Listings
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Rating Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Rating Distribution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <div key={rating} className="flex items-center gap-3">
                      <div className="flex items-center w-16">
                        <span className="text-sm w-4">{rating}</span>
                        <Star className="h-3 w-3 fill-current text-yellow-400 ml-1" />
                      </div>
                      <Progress 
                        value={(ratingDistribution[rating-1] / (reviews?.length || 1)) * 100} 
                        className="flex-1 h-2"
                      />
                      <span className="text-sm text-muted-foreground w-8">
                        {ratingDistribution[rating-1]}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-full">
                        <Eye className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">Profile viewed 12 times</p>
                        <p className="text-sm text-muted-foreground">This week</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-full">
                        <Star className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">New review received</p>
                        <p className="text-sm text-muted-foreground">2 days ago</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-full">
                        <Award className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium">New badge earned</p>
                        <p className="text-sm text-muted-foreground">Power User</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Social Links */}
            {socialLinks && socialLinks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Social Links</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {socialLinks.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                      >
                        <Link2 className="h-4 w-4" />
                        <span className="capitalize">{link.platform}</span>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Badges & Achievements</CardTitle>
                <CardDescription>
                  Earn badges by being an active community member
                </CardDescription>
              </CardHeader>
              <CardContent>
                {userBadges && userBadges.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {userBadges.map((userBadge) => (
                      <div key={userBadge.id} className="border rounded-lg p-4 text-center">
                        <div className="text-3xl mb-2">{userBadge.badges?.icon}</div>
                        <h3 className="font-semibold">{userBadge.badges?.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {userBadge.badges?.description}
                        </p>
                        <Badge variant="outline" className="mt-2">
                          {userBadge.badges?.rarity}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-2">
                          Earned {new Date(userBadge.earned_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No badges earned yet.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Complete transactions and be active to earn badges!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Reviews & Feedback</CardTitle>
                <CardDescription>
                  What others are saying about your listings and services
                </CardDescription>
              </CardHeader>
              <CardContent>
                {reviews?.length === 0 ? (
                  <div className="text-center py-8">
                    <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No reviews yet.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Complete some transactions to get feedback!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {reviews?.map((review) => (
                      <div key={review.id} className="border-b border-border pb-6 last:border-0 last:pb-0">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={review.profiles?.avatar_url} />
                              <AvatarFallback>
                                {review.profiles?.name?.[0] || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{review.profiles?.name || 'Anonymous'}</p>
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
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(review.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Listings Tab */}
          <TabsContent value="listings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>My Listings</CardTitle>
                <CardDescription>
                  Manage your active and past listings
                </CardDescription>
              </CardHeader>
              <CardContent>
                {userListings && userListings.length > 0 ? (
                  <div className="space-y-4">
                    {userListings.map((listing) => (
                      <div key={listing.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          {listing.images?.[0] ? (
                            <img
                              src={listing.images[0]}
                              alt={listing.title}
                              className="w-16 h-16 object-cover rounded"
                            />
                          ) : (
                            <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                              <span className="text-muted-foreground text-xs">No image</span>
                            </div>
                          )}
                          <div>
                            <h3 className="font-semibold">{listing.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              ${listing.price} • {listing.status}
                            </p>
                          </div>
                        </div>
                        <Badge variant={listing.status === 'active' ? 'default' : 'secondary'}>
                          {listing.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No listings yet.</p>
                    <Button className="mt-4">Create Your First Listing</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>
                  Manage your account preferences and privacy settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold">Notification Preferences</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="email-notifications">Email Notifications</Label>
                      <Input
                        id="email-notifications"
                        type="checkbox"
                        defaultChecked={preferences?.email_notifications}
                        className="w-4 h-4"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="push-notifications">Push Notifications</Label>
                      <Input
                        id="push-notifications"
                        type="checkbox"
                        defaultChecked={preferences?.push_notifications}
                        className="w-4 h-4"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="online-status">Show Online Status</Label>
                      <Input
                        id="online-status"
                        type="checkbox"
                        defaultChecked={preferences?.show_online_status}
                        className="w-4 h-4"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="font-semibold">Privacy Settings</h3>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="profile-visibility">Profile Visibility</Label>
                      <select
                        id="profile-visibility"
                        defaultValue={preferences?.profile_visibility}
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="public">Public</option>
                        <option value="community">Community Only</option>
                        <option value="private">Private</option>
                      </select>
                    </div>
                  </div>
                </div>

                <Button>Save Preferences</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Profile;
