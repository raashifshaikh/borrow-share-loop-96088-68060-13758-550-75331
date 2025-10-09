import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Sparkles, Zap, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface AnimatedBadgeProps {
  badge: any;
  isEarned: boolean;
  onShare?: (badge: any) => void;
  size?: 'sm' | 'md' | 'lg';
  showAnimation?: boolean;
}

export const AnimatedBadge = ({ 
  badge, 
  isEarned, 
  onShare, 
  size = 'md',
  showAnimation = false
}: AnimatedBadgeProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showSparkles, setShowSparkles] = useState(false);

  useEffect(() => {
    if (showAnimation && isEarned) {
      setShowSparkles(true);
      const timer = setTimeout(() => setShowSparkles(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showAnimation, isEarned]);

  const sizeClasses = {
    sm: 'w-16 h-16 text-2xl',
    md: 'w-24 h-24 text-3xl',
    lg: 'w-32 h-32 text-4xl'
  };

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

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onShare) {
      onShare(badge);
    } else {
      const shareText = `🎮 I just earned the "${badge.name}" badge on BorrowPal! ${badge.icon}\n\n"${badge.description}"\n\nJoin me and start earning rewards! #BorrowPal #Achievement`;
      
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'My BorrowPal Achievement',
            text: shareText,
            url: window.location.origin,
          });
        } catch (error) {
          // Share dialog was canceled
        }
      } else {
        await navigator.clipboard.writeText(shareText);
        toast.success('Achievement copied to clipboard! Share it on social media!');
      }
    }
  };

  return (
    <motion.div
      className="relative"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <motion.div
        className={`
          relative rounded-2xl p-4 text-white shadow-lg cursor-pointer
          bg-gradient-to-br ${getRarityGradient(badge.rarity)}
          ${sizeClasses[size]}
          flex items-center justify-center flex-col
          ${!isEarned ? 'grayscale opacity-50' : ''}
        `}
        animate={{
          rotate: isHovered && isEarned ? [0, -5, 5, -5, 0] : 0,
        }}
        transition={{ duration: 0.5 }}
      >
        {/* Sparkle Animation */}
        <AnimatePresence>
          {showSparkles && (
            <>
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute pointer-events-none"
                  initial={{ scale: 0, opacity: 1 }}
                  animate={{
                    scale: [0, 1, 0],
                    opacity: [1, 0.5, 0],
                    x: Math.cos((i / 8) * Math.PI * 2) * 60,
                    y: Math.sin((i / 8) * Math.PI * 2) * 60,
                  }}
                  transition={{ duration: 1.5, delay: i * 0.1 }}
                >
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                </motion.div>
              ))}
            </>
          )}
        </AnimatePresence>

        {/* Badge Icon */}
        <motion.div
          animate={{ 
            scale: isHovered && isEarned ? 1.2 : 1,
            y: isHovered && isEarned ? -5 : 0 
          }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          {badge.icon}
        </motion.div>

        {/* Rarity Crown for Legendary */}
        {badge.rarity === 'legendary' && isEarned && (
          <motion.div
            className="absolute -top-2 -right-2"
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Crown className="w-6 h-6 text-yellow-300" />
          </motion.div>
        )}

        {/* Electric Effect for Epic */}
        {badge.rarity === 'epic' && isEarned && (
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-purple-300 pointer-events-none"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </motion.div>

      {/* Share Button */}
      <AnimatePresence>
        {isHovered && isEarned && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute -top-2 -left-2"
          >
            <Button
              size="sm"
              className="h-6 w-6 rounded-full p-0 bg-white shadow-lg"
              onClick={handleShare}
            >
              <Share2 className="w-3 h-3 text-gray-700" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Badge Name */}
      <motion.div 
        className="text-center mt-2"
        animate={{ y: isHovered && isEarned ? -5 : 0 }}
      >
        <div className="text-sm font-semibold text-gray-900 truncate">
          {badge.name}
        </div>
        {!isEarned && (
          <Badge variant="outline" className="text-xs mt-1">
            Locked
          </Badge>
        )}
      </motion.div>
    </motion.div>
  );
};
