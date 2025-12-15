-- Admin pode excluir qualquer contato
CREATE POLICY "Admins can delete all contacts" 
ON public.contacts 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin pode atualizar qualquer contato
CREATE POLICY "Admins can update all contacts" 
ON public.contacts 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));