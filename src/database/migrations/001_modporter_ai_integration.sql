-- Database schema extensions for ModPorter-AI integration
-- This migration adds tables to support enhanced file processing, security scanning, and analysis results

-- Security scan results table
CREATE TABLE IF NOT EXISTS security_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_hash VARCHAR(64) NOT NULL UNIQUE,
  filename VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  scan_timestamp TIMESTAMP DEFAULT NOW(),
  is_safe BOOLEAN NOT NULL,
  threats JSONB DEFAULT '[]',
  scan_duration_ms INTEGER NOT NULL,
  scanner_version VARCHAR(50) DEFAULT '1.0.0',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups by file hash
CREATE INDEX IF NOT EXISTS idx_security_scans_file_hash ON security_scans(file_hash);
CREATE INDEX IF NOT EXISTS idx_security_scans_timestamp ON security_scans(scan_timestamp);
CREATE INDEX IF NOT EXISTS idx_security_scans_is_safe ON security_scans(is_safe);

-- Enhanced analysis results table
CREATE TABLE IF NOT EXISTS java_analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversion_id UUID REFERENCES conversions(id) ON DELETE CASCADE,
  file_hash VARCHAR(64) NOT NULL,
  mod_id VARCHAR(255),
  mod_name VARCHAR(255),
  mod_version VARCHAR(100),
  mod_description TEXT,
  mod_author VARCHAR(255),
  registry_names TEXT[] DEFAULT '{}',
  texture_paths TEXT[] DEFAULT '{}',
  manifest_info JSONB DEFAULT '{}',
  analysis_notes JSONB DEFAULT '[]',
  extraction_strategies JSONB DEFAULT '{}',
  analysis_duration_ms INTEGER,
  analyzer_version VARCHAR(50) DEFAULT '1.0.0',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for analysis results
CREATE INDEX IF NOT EXISTS idx_java_analysis_conversion_id ON java_analysis_results(conversion_id);
CREATE INDEX IF NOT EXISTS idx_java_analysis_file_hash ON java_analysis_results(file_hash);
CREATE INDEX IF NOT EXISTS idx_java_analysis_mod_id ON java_analysis_results(mod_id);

-- Asset conversion tracking table
CREATE TABLE IF NOT EXISTS asset_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversion_id UUID REFERENCES conversions(id) ON DELETE CASCADE,
  analysis_result_id UUID REFERENCES java_analysis_results(id) ON DELETE CASCADE,
  asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN ('texture', 'model', 'sound', 'particle')),
  original_path TEXT NOT NULL,
  converted_path TEXT NOT NULL,
  conversion_status VARCHAR(20) DEFAULT 'pending' CHECK (conversion_status IN ('pending', 'processing', 'completed', 'failed')),
  conversion_metadata JSONB DEFAULT '{}',
  conversion_errors JSONB DEFAULT '[]',
  conversion_duration_ms INTEGER,
  converter_version VARCHAR(50) DEFAULT '1.0.0',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for asset conversions
CREATE INDEX IF NOT EXISTS idx_asset_conversions_conversion_id ON asset_conversions(conversion_id);
CREATE INDEX IF NOT EXISTS idx_asset_conversions_analysis_result_id ON asset_conversions(analysis_result_id);
CREATE INDEX IF NOT EXISTS idx_asset_conversions_asset_type ON asset_conversions(asset_type);
CREATE INDEX IF NOT EXISTS idx_asset_conversions_status ON asset_conversions(conversion_status);

-- Validation pipeline results table
CREATE TABLE IF NOT EXISTS validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversion_id UUID REFERENCES conversions(id) ON DELETE CASCADE,
  stage_name VARCHAR(100) NOT NULL,
  stage_order INTEGER NOT NULL,
  validation_status VARCHAR(20) DEFAULT 'pending' CHECK (validation_status IN ('pending', 'processing', 'passed', 'failed', 'skipped')),
  validation_errors JSONB DEFAULT '[]',
  validation_warnings JSONB DEFAULT '[]',
  validation_metadata JSONB DEFAULT '{}',
  validation_duration_ms INTEGER,
  validator_version VARCHAR(50) DEFAULT '1.0.0',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for validation results
CREATE INDEX IF NOT EXISTS idx_validation_results_conversion_id ON validation_results(conversion_id);
CREATE INDEX IF NOT EXISTS idx_validation_results_stage_name ON validation_results(stage_name);
CREATE INDEX IF NOT EXISTS idx_validation_results_status ON validation_results(validation_status);

-- Feature flags table for gradual rollout
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name VARCHAR(100) NOT NULL UNIQUE,
  flag_description TEXT,
  is_enabled BOOLEAN DEFAULT FALSE,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  target_users TEXT[] DEFAULT '{}',
  target_groups TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for feature flags
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(flag_name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(is_enabled);

-- Insert default feature flags for ModPorter-AI integration
INSERT INTO feature_flags (flag_name, flag_description, is_enabled, rollout_percentage) VALUES
  ('enhanced_file_processing', 'Enable enhanced file processing with security scanning', FALSE, 0),
  ('multi_strategy_analysis', 'Enable multi-strategy Java analysis for better registry extraction', FALSE, 0),
  ('specialized_conversion_agents', 'Enable specialized conversion agents for assets', FALSE, 0),
  ('comprehensive_validation', 'Enable comprehensive validation pipeline', FALSE, 0),
  ('modporter_ai_full_integration', 'Enable full ModPorter-AI integration', FALSE, 0)
ON CONFLICT (flag_name) DO NOTHING;

-- Enhanced error tracking table
CREATE TABLE IF NOT EXISTS conversion_errors_enhanced (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversion_id UUID REFERENCES conversions(id) ON DELETE CASCADE,
  error_code VARCHAR(20) NOT NULL,
  error_type VARCHAR(50) NOT NULL,
  error_severity VARCHAR(20) NOT NULL CHECK (error_severity IN ('info', 'warning', 'error', 'critical')),
  error_message TEXT NOT NULL,
  error_details JSONB DEFAULT '{}',
  module_origin VARCHAR(100) NOT NULL,
  source_location JSONB,
  recommended_fix TEXT,
  user_message TEXT,
  error_timestamp TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for enhanced error tracking
CREATE INDEX IF NOT EXISTS idx_conversion_errors_enhanced_conversion_id ON conversion_errors_enhanced(conversion_id);
CREATE INDEX IF NOT EXISTS idx_conversion_errors_enhanced_error_code ON conversion_errors_enhanced(error_code);
CREATE INDEX IF NOT EXISTS idx_conversion_errors_enhanced_error_type ON conversion_errors_enhanced(error_type);
CREATE INDEX IF NOT EXISTS idx_conversion_errors_enhanced_severity ON conversion_errors_enhanced(error_severity);
CREATE INDEX IF NOT EXISTS idx_conversion_errors_enhanced_module ON conversion_errors_enhanced(module_origin);

-- Update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to relevant tables
CREATE TRIGGER update_security_scans_updated_at BEFORE UPDATE ON security_scans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_java_analysis_results_updated_at BEFORE UPDATE ON java_analysis_results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_asset_conversions_updated_at BEFORE UPDATE ON asset_conversions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_validation_results_updated_at BEFORE UPDATE ON validation_results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON feature_flags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE security_scans IS 'Stores results of security scans performed on uploaded mod files';
COMMENT ON TABLE java_analysis_results IS 'Stores enhanced analysis results from Java mod files including registry names and texture paths';
COMMENT ON TABLE asset_conversions IS 'Tracks individual asset conversions during the mod conversion process';
COMMENT ON TABLE validation_results IS 'Stores results from the comprehensive validation pipeline stages';
COMMENT ON TABLE feature_flags IS 'Controls gradual rollout of ModPorter-AI integration features';
COMMENT ON TABLE conversion_errors_enhanced IS 'Enhanced error tracking with detailed categorization and metadata';