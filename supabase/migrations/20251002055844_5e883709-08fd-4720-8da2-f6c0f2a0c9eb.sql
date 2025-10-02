-- Gamification System Schema

-- User levels and XP tracking
CREATE TABLE IF NOT EXISTS public.user_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  level integer NOT NULL DEFAULT 1,
  xp integer NOT NULL DEFAULT 0,
  title text NOT NULL DEFAULT 'Rookie',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own level"
  ON public.user_levels FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own level"
  ON public.user_levels FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Badges catalog
CREATE TABLE IF NOT EXISTS public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL,
  icon text NOT NULL,
  category text NOT NULL,
  requirement_type text NOT NULL,
  requirement_value integer NOT NULL,
  xp_reward integer NOT NULL DEFAULT 0,
  rarity text NOT NULL DEFAULT 'common',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view badges"
  ON public.badges FOR SELECT
  TO authenticated
  USING (true);

-- User earned badges
CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_id uuid REFERENCES public.badges(id) ON DELETE CASCADE NOT NULL,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own badges"
  ON public.user_badges FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view others badges"
  ON public.user_badges FOR SELECT
  TO authenticated
  USING (true);

-- Referrals tracking
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  referred_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  referral_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  xp_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(referrer_id, referred_id)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their referrals"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- Achievements tracking
CREATE TABLE IF NOT EXISTS public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  achievement_type text NOT NULL,
  achievement_value integer NOT NULL DEFAULT 1,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own achievements"
  ON public.achievements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Add gamification fields to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS trust_score integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS streak_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_date date,
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS profile_frame text,
  ADD COLUMN IF NOT EXISTS profile_color text,
  ADD COLUMN IF NOT EXISTS custom_title text;

-- Triggers for updated_at
CREATE TRIGGER update_user_levels_updated_at
  BEFORE UPDATE ON public.user_levels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default badges
INSERT INTO public.badges (name, description, icon, category, requirement_type, requirement_value, xp_reward, rarity) VALUES
  ('Rookie Borrower', 'Complete your first loan repayment', 'trophy', 'borrowing', 'loans_repaid', 1, 50, 'common'),
  ('Reliable', 'Repay 5 loans on time', 'star', 'borrowing', 'loans_repaid', 5, 150, 'common'),
  ('Trusted User', 'Repay 10 loans on time', 'shield', 'borrowing', 'loans_repaid', 10, 300, 'rare'),
  ('Starter Connector', 'Refer 1 user', 'users', 'referral', 'referrals_made', 1, 100, 'common'),
  ('Trusted Connector', 'Refer 5 users', 'user-check', 'referral', 'referrals_made', 5, 300, 'rare'),
  ('Elite Ambassador', 'Refer 20 users', 'award', 'referral', 'referrals_made', 20, 1000, 'legendary'),
  ('Community Builder', 'Refer 10 users', 'heart', 'referral', 'referrals_made', 10, 500, 'epic'),
  ('Ambassador', 'Refer 50 users', 'crown', 'referral', 'referrals_made', 50, 2500, 'legendary'),
  ('Borrowpal Legend', 'Maintain 90-day streak', 'zap', 'activity', 'streak_days', 90, 1500, 'legendary')
ON CONFLICT (name) DO NOTHING;

-- Function to generate referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := 'BP' || upper(substring(md5(random()::text) from 1 for 8));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_code();

-- Function to award XP
CREATE OR REPLACE FUNCTION public.award_xp(p_user_id uuid, p_xp integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_xp integer;
  v_current_level integer;
  v_new_xp integer;
  v_new_level integer;
  v_new_title text;
BEGIN
  -- Get or create user level
  INSERT INTO public.user_levels (user_id, xp, level)
  VALUES (p_user_id, p_xp, 1)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    xp = user_levels.xp + p_xp,
    updated_at = now()
  RETURNING xp, level INTO v_current_xp, v_current_level;
  
  -- Calculate new level (100 XP per level with exponential growth)
  v_new_level := FLOOR(POWER(v_current_xp / 100.0, 0.7)) + 1;
  
  -- Determine title based on level
  v_new_title := CASE
    WHEN v_new_level >= 10 THEN 'Ambassador'
    WHEN v_new_level >= 7 THEN 'Elite Borrowpal'
    WHEN v_new_level >= 5 THEN 'Connector'
    WHEN v_new_level >= 3 THEN 'Trusted User'
    WHEN v_new_level >= 2 THEN 'Reliable Borrower'
    ELSE 'Rookie'
  END;
  
  -- Update level if changed
  IF v_new_level > v_current_level THEN
    UPDATE public.user_levels
    SET level = v_new_level, title = v_new_title, updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
END;
$$;