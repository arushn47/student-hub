-- Migration: Add user activity tracking for streak gamification
-- Creates a table to track daily user activity for streak calculation

CREATE TABLE IF NOT EXISTS user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
    activity_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, activity_date)
);

-- Enable RLS
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- Users can only access their own activity
CREATE POLICY "Users can view their own activity"
ON user_activity FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity"
ON user_activity FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activity"
ON user_activity FOR UPDATE USING (auth.uid() = user_id);

-- Create index for faster streak calculation
CREATE INDEX idx_user_activity_user_date ON user_activity(user_id, activity_date DESC);
