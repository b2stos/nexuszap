-- Admin pode excluir qualquer campanha
CREATE POLICY "Admins can delete all campaigns" 
ON public.campaigns 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin pode atualizar qualquer campanha
CREATE POLICY "Admins can update all campaigns" 
ON public.campaigns 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin pode excluir qualquer mensagem
CREATE POLICY "Admins can delete all messages" 
ON public.messages 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin pode atualizar qualquer mensagem
CREATE POLICY "Admins can update all messages" 
ON public.messages 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));