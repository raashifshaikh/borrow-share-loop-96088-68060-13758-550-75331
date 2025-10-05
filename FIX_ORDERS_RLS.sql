-- ============================================
-- FIX FOR ORDER STATUS UPDATE ISSUE
-- ============================================
-- 
-- HOW TO RUN THIS:
-- 1. Open your Lovable project
-- 2. Click on "Cloud" tab in the top navigation
-- 3. Click on "Database" in the left sidebar
-- 4. Click on "SQL Editor"
-- 5. Copy and paste this entire SQL script
-- 6. Click "Run" button
-- 
-- ============================================

-- Add RLS policies for orders table to allow status updates

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Participants can update orders" ON orders;

-- Allow both buyer and seller to update orders
CREATE POLICY "Participants can update orders"
ON orders FOR UPDATE
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- Verify the policy was created (you should see the new policy listed)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'orders';
