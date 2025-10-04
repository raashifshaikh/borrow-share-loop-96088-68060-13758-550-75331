-- Fix negotiation action enum (replace counter_offer with counter)
ALTER TYPE negotiation_action RENAME TO negotiation_action_old;
CREATE TYPE negotiation_action AS ENUM ('accept', 'decline', 'counter');
ALTER TABLE order_negotiations ALTER COLUMN action TYPE negotiation_action USING action::text::negotiation_action;
DROP TYPE negotiation_action_old;

-- Add foreign keys to chat_messages for profile joins
ALTER TABLE chat_messages
ADD CONSTRAINT fk_chat_from_profile FOREIGN KEY (from_user_id) REFERENCES profiles(id) ON DELETE CASCADE,
ADD CONSTRAINT fk_chat_to_profile FOREIGN KEY (to_user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Add trigger to generate referral_code on profile creation
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := 'BP' || upper(substring(md5(random()::text) from 1 for 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER generate_referral_code_trigger
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION generate_referral_code();

-- Add RLS policies for service_orders
ALTER TABLE service_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their service orders"
ON service_orders FOR SELECT
USING (auth.uid() = buyer_id OR auth.uid() = provider_id);

CREATE POLICY "Buyers can create service orders"
ON service_orders FOR INSERT
WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Participants can update service orders"
ON service_orders FOR UPDATE
USING (auth.uid() = buyer_id OR auth.uid() = provider_id);

-- Add paid status to order_status enum if not exists
DO $$ BEGIN
  ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'paid';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Seed more badges with proper icons
INSERT INTO badges (name, description, icon, category, requirement_type, requirement_value, xp_reward, rarity) VALUES
('First Listing', 'Create your first listing', 'package', 'listing', 'listings_created', 1, 50, 'common'),
('Negotiator', 'Successfully negotiate 5 deals', 'handshake', 'social', 'negotiations_completed', 5, 100, 'uncommon'),
('Early Bird', 'List an item within first hour of signup', 'sunrise', 'timing', 'early_listing', 1, 75, 'rare'),
('Trusted Lender', 'Complete 10 successful lends', 'shield-check', 'trust', 'lends_completed', 10, 150, 'rare'),
('Community Helper', 'Help 3 different people', 'users', 'social', 'unique_borrows', 3, 100, 'uncommon')
ON CONFLICT (name) DO NOTHING;