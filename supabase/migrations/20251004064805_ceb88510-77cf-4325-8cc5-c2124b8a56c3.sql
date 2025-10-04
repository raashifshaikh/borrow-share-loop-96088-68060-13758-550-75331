-- Fix foreign key constraint for listings to profiles
ALTER TABLE public.listings
DROP CONSTRAINT IF EXISTS listings_seller_id_fkey;

ALTER TABLE public.listings
ADD CONSTRAINT listings_seller_id_fkey 
FOREIGN KEY (seller_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Ensure referral code is generated for existing users without one
UPDATE public.profiles
SET referral_code = 'BP' || upper(substring(md5(random()::text) from 1 for 8))
WHERE referral_code IS NULL;

-- Create user_levels for users who don't have one
INSERT INTO public.user_levels (user_id, xp, level, title)
SELECT id, 0, 1, 'Rookie'
FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.user_levels)
ON CONFLICT (user_id) DO NOTHING;

-- Add more fun achievements/badges
INSERT INTO public.badges (name, description, icon, category, requirement_type, requirement_value, xp_reward, rarity) VALUES
('First Listing', 'Create your first listing', '🎯', 'activity', 'listings_created', 1, 25, 'common'),
('Item Collector', 'Create 5 listings', '📦', 'activity', 'listings_created', 5, 100, 'common'),
('Marketplace Master', 'Create 20 listings', '🏪', 'activity', 'listings_created', 20, 500, 'rare'),
('Quick Responder', 'Reply to 10 messages within 5 minutes', '⚡', 'engagement', 'quick_responses', 10, 200, 'rare'),
('Social Butterfly', 'Send 50 messages', '🦋', 'engagement', 'messages_sent', 50, 300, 'rare'),
('Deal Maker', 'Complete 3 successful orders', '🤝', 'trading', 'orders_completed', 3, 150, 'common'),
('Trading Expert', 'Complete 15 orders', '💼', 'trading', 'orders_completed', 15, 400, 'rare'),
('Marketplace Legend', 'Complete 50 orders', '👑', 'trading', 'orders_completed', 50, 1500, 'epic'),
('Early Bird', 'Login before 6 AM', '🌅', 'activity', 'early_logins', 1, 50, 'common'),
('Night Owl', 'Login after 10 PM', '🦉', 'activity', 'late_logins', 1, 50, 'common'),
('Weekend Warrior', 'Complete an order on weekend', '🎮', 'activity', 'weekend_orders', 1, 75, 'common'),
('Perfect Rating', 'Maintain 5-star rating with 10+ reviews', '⭐', 'reputation', 'perfect_rating', 10, 800, 'epic'),
('Favorite Seller', 'Get favorited by 20 users', '❤️', 'reputation', 'favorites_received', 20, 600, 'rare'),
('Speedster', 'Complete an order within 1 hour', '🏃', 'trading', 'fast_orders', 1, 100, 'rare'),
('Generous Helper', 'Complete 5 free service orders', '🎁', 'community', 'free_services', 5, 250, 'epic')
ON CONFLICT (name) DO NOTHING;