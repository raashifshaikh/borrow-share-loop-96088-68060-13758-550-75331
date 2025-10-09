import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Sparkles, Zap, Crown, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface AnimatedBadgeProps {
  badge: any;
  isEarned: boolean;
  onShare?: (badge: any) => void;
  onViewDetails?: (badge: any) => void;
  size?: 'sm' | 'md' | 'lg';
  showAnimation?: boolean;
}

export const AnimatedBadge = ({ 
  badge, 
  isEarned, 
  onShare, 
  onViewDetails,
  size = 'md',
  showAnimation = false
}: AnimatedBadgeProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showSparkles, setShowSparkles] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

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

  const handleBadgeClick = () => {
    if (isEarned && onViewDetails) {
      onViewDetails(badge);
    }
  };

  const handleShare = async (e: React.MouseEvent, platform?: string) => {
    e.stopPropagation();
    
    const shareText = `🎮 I just earned the "${badge.name}" badge on BorrowPal! ${badge.icon}\n\n"${badge.description}"\n\nJoin me and start earning rewards! #BorrowPal #Achievement`;
    const shareUrl = window.location.origin;
    
    if (platform === 'twitter') {
      const text = encodeURIComponent(shareText);
      const url = encodeURIComponent(shareUrl);
      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
      return;
    }
    
    if (platform === 'whatsapp') {
      const text = encodeURIComponent(shareText);
      window.open(`https://wa.me/?text=${text}`, '_blank');
      return;
    }
    
    if (platform === 'copy') {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      toast.success('Achievement copied to clipboard!');
      setShowShareMenu(false);
      return;
    }

    // Default native share
    if (navigator.share) {
      try {
        await navigator.share({
          title: `I earned the ${badge.name} badge!`,
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        // Share dialog was canceled
      }
    } else {
      // Fallback: show custom share menu
      setShowShareMenu(true);
    }
  };

  const getRarityColor = (rarity: string) => {
    const colors = {
      common: 'text-gray-600',
      uncommon: 'text-green-600',
      rare: 'text-blue-600',
      epic: 'text-purple-600',
      legendary: 'text-yellow-600'
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  };

  return (
    <motion.div
      className="relative"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      {/* Main Badge - Clickable */}
      <motion.div
        className={`
          relative rounded-2xl p-4 text-white shadow-lg cursor-pointer
          bg-gradient-to-br ${getRarityGradient(badge.rarity)}
          ${sizeClasses[size]}
          flex items-center justify-center flex-col
          ${!isEarned ? 'grayscale opacity-50 cursor-default' : 'hover:shadow-xl'}
          transition-all duration-300
        `}
        animate={{
          rotate: isHovered && isEarned ? [0, -5, 5, -5, 0] : 0,
        }}
        transition={{ duration: 0.5 }}
        onClick={handleBadgeClick}
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
          className="text-center"
        >
          <div className="text-3xl mb-1">{badge.icon}</div>
          {isEarned && isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs opacity-90"
            >
              Click for details
            </motion.div>
          )}
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
            className="absolute -top-2 -right-2 z-10"
          >
            <Button
              size="sm"
              className="h-8 w-8 rounded-full p-0 bg-white shadow-lg hover:bg-gray-50"
              onClick={(e) => handleShare(e)}
            >
              <Share2 className="w-4 h-4 text-gray-700" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Menu Popup */}
      <AnimatePresence>
        {showShareMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-2xl border p-3 z-50 min-w-48"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 text-sm mb-2">Share to</h4>
              
              <button
                onClick={(e) => handleShare(e, 'twitter')}
                className="w-full flex items-center gap-3 p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors text-sm"
              >
                <span>🐦</span>
                <span>Twitter</span>
              </button>

              <button
                onClick={(e) => handleShare(e, 'whatsapp')}
                className="w-full flex items-center gap-3 p-2 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors text-sm"
              >
                <span>💬</span>
                <span>WhatsApp</span>
              </button>

              <button
                onClick={(e) => handleShare(e, 'copy')}
                className="w-full flex items-center gap-3 p-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white transition-colors text-sm"
              >
                <span>📋</span>
                <span>Copy Link</span>
              </button>

              <button
                onClick={() => setShowShareMenu(false)}
                className="w-full flex items-center gap-3 p-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors text-sm"
              >
                <span>✕</span>
                <span>Cancel</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Badge Info */}
      <motion.div 
        className="text-center mt-2"
        animate={{ y: isHovered && isEarned ? -5 : 0 }}
      >
        <div className="text-sm font-semibold text-gray-900 truncate">
          {badge.name}
        </div>
        <div className={`text-xs font-medium ${getRarityColor(badge.rarity)} capitalize`}>
          {badge.rarity}
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
