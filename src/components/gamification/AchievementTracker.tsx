import { Target, CheckCircle, Clock, Award } from 'lucide-react';

interface Achievement {
  id: string;
  name: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  xp_reward: number;
}

interface AchievementTrackerProps {
  userBadges?: any[];
  userStats?: any;
}

export const AchievementTracker = ({ userBadges = [], userStats }: AchievementTrackerProps) => {
  // Sample achievements based on common goals
  const achievements: Achievement[] = [
    {
      id: 'first_transaction',
      name: 'First Transaction',
      description: 'Complete your first rental',
      progress: userStats?.completed_orders > 0 ? 1 : 0,
      target: 1,
      completed: userStats?.completed_orders > 0,
      xp_reward: 100,
    },
    {
      id: 'five_star_rating',
      name: 'Five Star Rating',
      description: 'Receive a 5-star review',
      progress: userStats?.avg_rating >= 5 ? 1 : 0,
      target: 1,
      completed: userStats?.avg_rating >= 5,
      xp_reward: 150,
    },
    {
      id: 'trusted_member',
      name: 'Trusted Member',
      description: 'Reach 80+ trust score',
      progress: Math.min(userStats?.trust_score || 0, 80),
      target: 80,
      completed: (userStats?.trust_score || 0) >= 80,
      xp_reward: 200,
    },
    {
      id: 'weekly_streak',
      name: 'Weekly Streak',
      description: 'Login for 7 consecutive days',
      progress: Math.min(userStats?.streak_days || 0, 7),
      target: 7,
      completed: (userStats?.streak_days || 0) >= 7,
      xp_reward: 250,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Achievement Progress</h3>
        <div className="text-sm text-gray-600">
          {achievements.filter(a => a.completed).length} of {achievements.length} completed
        </div>
      </div>

      <div className="space-y-3">
        {achievements.map((achievement) => (
          <div
            key={achievement.id}
            className={`p-4 rounded-xl border-2 ${
              achievement.completed
                ? 'bg-green-50 border-green-200'
                : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    achievement.completed
                      ? 'bg-green-100 text-green-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}
                >
                  {achievement.completed ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Target className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{achievement.name}</h4>
                  <p className="text-sm text-gray-600">{achievement.description}</p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="font-bold text-gray-900">+{achievement.xp_reward} XP</div>
                {achievement.completed && (
                  <div className="text-xs text-green-600">Completed!</div>
                )}
              </div>
            </div>

            {!achievement.completed && (
              <div className="flex items-center gap-3 mt-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${(achievement.progress / achievement.target) * 100}%`,
                    }}
                  />
                </div>
                <div className="text-sm text-gray-600 whitespace-nowrap">
                  {achievement.progress}/{achievement.target}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
