CREATE TABLE IF NOT EXISTS user_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  name text,
  avatar_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE(user_id)
);
ALTER TABLE user_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON user_approvals USING (true) WITH CHECK (true);
