-- Add RESTRICTIVE policy to profiles table to explicitly deny anonymous access
CREATE POLICY "Block anonymous access to profiles"
  ON public.profiles
  AS RESTRICTIVE
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Add RESTRICTIVE policy to contacts table to explicitly deny anonymous access
CREATE POLICY "Block anonymous access to contacts"
  ON public.contacts
  AS RESTRICTIVE
  FOR ALL
  USING (auth.uid() IS NOT NULL);