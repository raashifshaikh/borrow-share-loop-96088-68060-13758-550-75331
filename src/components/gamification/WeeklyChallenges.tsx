import { Zap, Target, Clock, Gift } from 'lucide-react';

interface WeeklyChallenge {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  reward: string;
  expires_in: string;
}

interface WeeklyChallengesProps {
  challenges?: WeeklyChallenge[];
  userStats?: any;
}

export const WeeklyChallenges = ({ challenges, userStats }: WeeklyChallengesProps) => {
  // Default challenges if none provided
  const defaultChallenges: WeeklyChallenge[] = [
    {
      id: 'complete_3_orders',
      title: 'Complete 3 Rentals',
      description: 'Finish 3 successful transactions this week',
      progress: userStats?.completed_orders_this_week || 0,
      target: 3,
      reward: '500 XP + Special Badge',
      expires_in: '3 days',
    },
    {
      id: 'earn_5_stars',
      title: 'Perfect Reviews',
      description: 'Get 5-star ratings on all completed orders',
      progress: userStats?.five_star_reviews_this_week || 0,
      target: 3,
      reward: '300 XP + Trust Boost',
      expires_in: '3 days',
    },
    {
      id: 'refer_friend',
      title: 'Community Builder',
      description: 'Refer a friend who completes their first rental',
      progress: userStats?.successful_referrals_this_week || 0,
      target: 1,
      reward: '400 XP + $5 Credit',
      expires_in: '3 days',
    },
  ];

  const activeChallenges = challenges || defaultChallenges;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Weekly Challenges
        </h3>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          <span>Resets in 3 days</span>
        </div>
      </div>

      <div className="grid gap-4">
        {activeChallenges.map((challenge) => {
          const progressPercentage = Math.min((challenge.progress / challenge.target) * 100, 100);
          const isCompleted = challenge.progress >= challenge.target;

          return (
            <div
              key={challenge.id}
              className={`p-4 rounded-xl border-2 ${
                isCompleted
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                  : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className={`w-4 h-4 ${
                      isCompleted ? 'text-green-600' : 'text-blue-600'
                    }`} />
                    <h4 className="font-semibold text-gray-900">{challenge.title}</h4>
                    {isCompleted && (
                      <span className="bg-green-100 text-green-600 text-xs px-2 py-1 rounded-full">
                        Completed!
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{challenge.description}</p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Progress: {challenge.progress}/{challenge.target}</span>
                    <span>Expires in: {challenge.expires_in}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium text-gray-900">{progressPercentage.toFixed(0)}%</span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      isCompleted
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                        : 'bg-gradient-to-r from-blue-500 to-purple-500'
                    }`}
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Reward</span>
                  <span className="font-medium text-yellow-600 flex items-center gap-1">
                    <Gift className="w-4 h-4" />
                    {challenge.reward}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center pt-4">
        <p className="text-sm text-gray-600">
          Complete all weekly challenges for a bonus reward!
        </p>
      </div>
    </div>
  );
};
