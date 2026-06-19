-- =============================================
-- BALLSTATS マルチチーム対応 Supabase設定SQL
-- Supabase Dashboard > SQL Editor で実行してください
-- =============================================

-- 1. user_idカラムを追加
ALTER TABLE players ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE games   ADD COLUMN IF NOT EXISTS user_id uuid;

-- 2. 1ユーザー = 1行 のユニーク制約
CREATE UNIQUE INDEX IF NOT EXISTS players_user_id_idx ON players(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS games_user_id_idx   ON games(user_id);

-- 3. Row Level Security を有効化
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games   ENABLE ROW LEVEL SECURITY;

-- 4. 既存ポリシーを削除（再実行時のエラー防止）
DROP POLICY IF EXISTS "own_players" ON players;
DROP POLICY IF EXISTS "own_games"   ON games;

-- 5. 自分のデータのみアクセス可能にするポリシー
CREATE POLICY "own_players" ON players FOR ALL USING (user_id = auth.uid());
CREATE POLICY "own_games"   ON games   FOR ALL USING (user_id = auth.uid());


-- =============================================
-- 既存データの移行（seiryoチームのデータを引き継ぐ場合）
-- アカウント作成後、ログインした状態でSupabase SQL Editorから実行してください
-- ※ auth.uid() が自分のuserIDに置き換わります
-- =============================================

-- UPDATE players SET user_id = auth.uid() WHERE id = 4;
-- UPDATE games   SET user_id = auth.uid() WHERE id = 2;
