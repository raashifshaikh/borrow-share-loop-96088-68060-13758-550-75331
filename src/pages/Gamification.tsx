import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { useGamification } from '@/hooks/useGamification';
import { XPProgressBar } from '@/components/gamification/XPProgressBar';
import { AnimatedBadge } from '@/components/gamification/AnimatedBadge';
import { SocialShare } from '@/components/gamification/SocialShare';
import { StreakTracker } from '@/components/gamification/StreakTracker';
import { Leaderboard } from '@/components/gamification/Leaderboard';
import { AchievementTracker } from '@/components/gamification/AchievementTracker';
import { WeeklyChallenges } from '@/components/gamification/WeeklyChallenges';
import { 
  Trophy, Award, Users, Zap, Crown, Sparkles, TrendingUp, 
  Clock, Star, Shield, Rocket, Target, Medal, Gift, 
  Calendar, BarChart3, TrendingUp as TrendingIcon, 
  Heart, MessageCircle, Share2, Eye, DollarSign,
  CheckCircle, Clock4, MapPin, Wrench, Home, Laptop,
  Volume2, X, Calendar as CalendarIcon, Award as AwardIcon
} from 'lucide-react';

// Badge Details Modal Component
const BadgeDetailsModal = ({ badge, isOpen, onClose, earnedAt }: { 
  badge: any; 
  isOpen: boolean; 
  onClose: () => void;
  earnedAt?: string;
}) => {
  if (!badge) return null;

  const getRarityGradient = (rarity: string) => {
    const gradients = {
      common: 'from-gray-400 to-gray-600',
      uncommon: 'from-green-400 to-green-600',
      rare: 'from-blue-400 to-blue-600',
      epic: 'from-purple-500 to-pink-500',
      legendary: 'from-yellow-400 to-orange-500'
    };
    return gradients[rarity as keyof typeof gradients] || gradients.common;
  };

  const shareData = {
    title: `I earned the ${badge.name} badge on BorrowPal!`,
    text: `🎮 I just earned the "${badge.name}" badge! ${badge.icon}\n\n"${badge.description}"\n\nJoin me and start earning rewards! #BorrowPal`,
    url: window.location.origin
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`bg-gradient-to-br ${getRarityGradient(badge.rarity)} text-white p-6 text-center`}
        >
          <DialogHeader className="flex flex-row items-center justify-between">
            <div></div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 text-white"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1 }}
            className="text-6xl mb-4"
          >
            {badge.icon}
          </motion.div>

          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold mb-2"
          >
            {badge.name}
          </motion.h2>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-white/90 text-lg mb-4"
          >
            {badge.description}
          </motion.p>
        </motion.div>

        <div className="p-6 space-y-4">
          {/* Badge Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <AwardIcon className="h-4 w-4 text-purple-600" />
              <span className="font-medium">Rarity:</span>
              <Badge variant="outline" className="capitalize">
                {badge.rarity}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-600" />
              <span className="font-medium">XP Reward:</span>
              <span className="font-bold text-green-600">+{badge.xp_reward}</span>
            </div>
          </div>

          {/* Earned Date */}
          {earnedAt && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CalendarIcon className="h-4 w-4" />
              <span>Earned on {new Date(earnedAt).toLocaleDateString()}</span>
            </div>
          )}

          {/* Share Section */}
          <div className="pt-4 border-t">
            <p className="text-sm text-gray-600 mb-3">Share your achievement!</p>
            <SocialShare shareData={shareData} badge={badge} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Gamification = () => {
  const { user, loading } = useAuth();
  const { 
    userLevel, 
    userBadges, 
    allBadges, 
    levelLoading, 
    progressToNextLevel, 
    nextLevelXP,
    userStats,
    streakDays
  } = useGamification();

  const [activeCategory, setActiveCategory] = useState('all');
  const [newBadge, setNewBadge] = useState<any>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<any>(null);
  const [showBadgeDetails, setShowBadgeDetails] = useState(false);

  // Simulate new badge earning
  useEffect(() => {
    const timer = setTimeout(() => {
      if (userBadges?.length > 0 && !newBadge) {
        const latestBadge = userBadges[0];
        setNewBadge(latestBadge.badges);
        setShowCelebration(true);
        
        setTimeout(() => {
          setShowCelebration(false);
        }, 5000);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [userBadges, newBadge]);

  const earnedBadgeIds = userBadges?.map((ub: any) => ub.badge_id) || [];
  const earnedBadges = userBadges || [];
  
  const badgeCategories = [
    { id: 'all', name: 'All Badges', icon: Trophy, count: allBadges?.length || 0 },
    { id: 'viral', name: 'Viral', icon: TrendingIcon, count: allBadges?.filter(b => b.category === 'viral').length || 0 },
    { id: 'status', name: 'Status', icon: Crown, count: allBadges?.filter(b => b.category === 'status').length || 0 },
    { id: 'community', name: 'Community', icon: Users, count: allBadges?.filter(b => b.category === 'community').length || 0 },
    { id: 'economic', name: 'Economic', icon: DollarSign, count: allBadges?.filter(b => b.category === 'economic').length || 0 },
  ];

  const filteredBadges = activeCategory === 'all' 
    ? allBadges 
    : allBadges?.filter(badge => badge.category === activeCategory);

  const totalXP = userLevel?.xp || 0;
  const rareBadges = earnedBadges.filter(b => ['epic', 'legendary'].includes(b.badges?.rarity));
  const recentBadges = [...earnedBadges].sort((a, b) => 
    new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime()
  ).slice(0, 3);

  const leaderboardData = [
    { id: '1', name: 'Alex Johnson', level: 15, xp: 12500, position: 1, change: '+2' },
    { id: '2', name: 'Sarah Miller', level: 14, xp: 11800, position: 2, change: '-1' },
    { id: '3', name: 'Mike Chen', level: 13, xp: 11200, position: 3, change: '+1' },
    ...(user ? [{ 
      id: user.id, 
      name: user.name || 'You', 
      level: userLevel?.level || 1, 
      xp: userLevel?.xp || 0, 
      position: 25,
      change: '+5'
    }] : [])
  ];

  const handleBadgeClick = (badge: any) => {
    const userBadge = userBadges?.find(ub => ub.badge_id === badge.id);
    setSelectedBadge({
      ...badge,
      earnedAt: userBadge?.earned_at
    });
    setShowBadgeDetails(true);
  };

  const handleShareBadge = (badge: any) => {
    const shareData = {
      title: `I earned the ${badge.name} badge!`,
      text: `🎮 I just earned the "${badge.name}" badge on BorrowPal! ${badge.icon}\n\n"${badge.description}"\n\nJoin me and start earning rewards!`,
      url: window.location.origin
    };

    if (navigator.share) {
      navigator.share(shareData);
    }
  };

  const shareProfileData = {
    title: 'Check out my BorrowPal achievements!',
    text: `🏆 I'm level ${userLevel?.level} on BorrowPal with ${earnedBadges.length} badges and ${totalXP} XP!\n\nJoin me in the sharing economy and earn rewards!`,
    url: window.location.origin
  };

  if (loading || levelLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center space-y-4"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="rounded-full h-16 w-16 border-b-2 border-primary mx-auto"
            />
            <p className="text-muted-foreground text-lg">Loading your gaming universe...</p>
          </motion.div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8">
        {/* Badge Details Modal */}
        <BadgeDetailsModal
          badge={selectedBadge}
          isOpen={showBadgeDetails}
          onClose={() => setShowBadgeDetails(false)}
        />

        {/* Celebration Animation for New Badge */}
        <AnimatePresence>
          {showCelebration && newBadge && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              onClick={() => setShowCelebration(false)}
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                className="bg-white rounded-3xl p-8 max-w-md mx-4 text-center shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <motion.div
                  animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: [0, 10, -10, 0]
                  }}
                  transition={{ duration: 0.5 }}
                  className="text-6xl mb-4"
                >
                  {newBadge.icon}
                </motion.div>
                
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    Badge Unlocked!
                  </h3>
                  <div className="text-xl font-semibold text-purple-600 mb-2">
                    {newBadge.name}
                  </div>
                  <p className="text-gray-600 mb-4">{newBadge.description}</p>
                  
                  <div className="flex gap-2 justify-center">
                    <SocialShare 
                      shareData={shareProfileData}
                      badge={newBadge}
                    />
                    <Button 
                      variant="outline"
                      onClick={() => setShowCelebration(false)}
                    >
                      Awesome!
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-7xl mx-auto px-4 space-y-8">
          {/* Hero Header with Share */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-center space-y-4"
          >
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Achievement Universe
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Level up your lending journey. Earn badges, climb leaderboards, and unlock exclusive rewards!
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <SocialShare shareData={shareProfileData} />
            </motion.div>
          </motion.div>

          {/* Main Stats Grid */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Level Progress */}
            <Card className="lg:col-span-2 bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
              <CardContent className="p-6">
                {userLevel && (
                  <XPProgressBar
                    level={userLevel.level}
                    xp={userLevel.xp}
                    title={userLevel.title}
                    progress={progressToNextLevel}
                    nextLevelXP={nextLevelXP}
                  />
                )}
                
                <div className="grid grid-cols-4 gap-4 mt-6">
                  {[
                    { value: earnedBadges.length, label: 'Badges', color: 'text-purple-600' },
                    { value: userStats?.completed_orders || 0, label: 'Transactions', color: 'text-blue-600' },
                    { value: totalXP.toLocaleString(), label: 'Total XP', color: 'text-green-600' },
                    { value: leaderboardData.find(u => u.id === user.id)?.position || 'N/A', label: 'Rank', color: 'text-orange-600' },
                  ].map((stat, index) => (
                    <motion.div
                      key={stat.label}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2 + index * 0.1 }}
                      className="text-center"
                    >
                      <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                      <div className="text-sm text-muted-foreground">{stat.label}</div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Streak Tracker */}
            <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
              <CardContent className="p-6">
                <StreakTracker 
                  currentStreak={streakDays || 0}
                  bestStreak={userStats?.best_streak || streakDays || 0}
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* Enhanced Badges Tab with Animations */}
          <Tabs defaultValue="badges" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 h-12">
              {[
                { value: 'badges', icon: Trophy, label: 'Badges' },
                { value: 'achievements', icon: Award, label: 'Achievements' },
                { value: 'leaderboard', icon: Crown, label: 'Leaderboard' },
                { value: 'challenges', icon: Zap, label: 'Challenges' },
                { value: 'referrals', icon: Users, label: 'Referrals' },
              ].map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Enhanced Badges Tab */}
            <TabsContent value="badges" className="space-y-6">
              {/* Category Filter */}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {badgeCategories.map((category) => (
                        <motion.div
                          key={category.id}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Button
                            variant={activeCategory === category.id ? "default" : "outline"}
                            onClick={() => setActiveCategory(category.id)}
                            className="flex items-center gap-2"
                          >
                            <category.icon className="h-4 w-4" />
                            {category.name}
                            <Badge variant="secondary" className="ml-1">
                              {category.count}
                            </Badge>
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Animated Badge Collection */}
              <Card>
                <CardHeader>
                  <CardTitle>Badge Collection</CardTitle>
                  <CardDescription>
                    You've earned {earnedBadgeIds.length} of {allBadges?.length || 0} badges
                    {rareBadges.length > 0 && ` • ${rareBadges.length} rare badges`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <motion.div 
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6"
                    layout
                  >
                    <AnimatePresence>
                      {filteredBadges?.map((badge, index) => (
                        <motion.div
                          key={badge.id}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ delay: index * 0.1 }}
                          layout
                        >
                          <AnimatedBadge
                            badge={badge}
                            isEarned={earnedBadgeIds.includes(badge.id)}
                            onShare={handleShareBadge}
                            onViewDetails={handleBadgeClick}
                            showAnimation={newBadge?.id === badge.id}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Other tabs remain similar but with motion wrappers */}
            <TabsContent value="achievements">
              {/* Add your achievements content here */}
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Gamification;
