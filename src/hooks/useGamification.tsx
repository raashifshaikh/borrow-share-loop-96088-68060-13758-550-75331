import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const useGamification = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user level and XP
  const { data: userLevel, isLoading: levelLoading } = useQuery({
    queryKey: ['user-level', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_levels')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch user badges
  const { data: userBadges = [], isLoading: badgesLoading } = useQuery({
    queryKey: ['user-badges', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_badges')
        .select(`
          *,
          badges:badge_id (*)
        `)
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch all available badges
  const { data: allBadges = [] } = useQuery({
    queryKey: ['all-badges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('badges')
        .select('*')
        .order('requirement_value', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Fetch referrals
  const { data: referrals = [] } = useQuery({
    queryKey: ['referrals', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch user statistics from orders and activities
  const { data: userStats } = useQuery({
    queryKey: ['user-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get completed orders count
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('status')
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

      if (ordersError) throw ordersError;

      const completedOrders = orders?.filter(order => 
        order.status === 'completed' || order.status === 'delivered'
      ).length || 0;

      // Get user profile for streak data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('streak_days, trust_score')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') throw profileError;

      return {
        completed_orders: completedOrders,
        total_orders: orders?.length || 0,
        streak_days: profile?.streak_days || 0,
        trust_score: profile?.trust_score || 50,
      };
    },
    enabled: !!user?.id,
  });

  // Fetch leaderboard data
  const { data: leaderboardData = [] } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_levels')
        .select(`
          level,
          xp,
          profiles!inner (
            id,
            name,
            avatar_url
          )
        `)
        .order('xp', { ascending: false })
        .limit(50);

      if (error) throw error;

      return data.map((item, index) => ({
        id: item.profiles.id,
        name: item.profiles.name,
        avatar_url: item.profiles.avatar_url,
        level: item.level,
        xp: item.xp,
        position: index + 1,
        change: '+0' // You'd need historical data for real change values
      }));
    },
  });

  // Award XP mutation
  const awardXP = useMutation({
    mutationFn: async (xpAmount: number) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase.rpc('award_xp', {
        p_user_id: user.id,
        p_xp: xpAmount,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-level', user?.id] });
      toast.success('XP Earned!');
    },
  });

  // Calculate progress to next level
  const getNextLevelXP = (currentLevel: number) => {
    return Math.ceil(Math.pow((currentLevel + 1), 1/0.7) * 100);
  };

  const getCurrentLevelXP = (currentLevel: number) => {
    return Math.ceil(Math.pow(currentLevel, 1/0.7) * 100);
  };

  const progressToNextLevel = userLevel 
    ? ((userLevel.xp - getCurrentLevelXP(userLevel.level)) / 
       (getNextLevelXP(userLevel.level) - getCurrentLevelXP(userLevel.level))) * 100
    : 0;

  return {
    userLevel,
    userBadges,
    allBadges,
    referrals,
    userStats,
    leaderboardData,
    levelLoading,
    badgesLoading,
    awardXP: awardXP.mutate,
    progressToNextLevel,
    nextLevelXP: userLevel ? getNextLevelXP(userLevel.level) : 0,
    streakDays: userStats?.streak_days || 0,
  };
};
