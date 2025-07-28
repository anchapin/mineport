# Troubleshooting Guide

This guide helps you diagnose and resolve common issues when using the Minecraft Mod Converter.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Conversion Failures](#conversion-failures)
- [Performance Problems](#performance-problems)
- [Output Issues](#output-issues)
- [API and Integration Issues](#api-and-integration-issues)
- [Development Issues](#development-issues)
- [Error Reference](#error-reference)
- [Getting Help](#getting-help)

## Installation Issues

### Node.js Version Compatibility

**Problem:** Installation fails with Node.js version errors.

**Symptoms:**
```bash
npm ERR! engine Unsupported engine
npm ERR! Required: {"node":">=18.0.0","npm":">=8.0.0"}
```

**Solution:**
1. Check your Node.js version:
   ```bash
   node --version
   npm --version
   ```

2. Install a compatible Node.js version:
   ```bash
   # Using nvm (recommended)
   nvm install 18
   nvm use 18
   
   # Or download from nodejs.org
   # Install Node.js 18.x or 20.x
   ```

3. Clear npm cache and reinstall:
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

### Native Dependencies Build Failures

**Problem:** Native dependencies fail to compile during installation.

**Symptoms:**
```bash
gyp ERR! build error
gyp ERR! stack Error: `make` failed with exit code: 2
```

**Solution:**

**On macOS:**
```bash
# Install Xcode command line tools
xcode-select --install

# Install dependencies
npm install
```

**On Ubuntu/Debian:**
```bash
# Install build essentials
sudo apt-get update
sudo apt-get install build-essential python3

# Install dependencies
npm install
```

**On Windows:**
```bash
# Install Visual Studio Build Tools
npm install --global windows-build-tools

# Or install Visual Studio Community with C++ workload
# Then install dependencies
npm install
```

### Permission Issues

**Problem:** Permission denied errors during installation.

**Symptoms:**
```bash
npm ERR! Error: EACCES: permission denied
```

**Solution:**
```bash
# Fix npm permissions (Unix/macOS)
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Or use a Node version manager (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### Memory Issues During Installation

**Problem:** Installation fails with out-of-memory errors.

**Symptoms:**
```bash
FATAL ERROR: Ineffective mark-compacts near heap limit
```

**Solution:**
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm install

# Or install with reduced concurrency
npm install --maxsockets 1
```

## Conversion Failures

### Invalid JAR File Format

**Problem:** Mod validation fails with "Invalid JAR file format" error.

**Symptoms:**
```javascript
{
  "error": "Invalid JAR file format",
  "type": "validation",
  "severity": "error"
}
```

**Diagnosis:**
```bash
# Check if file is actually a JAR
file my-mod.jar

# Should output: "Java archive data (JAR)"
```

**Solutions:**
1. **Verify file integrity:**
   ```bash
   # Test JAR file
   jar tf my-mod.jar
   
   # Or use unzip
   unzip -t my-mod.jar
   ```

2. **Re-download the mod:**
   - Download from official source
   - Verify file size and checksum
   - Ensure complete download

3. **Check file permissions:**
   ```bash
   ls -la my-mod.jar
   chmod 644 my-mod.jar
   ```

### Unsupported Mod Loader

**Problem:** Mod uses an unsupported mod loader (Fabric, Quilt, etc.).

**Symptoms:**
```javascript
{
  "error": "Unsupported mod loader: fabric",
  "type": "validation",
  "severity": "error"
}
```

**Solutions:**
1. **Check supported loaders:**
   - Currently supports: Forge, ModLoader
   - Fabric support is planned for future releases

2. **Convert Fabric to Forge (if possible):**
   - Some Fabric mods have Forge equivalents
   - Check mod author's other releases

3. **Request support:**
   - File an issue for Fabric support
   - Provide sample Fabric mod for testing

### Memory Exhaustion During Conversion

**Problem:** Conversion fails with out-of-memory errors.

**Symptoms:**
```bash
FATAL ERROR: Reached heap limit Allocation failed
```

**Solutions:**
1. **Increase memory limit:**
   ```bash
   export NODE_OPTIONS="--max-old-space-size=8192"
   npm start
   ```

2. **Use streaming mode for large mods:**
   ```javascript
   const result = await conversionService.createConversionJob({
     modFile: './large-mod.jar',
     outputPath: './output',
     options: {
       streamingMode: true,
       chunkSize: 1024 * 1024 // 1MB chunks
     }
   });
   ```

3. **Process assets separately:**
   ```javascript
   // Process in smaller batches
   const assetBatches = chunkArray(assets, 50);
   for (const batch of assetBatches) {
     await assetModule.translateAssets(batch);
   }
   ```

### API Mapping Failures

**Problem:** Java API calls cannot be mapped to Bedrock equivalents.

**Symptoms:**
```javascript
{
  "error": "No mapping found for: org.bukkit.entity.Player.getHealth()",
  "type": "translation",
  "severity": "warning"
}
```

**Solutions:**
1. **Update API mappings:**
   ```bash
   # Update to latest mappings
   npm run update-mappings
   
   # Or manually update
   curl -o api-mappings.json https://api.example.com/latest-mappings
   ```

2. **Add custom mappings:**
   ```javascript
   const customMappings = {
     "org.bukkit.entity.Player.getHealth()": {
       bedrockEquivalent: "player.getComponent('health').currentValue",
       conversionType: "direct",
       notes: "Direct property access"
     }
   };
   
   await apiMapper.addMappings(customMappings);
   ```

3. **Use compromise strategies:**
   ```javascript
   const result = await conversionService.createConversionJob({
     modFile: './mod.jar',
     outputPath: './output',
     options: {
       compromiseStrategy: 'aggressive', // Try harder to find alternatives
       allowPartialConversion: true
     }
   });
   ```

### Texture Conversion Issues

**Problem:** Texture files fail to convert or appear corrupted.

**Symptoms:**
- Black or transparent textures in output
- "Unsupported texture format" errors
- Texture size/quality issues

**Solutions:**
1. **Check texture formats:**
   ```bash
   # Identify texture formats in mod
   find extracted-mod/ -name "*.png" -exec file {} \;
   ```

2. **Enable texture optimization:**
   ```javascript
   const result = await assetModule.translateAssets(assets, {
     optimizeTextures: true,
     maxTextureSize: 1024,
     compressionQuality: 85
   });
   ```

3. **Handle animated textures:**
   ```javascript
   // Animated textures need special handling
   const animatedTextures = assets.textures.filter(t => t.animated);
   for (const texture of animatedTextures) {
     await textureConverter.convertAnimatedTexture(texture);
   }
   ```

### Code Translation Failures

**Problem:** Java code cannot be translated to JavaScript.

**Symptoms:**
```javascript
{
  "error": "Failed to parse Java code: Syntax error at line 45",
  "type": "parsing",
  "severity": "error"
}
```

**Solutions:**
1. **Enable LLM translation:**
   ```javascript
   const logicEngine = new LogicTranslationEngine({
     enableLLMTranslation: true,
     llmProvider: 'openai',
     fallbackToManual: true
   });
   ```

2. **Simplify complex code:**
   - Break down large methods
   - Remove complex generics
   - Simplify inheritance hierarchies

3. **Use manual translation:**
   ```javascript
   // Mark for manual translation
   const manualTranslations = {
     'ComplexClass.java': './manual-translations/ComplexClass.js'
   };
   
   await logicEngine.addManualTranslations(manualTranslations);
   ```

## Performance Problems

### Slow Conversion Speed

**Problem:** Conversion takes much longer than expected.

**Diagnosis:**
```javascript
// Enable performance monitoring
const conversionService = new ConversionService({
  jobQueue,
  performanceMonitoring: true,
  statusUpdateInterval: 500
});

// Monitor job progress
conversionService.on('job:status', (status) => {
  console.log(`Stage: ${status.currentStage}, Progress: ${status.progress}%`);
  console.log(`ETA: ${status.estimatedTimeRemaining}ms`);
});
```

**Solutions:**
1. **Increase concurrency:**
   ```javascript
   const jobQueue = new JobQueue({ 
     maxConcurrent: 6 // Increase from default 3
   });
   
   const resourceAllocator = new ResourceAllocator({
     maxWorkers: 8 // Increase worker count
   });
   ```

2. **Optimize asset processing:**
   ```javascript
   const assetModule = new AssetTranslationModule({
     parallelProcessing: true,
     batchSize: 100,
     skipOptimization: false // Keep optimizations for better output
   });
   ```

3. **Use caching:**
   ```javascript
   const cacheService = new CacheService({
     enabled: true,
     ttl: 3600000, // 1 hour
     maxSize: 1000
   });
   ```

### High Memory Usage

**Problem:** Conversion process uses excessive memory.

**Diagnosis:**
```javascript
// Monitor memory usage
const resourceAllocator = new ResourceAllocator({
  memoryMonitoring: true,
  memoryThreshold: 0.8 // Alert at 80% usage
});

resourceAllocator.on('memory:high', (usage) => {
  console.log(`High memory usage: ${usage.percentage}%`);
});
```

**Solutions:**
1. **Enable garbage collection:**
   ```bash
   node --expose-gc --max-old-space-size=4096 dist/src/index.js
   ```

2. **Process in smaller batches:**
   ```javascript
   const batchSize = 25; // Reduce from default 100
   const assetBatches = chunkArray(assets, batchSize);
   
   for (const batch of assetBatches) {
     await processAssetBatch(batch);
     // Force garbage collection if available
     if (global.gc) global.gc();
   }
   ```

3. **Use streaming for large files:**
   ```javascript
   const streamProcessor = new StreamingProcessor({
     chunkSize: 512 * 1024, // 512KB chunks
     maxBufferSize: 10 * 1024 * 1024 // 10MB buffer
   });
   ```

### CPU Bottlenecks

**Problem:** High CPU usage slows down the system.

**Solutions:**
1. **Limit worker threads:**
   ```javascript
   const workerPool = new WorkerPool({
     maxWorkers: Math.min(4, os.cpus().length - 1) // Leave one CPU free
   });
   ```

2. **Add processing delays:**
   ```javascript
   const jobQueue = new JobQueue({
     processingDelay: 100, // 100ms delay between jobs
     throttleEnabled: true
   });
   ```

3. **Use priority scheduling:**
   ```javascript
   // Prioritize smaller jobs
   const smallJobPriority = 8;
   const largeJobPriority = 3;
   
   jobQueue.addJob('conversion', smallJobData, { priority: smallJobPriority });
   ```

## Output Issues

### Invalid Bedrock Addon Structure

**Problem:** Generated addon doesn't work in Minecraft Bedrock.

**Symptoms:**
- Addon doesn't appear in game
- "Invalid addon" error in Minecraft
- Missing manifest or incorrect format

**Diagnosis:**
```bash
# Validate addon structure
ls -la output-addon/
cat output-addon/manifest.json

# Check for required files
find output-addon/ -name "manifest.json"
find output-addon/ -name "*.js" -o -name "*.json"
```

**Solutions:**
1. **Validate manifest format:**
   ```javascript
   const validator = new AddonValidator();
   const result = await validator.validateManifest('./output-addon/manifest.json');
   
   if (!result.valid) {
     console.log('Manifest errors:', result.errors);
   }
   ```

2. **Check UUID format:**
   ```javascript
   // Ensure UUIDs are properly formatted
   const manifest = JSON.parse(fs.readFileSync('manifest.json'));
   console.log('Header UUID:', manifest.header.uuid);
   console.log('Module UUIDs:', manifest.modules.map(m => m.uuid));
   ```

3. **Verify file structure:**
   ```
   addon/
   ├── manifest.json
   ├── pack_icon.png
   ├── scripts/
   │   └── main.js
   ├── textures/
   │   └── blocks/
   └── models/
       └── entity/
   ```

### Missing or Corrupted Assets

**Problem:** Textures, models, or sounds are missing or corrupted in output.

**Solutions:**
1. **Enable asset validation:**
   ```javascript
   const assetModule = new AssetTranslationModule({
     validateOutput: true,
     repairCorrupted: true,
     generateFallbacks: true
   });
   ```

2. **Check asset paths:**
   ```javascript
   // Verify asset references
   const assetValidator = new AssetValidator();
   const missingAssets = await assetValidator.findMissingAssets('./output-addon');
   
   console.log('Missing assets:', missingAssets);
   ```

3. **Regenerate corrupted assets:**
   ```javascript
   const corruptedAssets = await assetValidator.findCorruptedAssets('./output-addon');
   
   for (const asset of corruptedAssets) {
     await assetModule.regenerateAsset(asset);
   }
   ```

### Incorrect Behavior Pack Logic

**Problem:** JavaScript behavior doesn't work as expected in Bedrock.

**Solutions:**
1. **Enable source maps:**
   ```javascript
   const logicEngine = new LogicTranslationEngine({
     generateSourceMaps: true,
     includeDebugInfo: true
   });
   ```

2. **Validate generated JavaScript:**
   ```javascript
   const jsValidator = new JavaScriptValidator();
   const validationResult = await jsValidator.validate('./output-addon/scripts/');
   
   if (!validationResult.valid) {
     console.log('JavaScript errors:', validationResult.errors);
   }
   ```

3. **Test in development environment:**
   ```bash
   # Use Bedrock Dedicated Server for testing
   bedrock_server --world-name test --gamemode creative
   ```

## API and Integration Issues

### Service Connection Failures

**Problem:** Cannot connect to conversion services or dependencies.

**Symptoms:**
```javascript
{
  "error": "Connection refused: ECONNREFUSED",
  "type": "network",
  "severity": "error"
}
```

**Solutions:**
1. **Check service status:**
   ```bash
   # Check if MongoDB is running
   brew services list | grep mongodb
   sudo systemctl status mongod
   
   # Check if Redis is running
   redis-cli ping
   ```

2. **Verify configuration:**
   ```javascript
   const config = {
     database: {
       url: process.env.MONGODB_URL || 'mongodb://localhost:27017/minecraft-converter',
       options: { useNewUrlParser: true }
     },
     cache: {
       url: process.env.REDIS_URL || 'redis://localhost:6379',
       ttl: 3600
     }
   };
   ```

3. **Use connection pooling:**
   ```javascript
   const dbConnection = new DatabaseConnection({
     poolSize: 10,
     retryAttempts: 3,
     retryDelay: 1000
   });
   ```

### Authentication Issues

**Problem:** API authentication fails for external services.

**Solutions:**
1. **Check API keys:**
   ```bash
   # Verify environment variables
   echo $GITHUB_TOKEN
   echo $OPENAI_API_KEY
   ```

2. **Refresh tokens:**
   ```javascript
   const authService = new AuthenticationService();
   await authService.refreshToken('github');
   ```

3. **Use service accounts:**
   ```javascript
   const serviceAccount = {
     type: 'service_account',
     project_id: 'your-project',
     private_key: process.env.SERVICE_ACCOUNT_KEY
   };
   ```

### Rate Limiting

**Problem:** External API calls are being rate limited.

**Solutions:**
1. **Implement backoff strategy:**
   ```javascript
   const apiClient = new APIClient({
     retryStrategy: 'exponential',
     maxRetries: 5,
     baseDelay: 1000
   });
   ```

2. **Use request queuing:**
   ```javascript
   const requestQueue = new RequestQueue({
     maxConcurrent: 2,
     rateLimitPerSecond: 10
   });
   ```

3. **Cache API responses:**
   ```javascript
   const cachedApiClient = new CachedAPIClient({
     ttl: 3600000, // 1 hour
     maxCacheSize: 1000
   });
   ```

## Development Issues

### TypeScript Compilation Errors

**Problem:** TypeScript compilation fails with type errors.

**Solutions:**
1. **Update type definitions:**
   ```bash
   npm update @types/node @types/express
   npm install --save-dev typescript@latest
   ```

2. **Check tsconfig.json:**
   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "ESNext",
       "moduleResolution": "node",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true
     }
   }
   ```

3. **Fix common type issues:**
   ```typescript
   // Use proper type assertions
   const result = data as ConversionResult;
   
   // Handle undefined values
   const value = config?.conversion?.maxConcurrency ?? 4;
   
   // Use proper async/await types
   const processData = async (input: ConversionInput): Promise<ConversionResult> => {
     // Implementation
   };
   ```

### Test Failures

**Problem:** Unit or integration tests are failing.

**Solutions:**
1. **Update test dependencies:**
   ```bash
   npm update vitest @vitest/ui c8
   ```

2. **Fix test environment:**
   ```javascript
   // vitest.config.ts
   export default defineConfig({
     test: {
       environment: 'node',
       globals: true,
       setupFiles: ['./tests/setup.ts']
     }
   });
   ```

3. **Mock external dependencies:**
   ```javascript
   // Mock file system operations
   vi.mock('fs/promises', () => ({
     readFile: vi.fn(),
     writeFile: vi.fn(),
     mkdir: vi.fn()
   }));
   ```

### Build Issues

**Problem:** Build process fails or produces incorrect output.

**Solutions:**
1. **Clean build artifacts:**
   ```bash
   rm -rf dist/ node_modules/.cache/
   npm run build
   ```

2. **Check build configuration:**
   ```json
   {
     "scripts": {
       "build": "tsc --build",
       "build:watch": "tsc --build --watch",
       "clean": "tsc --build --clean"
     }
   }
   ```

3. **Verify output structure:**
   ```bash
   # Check generated files
   find dist/ -name "*.js" -o -name "*.d.ts"
   
   # Verify main entry point
   node dist/src/index.js --version
   ```

## Error Reference

### Common Error Codes

| Code | Type | Description | Solution |
|------|------|-------------|----------|
| `CONV-001` | Validation | Invalid input file format | Check file format and integrity |
| `CONV-002` | Parsing | Java code parsing failed | Simplify code or enable LLM translation |
| `CONV-003` | Translation | API mapping not found | Update mappings or use compromise strategy |
| `CONV-004` | Asset | Texture conversion failed | Check texture format and size |
| `CONV-005` | System | Out of memory | Increase memory limit or use streaming |
| `CONV-006` | Network | Service connection failed | Check service status and configuration |
| `CONV-007` | Security | Path traversal detected | Validate input paths |
| `CONV-008` | Config | Invalid configuration | Check configuration format |

### Error Severity Levels

- **Info**: Informational messages, no action required
- **Warning**: Non-fatal issues, conversion continues with compromises
- **Error**: Recoverable errors, partial conversion possible
- **Critical**: Fatal errors, conversion cannot continue

### Debug Mode

Enable debug logging for detailed error information:

```bash
# Enable debug logging
DEBUG=minecraft-mod-converter:* npm start

# Or set log level
LOG_LEVEL=debug npm start
```

```javascript
// Enable debug in code
const logger = createLogger('MyModule', { level: 'debug' });
logger.debug('Detailed debug information', { context: data });
```

## Getting Help

### Before Asking for Help

1. **Check this troubleshooting guide**
2. **Search existing issues** on GitHub
3. **Enable debug logging** and collect error messages
4. **Try the latest version** of the converter
5. **Prepare a minimal reproduction case**

### Information to Include

When reporting issues, please include:

- **System information**: OS, Node.js version, npm version
- **Converter version**: `npm list minecraft-mod-converter`
- **Complete error messages** with stack traces
- **Input mod information**: Mod loader, Minecraft version, mod size
- **Configuration used**: Conversion options, custom settings
- **Steps to reproduce** the issue

### Where to Get Help

1. **GitHub Issues**: [Report bugs and request features](https://github.com/your-org/minecraft-mod-converter/issues)
2. **GitHub Discussions**: [Ask questions and get community help](https://github.com/your-org/minecraft-mod-converter/discussions)
3. **Discord**: [Join our Discord server](https://discord.gg/minecraft-mod-converter) for real-time help
4. **Documentation**: [Check the docs directory](../docs/) for detailed guides

### Commercial Support

For commercial support, training, or custom development:
- Email: [support@your-org.com](mailto:support@your-org.com)
- Website: [Commercial Support](https://your-org.com/minecraft-mod-converter/support)

---

**Remember**: Most issues can be resolved by following this guide. If you're still having problems, don't hesitate to ask for help in our community channels!