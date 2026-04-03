-- Migration: add_training_and_delivery_fields
-- Status: applied in production — this file is for version control only, do NOT re-run
-- Purpose:
--   1. Add delivery_channel to submissions (first-class field, written on every submission)
--   2. Add enriched training columns to training_data (written only when train_ai = true)

-- ── submissions table ─────────────────────────────────────────────────────────
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS delivery_channel text NOT NULL DEFAULT 'other';

-- ── training_data table ───────────────────────────────────────────────────────
ALTER TABLE training_data
  ADD COLUMN IF NOT EXISTS training_analysis       jsonb,
  ADD COLUMN IF NOT EXISTS training_modality       text,
  ADD COLUMN IF NOT EXISTS training_gsb_state      boolean,
  ADD COLUMN IF NOT EXISTS training_radar_state    boolean,
  ADD COLUMN IF NOT EXISTS training_urlhaus_state  boolean,
  ADD COLUMN IF NOT EXISTS training_is_anonymous   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS training_consent_version text DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS training_reflag_snapshot jsonb;

-- Indexes for common training queries
CREATE INDEX IF NOT EXISTS idx_training_data_consent  ON training_data (training_consent_version);
CREATE INDEX IF NOT EXISTS idx_training_data_modality ON training_data (training_modality);
CREATE INDEX IF NOT EXISTS idx_submissions_delivery   ON submissions   (delivery_channel);
