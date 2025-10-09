import { Flame } from 'lucide-react';

interface StreakTrackerProps {
  currentStreak: number;
  bestStreak?: number;
}

export const StreakTracker = ({ currentStreak, bestStreak = 0 }: StreakTrackerProps) => {
  const getStreakMessage = (streak: number) => {
    if (streak === 0) return "Start your streak today!";
    if (streak < 7) return "Keep going!";
    if (streak < 30) return "Great consistency!";
    return "Amazing dedication!";
  };

  const getFlameColor = (streak: number) => {
    if (streak === 0) return "text-gray-400";
    if (streak < 7) return "text-orange-500";
    if (streak < 30) return "text-red-500";
    return "text-purple-500";
  };

  return (
    <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Flame className={`w-5 h-5 ${getFlameColor(currentStreak)}`} />
          Login Streak
        </h3>
        {bestStreak > currentStreak && (
          <span className="text-sm text-gray-600">Best: {bestStreak} days</span>
        )}
      </div>

      <div className="text-center">
        <div className="text-4xl font-bold text-gray-900 mb-2">{currentStreak}</div>
        <div className="text-sm text-gray-600 mb-4">days in a row</div>
        
        <div className="flex justify-center gap-1 mb-4">
          {[...Array(7)].map((_, index) => (
            <div
              key={index}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                index < Math.min(currentStreak, 7)
                  ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white'
                  : 'bg-gray-200 text-gray-400'
              }`}
            >
              {index + 1}
            </div>
          ))}
        </div>

        <p className="text-sm text-gray-600">{getStreakMessage(currentStreak)}</p>
        
        {currentStreak > 0 && (
          <div className="mt-3 text-xs text-green-600 bg-green-50 rounded-full px-3 py-1 inline-block">
            +{currentStreak * 5} XP bonus today!
          </div>
        )}
      </div>
    </div>
  );
};
