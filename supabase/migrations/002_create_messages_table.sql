-- Chat messages for each game
CREATE TABLE public.messages (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id     UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  color       TEXT NOT NULL CHECK (color IN ('white', 'black', 'moderator')),
  name        TEXT,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (permissive – no auth in this app)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);

-- Expose full row on DELETE so Realtime can send the old id
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Add to Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
