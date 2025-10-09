import { motion } from 'framer-motion';
import { X, Share2, Calendar, Award, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { SocialShare } from './SocialShare';

interface BadgeDetailsModalProps {
  badge: any;
  isOpen: boolean;
  onClose: () => void;
  earnedAt?: string;
}

export const BadgeDetailsModal = ({ badge, isOpen, onClose, earnedAt }: BadgeDetailsModalProps) => {
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
              <Award className="h-4 w-4 text-purple-600" />
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
              <Calendar className="h-4 w-4" />
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
