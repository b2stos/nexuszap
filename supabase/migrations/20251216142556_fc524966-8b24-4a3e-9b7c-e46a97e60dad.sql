-- Create enum for send speed
CREATE TYPE public.send_speed AS ENUM ('slow', 'normal', 'fast');

-- Add send_speed column to campaigns table with default 'normal'
ALTER TABLE public.campaigns 
ADD COLUMN send_speed public.send_speed NOT NULL DEFAULT 'normal';