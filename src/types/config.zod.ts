import { z } from 'zod';

export const FileValidationConfigSchema = z.object({
  maxFileSize: z.number().min(1024).max(1073741824), // 1KB to 1GB
  allowedMimeTypes: z.array(z.string()),
  enableMagicNumberValidation: z.boolean(),
  cacheValidationResults: z.boolean(),
  cacheTTL: z.number().min(0),
});

export const SecurityScanningConfigSchema = z.object({
  enableZipBombDetection: z.boolean(),
  maxCompressionRatio: z.number().min(1),
  maxExtractedSize: z.number().min(1024),
  enablePathTraversalDetection: z.boolean(),
  enableMalwarePatternDetection: z.boolean(),
  scanTimeout: z.number().min(1000).max(300000), // 1s to 5min
});

export const SecurityConfigSchema = z.object({
  fileValidation: FileValidationConfigSchema,
  securityScanning: SecurityScanningConfigSchema,
});
