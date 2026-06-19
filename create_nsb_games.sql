-- =============================================
-- nsb_games テーブル作成
-- Supabase Dashboard > SQL Editor で実行してください
-- =============================================

CREATE TABLE IF NOT EXISTS nsb_games (
  id            bigserial PRIMARY KEY,
  team_name     text NOT NULL,
  opponent      text NOT NULL,
  game_date     date NOT NULL DEFAULT CURRENT_DATE,
  status        text NOT NULL CHECK (status IN ('completed', 'in_progress', 'cold')),
  score_my      integer NOT NULL DEFAULT 0,
  score_opp     integer NOT NULL DEFAULT 0,
  end_inning    integer,
  end_reason    text,
  game_log      jsonb NOT NULL DEFAULT '[]',
  game_state    jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 更新日時の自動更新トリガー
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nsb_games_updated_at ON nsb_games;
CREATE TRIGGER nsb_games_updated_at
  BEFORE UPDATE ON nsb_games
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
