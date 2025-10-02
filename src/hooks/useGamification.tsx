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
    levelLoading,
    badgesLoading,
    awardXP: awardXP.mutate,
    progressToNextLevel,
    nextLevelXP: userLevel ? getNextLevelXP(userLevel.level) : 0,
  };
};
