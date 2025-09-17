-- Rollback script for ModPorter-AI Integration
-- This script reverses the changes made in 001_modporter_ai_integration.sql

-- Drop indexes first
DROP INDEX IF EXISTS idx_security_scans_file_hash;
DROP INDEX IF EXISTS idx_security_scans_timestamp;
DROP INDEX IF EXISTS idx_java_analysis_conversion_id;
DROP INDEX IF EXISTS idx_java_analysis_mod_id;
DROP INDEX IF EXISTS idx_asset_conversions_conversion_id;
DROP INDEX IF EXISTS idx_asset_conversions_type;
DROP INDEX IF EXISTS idx_validation_results_conversion_id;
DROP INDEX IF EXISTS idx_validation_results_stage;
DROP INDEX IF EXISTS idx_feature_flags_name;
DROP INDEX IF EXISTS idx_deployment_logs_timestamp;
DROP INDEX IF EXISTS idx_deployment_logs_environment;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS deployment_logs;
DROP TABLE IF EXISTS feature_flag_history;
DROP TABLE IF EXISTS feature_flags;
DROP TABLE IF EXISTS validation_results;
DROP TABLE IF EXISTS asset_conversions;
DROP TABLE IF EXISTS java_analysis_results;
DROP TABLE IF EXISTS security_scans;

-- Drop custom types
DROP TYPE IF EXISTS threat_type;
DROP TYPE IF EXISTS threat_severity;
DROP TYPE IF EXISTS validation_stage;
DROP TYPE IF EXISTS validation_status;
DROP TYPE IF EXISTS deployment_status;

-- Remove any added columns from existing tables (if any were added)
-- Note: Be careful with this in production - data loss may occur

-- Remove configuration entries (if stored in a config table)
-- DELETE FROM configuration WHERE key LIKE 'modporter_ai_%';

-- Log the rollback
INSERT INTO system_logs (level, message, timestamp)
VALUES ('INFO', 'ModPorter-AI integration rollback completed', NOW())
ON CONFLICT DO NOTHING;
