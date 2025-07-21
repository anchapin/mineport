/**
 * PipelineStageMapper
 * 
 * This utility maps backend pipeline stages to UI-friendly stages and provides
 * detailed status messages for each stage.
 */

import { ConversionProgress } from '../types';

/**
 * Backend pipeline stage
 */
export type BackendPipelineStage = 
  | 'init'
  | 'validation'
  | 'feature_analysis'
  | 'manifest_generation'
  | 'asset_translation'
  | 'block_item_definition'
  | 'recipe_conversion'
  | 'loot_table_conversion'
  | 'license_embedding'
  | 'logic_translation'
  | 'addon_validation'
  | 'report_generation'
  | 'addon_packaging'
  | 'complete'
  | 'failed';

/**
 * Stage mapping configuration
 */
interface StageMapping {
  uiStage: ConversionProgress['stage'];
  defaultMessage: string;
  percentageWeight: number;
}

/**
 * Maps backend pipeline stages to UI stages
 */
const STAGE_MAPPING: Record<BackendPipelineStage, StageMapping> = {
  'init': {
    uiStage: 'uploading',
    defaultMessage: 'Initializing conversion process',
    percentageWeight: 5
  },
  'validation': {
    uiStage: 'validating',
    defaultMessage: 'Validating mod structure and contents',
    percentageWeight: 10
  },
  'feature_analysis': {
    uiStage: 'analyzing',
    defaultMessage: 'Analyzing feature compatibility',
    percentageWeight: 10
  },
  'manifest_generation': {
    uiStage: 'config',
    defaultMessage: 'Generating addon manifests',
    percentageWeight: 5
  },
  'asset_translation': {
    uiStage: 'assets',
    defaultMessage: 'Converting textures, models, and sounds',
    percentageWeight: 15
  },
  'block_item_definition': {
    uiStage: 'config',
    defaultMessage: 'Converting block and item definitions',
    percentageWeight: 5
  },
  'recipe_conversion': {
    uiStage: 'config',
    defaultMessage: 'Converting crafting recipes',
    percentageWeight: 5
  },
  'loot_table_conversion': {
    uiStage: 'config',
    defaultMessage: 'Converting loot tables',
    percentageWeight: 5
  },
  'license_embedding': {
    uiStage: 'config',
    defaultMessage: 'Embedding license information',
    percentageWeight: 2
  },
  'logic_translation': {
    uiStage: 'logic',
    defaultMessage: 'Translating Java code to JavaScript',
    percentageWeight: 20
  },
  'addon_validation': {
    uiStage: 'packaging',
    defaultMessage: 'Validating addon structure',
    percentageWeight: 5
  },
  'report_generation': {
    uiStage: 'packaging',
    defaultMessage: 'Generating conversion report',
    percentageWeight: 3
  },
  'addon_packaging': {
    uiStage: 'packaging',
    defaultMessage: 'Packaging addon files',
    percentageWeight: 10
  },
  'complete': {
    uiStage: 'complete',
    defaultMessage: 'Conversion complete',
    percentageWeight: 0
  },
  'failed': {
    uiStage: 'complete', // We'll handle errors separately
    defaultMessage: 'Conversion failed',
    percentageWeight: 0
  }
};

/**
 * Maps a backend pipeline stage to a UI-friendly stage
 * 
 * @param backendStage Backend pipeline stage
 * @param stagePercentage Percentage completion of the current stage (0-100)
 * @param stageMessage Optional custom message for the stage
 * @returns UI-friendly conversion progress
 */
export function mapPipelineStage(
  backendStage: BackendPipelineStage,
  stagePercentage: number = 100,
  stageMessage?: string
): ConversionProgress {
  const mapping = STAGE_MAPPING[backendStage] || STAGE_MAPPING.init;
  
  return {
    stage: mapping.uiStage,
    percentage: Math.min(100, Math.max(0, stagePercentage)),
    currentTask: stageMessage || mapping.defaultMessage
  };
}

/**
 * Calculates the overall conversion progress based on completed stages
 * 
 * @param completedStages Array of completed backend stages
 * @param currentStage Current backend stage
 * @param currentStagePercentage Percentage completion of current stage (0-100)
 * @returns Overall percentage (0-100)
 */
export function calculateOverallProgress(
  completedStages: BackendPipelineStage[],
  currentStage: BackendPipelineStage,
  currentStagePercentage: number
): number {
  // Calculate total weight of all stages
  const totalWeight = Object.values(STAGE_MAPPING).reduce(
    (sum, mapping) => sum + mapping.percentageWeight,
    0
  );
  
  // Calculate weight of completed stages
  const completedWeight = completedStages.reduce(
    (sum, stage) => sum + (STAGE_MAPPING[stage]?.percentageWeight || 0),
    0
  );
  
  // Calculate weight of current stage
  const currentMapping = STAGE_MAPPING[currentStage];
  const currentWeight = currentMapping
    ? (currentMapping.percentageWeight * (currentStagePercentage / 100))
    : 0;
  
  // Calculate overall percentage
  return Math.min(100, Math.max(0, ((completedWeight + currentWeight) / totalWeight) * 100));
}