import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Twitter, Facebook, MessageCircle, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface SocialShareProps {
  shareData: {
    title: string;
    text: string;
    url: string;
  };
  badge?: any;
}

export const SocialShare = ({ shareData, badge }: SocialShareProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareOptions = [
    {
      name: 'Twitter',
      icon: Twitter,
      color: 'bg-blue-500 hover:bg-blue-600',
      share: () => {
        const text = encodeURIComponent(shareData.text);
        const url = encodeURIComponent(shareData.url);
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
      }
    },
    {
      name: 'Facebook',
      icon: Facebook,
      color: 'bg-blue-600 hover:bg-blue-700',
      share: () => {
        const url = encodeURIComponent(shareData.url);
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
      }
    },
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      color: 'bg-green-500 hover:bg-green-600',
      share: () => {
        const text = encodeURIComponent(shareData.text);
        window.open(`https://wa.me/?text=${text}`, '_blank');
      }
    }
  ];

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        // Share dialog was canceled
      }
    } else {
      setIsOpen(true);
    }
  };

  return (
    <div className="relative">
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button
          onClick={handleNativeShare}
          className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
        >
          <Share2 className="w-4 h-4 mr-2" />
          Share Achievement
        </Button>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-2xl border p-4 z-50 min-w-48"
          >
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 text-sm">Share via</h4>
              
              {shareOptions.map((option) => (
                <motion.button
                  key={option.name}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg text-white ${option.color} transition-colors`}
                  onClick={option.share}
                >
                  <option.icon className="w-4 h-4" />
                  <span className="text-sm">{option.name}</span>
                </motion.button>
              ))}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-3 p-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white transition-colors"
                onClick={copyToClipboard}
              >
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span className="text-sm">{copied ? 'Copied!' : 'Copy Link'}</span>
              </motion.button>
            </div>

            {/* Badge Preview */}
            {badge && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <div className="text-2xl">{badge.icon}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{badge.name}</div>
                    <div className="text-xs text-gray-600">{badge.description}</div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
