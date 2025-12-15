-- Admin RLS policies for viewing all data

-- Campaigns: Admin can view all
CREATE POLICY "Admins can view all campaigns" 
ON public.campaigns 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- Contacts: Admin can view all
CREATE POLICY "Admins can view all contacts" 
ON public.contacts 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- Messages: Admin can view all
CREATE POLICY "Admins can view all messages" 
ON public.messages 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- Profiles: Admin can view all profiles
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- User roles: Admin can view all roles
CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- User roles: Admin can update roles
CREATE POLICY "Admins can update roles" 
ON public.user_roles 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

-- User roles: Admin can insert roles
CREATE POLICY "Admins can insert roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- User roles: Admin can delete roles (except their own admin role)
CREATE POLICY "Admins can delete roles" 
ON public.user_roles 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin') AND user_id != auth.uid());

-- Update Bruno's account to admin
UPDATE public.user_roles 
SET role = 'admin' 
WHERE user_id = '3d261e80-0d24-432a-846d-2d334a1cdea4';