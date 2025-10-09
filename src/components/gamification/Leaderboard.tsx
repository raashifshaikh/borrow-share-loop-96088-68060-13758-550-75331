import { Crown, Trophy, Medal, User } from 'lucide-react';

interface LeaderboardUser {
  id: string;
  name: string;
  avatar_url: string;
  level: number;
  xp: number;
  position: number;
}

interface LeaderboardProps {
  data: LeaderboardUser[];
  currentUserId?: string;
}

export const Leaderboard = ({ data = [], currentUserId }: LeaderboardProps) => {
  const getRankIcon = (position: number) => {
    if (position === 1) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (position === 2) return <Trophy className="w-5 h-5 text-gray-400" />;
    if (position === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-sm font-medium text-gray-600">#{position}</span>;
  };

  const getRankColor = (position: number) => {
    if (position === 1) return 'bg-yellow-50 border-yellow-200';
    if (position === 2) return 'bg-gray-50 border-gray-200';
    if (position === 3) return 'bg-amber-50 border-amber-200';
    return 'bg-white border-gray-100';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Community Leaders</h3>
        <div className="text-sm text-gray-600">Top 10 Lenders</div>
      </div>

      <div className="space-y-3">
        {data.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>No leaderboard data yet</p>
            <p className="text-sm">Be the first to earn XP!</p>
          </div>
        ) : (
          data.map((user) => (
            <div
              key={user.id}
              className={`flex items-center justify-between p-4 rounded-xl border-2 ${getRankColor(
                user.position
              )} ${
                user.id === currentUserId ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8">
                  {getRankIcon(user.position)}
                </div>
                
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    user.name?.charAt(0)?.toUpperCase() || <User className="w-5 h-5" />
                  )}
                </div>

                <div>
                  <div className="font-medium flex items-center gap-2">
                    {user.name}
                    {user.id === currentUserId && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">Level {user.level}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-bold text-gray-900">{user.xp.toLocaleString()} XP</div>
                <div className="text-xs text-gray-600">Total</div>
              </div>
            </div>
          ))
        )}
      </div>

      {data.length > 0 && (
        <div className="text-center pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Leaderboard updates daily at midnight
          </p>
        </div>
      )}
    </div>
  );
};
