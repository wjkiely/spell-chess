-- Allow 'moderator' as a valid color in the messages table.
-- Run this only if you already ran 002_create_messages_table.sql.
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_color_check;
ALTER TABLE public.messages ADD CONSTRAINT messages_color_check
  CHECK (color IN ('white', 'black', 'moderator'));
