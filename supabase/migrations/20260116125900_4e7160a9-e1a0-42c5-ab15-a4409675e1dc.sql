-- Fix whatsapp_config RLS policies to properly protect API tokens
-- The issue: current policies are all PERMISSIVE (OR logic)
-- Solution: Add a RESTRICTIVE policy that enforces ownership (AND logic)

-- First, drop the misleadingly named "Deny public access" policy
-- which is actually a permissive policy, not a deny
DROP POLICY IF EXISTS "Deny public access to whatsapp_config" ON public.whatsapp_config;

-- Create a proper RESTRICTIVE policy that ensures:
-- 1. User must be authenticated
-- 2. User can only access their own config
-- This policy will be ANDed with all other policies
CREATE POLICY "Restrict access to own config only"
ON public.whatsapp_config
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- The existing PERMISSIVE policies for specific operations remain:
-- - "Users can delete their own WhatsApp config"
-- - "Users can insert their own WhatsApp config"  
-- - "Users can update their own WhatsApp config"
-- - "Users can view their own WhatsApp config"
-- 
-- With the RESTRICTIVE policy in place:
-- Final access = (any permissive passes) AND (all restrictive pass)
-- This ensures authenticated users can ONLY access their own tokens