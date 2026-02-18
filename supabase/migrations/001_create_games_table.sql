-- Spell Chess: games table
-- Run this in the Supabase SQL editor or via `supabase db push`

CREATE TABLE IF NOT EXISTS public.games (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- ── Source of truth ────────────────────────────────────────────────────────
  -- Comma-separated compact actions: "j@e4,e2-e4,e7-e5,f@d4,d2-d4,R"
  -- The full game can always be replayed from this string alone.
  compact_action_log  TEXT          NOT NULL DEFAULT '',

  -- ── Cached current state (derived from replaying compact_action_log) ───────
  -- Stored for fast reads; always rebuilt on each PATCH
  board_state         JSONB         NOT NULL DEFAULT '[]'::jsonb,
  current_player      TEXT          NOT NULL DEFAULT 'white'
                        CHECK (current_player IN ('white', 'black')),
  game_turn_number    INTEGER       NOT NULL DEFAULT 1,
  ply_count           INTEGER       NOT NULL DEFAULT 0,
  spells_state        JSONB         NOT NULL DEFAULT '{}'::jsonb,
  active_spells       JSONB         NOT NULL DEFAULT '[]'::jsonb,
  en_passant_target   JSONB,
  castling_rights     JSONB         NOT NULL DEFAULT '{}'::jsonb,
  is_game_over        BOOLEAN       NOT NULL DEFAULT false,
  game_end_message    TEXT          NOT NULL DEFAULT '',

  -- Full move log with human-readable notation (for the move list panel)
  move_log            JSONB         NOT NULL DEFAULT '[]'::jsonb,

  -- Used for threefold-repetition detection; rebuilt on replay
  repetition_counter  JSONB         NOT NULL DEFAULT '{}'::jsonb,

  -- ── Metadata ────────────────────────────────────────────────────────────────
  -- 'waiting'  = game created, waiting for opponent
  -- 'active'   = both sides have moved at least once
  -- 'finished' = game is over (checkmate / resign / draw)
  status              TEXT          NOT NULL DEFAULT 'waiting'
                        CHECK (status IN ('waiting', 'active', 'finished'))
);

-- Keep updated_at fresh automatically
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS games_set_updated_at ON public.games;
CREATE TRIGGER games_set_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable Realtime for live multiplayer updates
-- (Run this once in Supabase dashboard: Database → Replication → enable games table)
ALTER TABLE public.games REPLICA IDENTITY FULL;

-- Row-level security: anyone can read, anyone can update (game link = implicit auth)
-- Tighten this with proper auth if you add user accounts later.
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read games"
  ON public.games FOR SELECT
  USING (true);

CREATE POLICY "anyone can insert games"
  ON public.games FOR INSERT
  WITH CHECK (true);

CREATE POLICY "anyone can update games"
  ON public.games FOR UPDATE
  USING (true);
