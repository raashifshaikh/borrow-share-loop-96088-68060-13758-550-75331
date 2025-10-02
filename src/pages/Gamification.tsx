import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGamification } from '@/hooks/useGamification';
import { XPProgressBar } from '@/components/gamification/XPProgressBar';
import { BadgeCollection } from '@/components/gamification/BadgeCollection';
import { ReferralDashboard } from '@/components/gamification/ReferralDashboard';
import { Trophy, Award, Users } from 'lucide-react';

const Gamification = () => {
  const { user, loading } = useAuth();
  const { userLevel, userBadges, allBadges, levelLoading, progressToNextLevel, nextLevelXP } = useGamification();

  if (loading || levelLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const earnedBadgeIds = userBadges.map((ub: any) => ub.badge_id);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Achievements & Rewards</h1>
          <p className="text-muted-foreground">Track your progress and unlock exclusive rewards</p>
        </div>

        {userLevel && (
          <Card className="p-6">
            <XPProgressBar
              level={userLevel.level}
              xp={userLevel.xp}
              title={userLevel.title}
              progress={progressToNextLevel}
              nextLevelXP={nextLevelXP}
            />
          </Card>
        )}

        <Tabs defaultValue="badges" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="badges" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Badges
            </TabsTrigger>
            <TabsTrigger value="achievements" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              Achievements
            </TabsTrigger>
            <TabsTrigger value="referrals" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Referrals
            </TabsTrigger>
          </TabsList>

          <TabsContent value="badges" className="space-y-4">
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Badge Collection</h3>
                  <p className="text-sm text-muted-foreground">
                    You've earned {earnedBadgeIds.length} of {allBadges.length} badges
                  </p>
                </div>
                <BadgeCollection badges={allBadges} earnedBadgeIds={earnedBadgeIds} />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="achievements" className="space-y-4">
            <Card className="p-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Recent Achievements</h3>
                <div className="text-sm text-muted-foreground">
                  Complete actions to earn XP and unlock achievements!
                </div>
                <div className="grid gap-4 mt-4">
                  {userBadges.slice(0, 5).map((badge: any) => (
                    <div key={badge.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <Trophy className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold">{badge.badges?.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Earned {new Date(badge.earned_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-primary font-semibold">+{badge.badges?.xp_reward} XP</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="referrals">
            <ReferralDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Gamification;
