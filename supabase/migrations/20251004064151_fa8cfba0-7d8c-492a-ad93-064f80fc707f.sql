-- Add 'in_progress' status to order_status enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'in_progress';