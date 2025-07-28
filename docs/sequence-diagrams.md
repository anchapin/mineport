# Sequence Diagrams for Key Processes

This document contains detailed sequence diagrams for the most important processes in the Minecraft Mod Converter system.

## 1. Complete Conversion Process

This diagram shows the full end-to-end conversion process from user request to final output.

```mermaid
sequenceDiagram
    participant User
    participant UI as UI Layer
    participant CS as ConversionService
    participant JQ as JobQueue
    participant CP as ConversionPipeline
    participant IM as IngestionModule
    participant ATM as AssetTranslationModule
    participant CM as ConfigurationModule
    participant LTE as LogicTranslationEngine
    participant PM as PackagingModule
    participant FS as File System
    
    User->>UI: Upload mod file
    UI->>CS: createConversionJob(input)
    CS->>JQ: addJob(conversionJob)
    JQ-->>CS: jobId
    CS-->>UI: ConversionJob
    UI-->>User: Job created (jobId)
    
    Note over JQ,CP: Job Processing Begins
    JQ->>CP: processJob(jobId)
    
    CP->>IM: ingestMod(modFile)
    IM->>FS: readModFile()
    FS-->>IM: modData
    IM->>IM: validateMod()
    IM->>IM: parseLicense()
    IM->>IM: extractAssets()
    IM->>IM: extractSourceCode()
    IM-->>CP: JavaMod
    
    CP->>ATM: translateAssets(javaAssets)
    ATM->>ATM: convertTextures()
    ATM->>ATM: convertModels()
    ATM->>ATM: convertSounds()
    ATM->>ATM: convertParticles()
    ATM-->>CP: BedrockAssets
    
    CP->>CM: translateConfiguration(javaConfig)
    CM->>CM: convertBlocks()
    CM->>CM: convertItems()
    CM->>CM: convertRecipes()
    CM-->>CP: BedrockConfiguration
    
    CP->>LTE: translateLogic(javaSource)
    LTE->>LTE: parseJava()
    LTE->>LTE: generateMMIR()
    LTE->>LTE: transpileToJS()
    LTE->>LTE: applyCompromises()
    LTE-->>CP: JavaScriptCode
    
    CP->>PM: packageAddon(allComponents)
    PM->>PM: createResourcePack()
    PM->>PM: createBehaviorPack()
    PM->>PM: generateManifests()
    PM->>FS: writeAddonFiles()
    PM-->>CP: BedrockAddon
    
    CP-->>JQ: jobCompleted(result)
    JQ->>CS: jobCompleted(jobId, result)
    CS->>UI: jobStatusUpdate(completed)
    UI->>User: Conversion completed
    
    User->>UI: downloadResult()
    UI->>CS: getJobResult(jobId)
    CS-->>UI: BedrockAddon
    UI-->>User: Download link
```

## 2. Job Queue Management

This diagram shows how jobs are managed in the queue system with priority and resource allocation.

```mermaid
sequenceDiagram
    participant CS as ConversionService
    participant JQ as JobQueue
    participant RA as ResourceAllocator
    participant Worker as Worker Thread
    participant CP as ConversionPipeline
    
    CS->>JQ: addJob(job, priority)
    JQ->>JQ: enqueueByPriority()
    JQ-->>CS: jobId
    
    loop Job Processing Loop
        JQ->>RA: requestResources(jobRequirements)
        alt Resources Available
            RA-->>JQ: resourcesAllocated
            JQ->>Worker: assignJob(job)
            Worker->>CP: processJob(job)
            
            CP-->>Worker: jobProgress(percentage)
            Worker->>JQ: updateJobStatus(progress)
            JQ->>CS: statusUpdate(jobId, progress)
            
            alt Job Successful
                CP-->>Worker: jobCompleted(result)
                Worker->>JQ: completeJob(jobId, result)
                JQ->>RA: releaseResources(jobId)
                JQ->>CS: jobCompleted(jobId, result)
            else Job Failed
                CP-->>Worker: jobFailed(error)
                Worker->>JQ: failJob(jobId, error)
                JQ->>RA: releaseResources(jobId)
                JQ->>CS: jobFailed(jobId, error)
            end
        else Resources Unavailable
            RA-->>JQ: resourcesUnavailable
            JQ->>JQ: waitForResources()
        end
    end
```

## 3. Error Handling and Collection

This diagram shows how errors are collected, categorized, and reported throughout the system.

```mermaid
sequenceDiagram
    participant Module as Any Module
    participant EC as ErrorCollector
    participant EH as ErrorHandler
    participant GEC as GlobalErrorCollector
    participant Logger
    participant UI as UI Layer
    
    Module->>Module: processData()
    alt Processing Error Occurs
        Module->>EC: addError(error)
        EC->>EC: categorizeError()
        EC->>EH: handleError(categorizedError)
        
        EH->>Logger: logError(error)
        EH->>GEC: addToGlobalCollection(error)
        
        alt Critical Error
            EH->>UI: notifyUser(criticalError)
            EH->>Module: stopProcessing()
        else Warning/Info
            EH->>Module: continueProcessing()
        end
        
        EH-->>EC: errorHandled
        EC-->>Module: errorRecorded
    end
    
    Note over Module,UI: End of Processing
    Module->>EC: getErrorSummary()
    EC->>GEC: aggregateErrors()
    GEC-->>EC: errorSummary
    EC-->>Module: ErrorSummary
    Module->>UI: reportErrors(errorSummary)
```

## 4. API Mapping Resolution

This diagram shows how API mappings are resolved with caching and fallback strategies.

```mermaid
sequenceDiagram
    participant LTE as LogicTranslationEngine
    participant AMS as APIMapperService
    participant Cache as CacheService
    participant DB as MappingDatabase
    participant ExtAPI as External API
    participant Legacy as LegacyMapping
    
    LTE->>AMS: getMapping(javaSignature)
    AMS->>Cache: get(javaSignature)
    
    alt Cache Hit
        Cache-->>AMS: mapping
        AMS-->>LTE: APIMapping
    else Cache Miss
        AMS->>DB: queryMapping(javaSignature)
        
        alt Mapping Found
            DB-->>AMS: mapping
            AMS->>Cache: store(javaSignature, mapping)
            AMS-->>LTE: APIMapping
        else Mapping Not Found
            AMS->>ExtAPI: fetchLatestMappings()
            
            alt External API Success
                ExtAPI-->>AMS: latestMappings
                AMS->>DB: updateMappings(latestMappings)
                AMS->>Cache: store(javaSignature, mapping)
                AMS-->>LTE: APIMapping
            else External API Failure
                AMS->>Legacy: getLegacyMapping(javaSignature)
                
                alt Legacy Found
                    Legacy-->>AMS: legacyMapping
                    AMS->>Cache: store(javaSignature, legacyMapping)
                    AMS-->>LTE: APIMapping
                else No Mapping Available
                    AMS-->>LTE: null
                    LTE->>LTE: handleUnmappableCode()
                end
            end
        end
    end
```

## 5. Compromise Strategy Application

This diagram shows how compromise strategies are selected and applied for unmappable features.

```mermaid
sequenceDiagram
    participant LTE as LogicTranslationEngine
    participant CSE as CompromiseStrategyEngine
    participant UP as UserPreferences
    participant Strategies as Strategy Registry
    participant UI as UI Layer
    
    LTE->>CSE: applyStrategy(unmappableFeature)
    CSE->>UP: getUserPreferences(featureType)
    UP-->>CSE: preferences
    
    CSE->>Strategies: getApplicableStrategies(feature, preferences)
    Strategies-->>CSE: strategyList
    
    CSE->>CSE: rankStrategies(strategyList, preferences)
    
    loop For Each Strategy (by rank)
        CSE->>CSE: evaluateStrategy(strategy, feature)
        alt Strategy Applicable
            CSE->>CSE: applyStrategy(strategy, feature)
            
            alt Strategy Successful
                CSE->>UI: notifyUser(strategyApplied)
                CSE-->>LTE: CompromiseResult
                break
            else Strategy Failed
                CSE->>CSE: tryNextStrategy()
            end
        else Strategy Not Applicable
            CSE->>CSE: tryNextStrategy()
        end
    end
    
    alt No Strategy Worked
        CSE->>UI: requestUserDecision(feature)
        UI->>User: showCompromiseOptions()
        User-->>UI: userChoice
        UI-->>CSE: userDecision
        CSE->>CSE: applyUserChoice(userDecision)
        CSE-->>LTE: CompromiseResult
    end
```

## 6. Configuration Management

This diagram shows how configuration is loaded, validated, and updated across the system.

```mermaid
sequenceDiagram
    participant Admin as Admin User
    participant AdminUI as Admin UI
    participant CAS as ConfigurationAdminService
    participant CS as ConfigurationService
    participant Validator as ConfigValidator
    participant Storage as ConfigStorage
    participant Modules as System Modules
    
    Admin->>AdminUI: updateConfiguration(newConfig)
    AdminUI->>CAS: validateAndUpdate(newConfig)
    
    CAS->>Validator: validate(newConfig)
    alt Validation Successful
        Validator-->>CAS: validationPassed
        CAS->>CS: updateConfiguration(newConfig)
        
        CS->>Storage: saveConfiguration(newConfig)
        Storage-->>CS: saved
        
        CS->>Modules: configurationUpdated(changes)
        
        loop For Each Module
            Modules->>Modules: applyNewConfiguration()
            Modules-->>CS: configurationApplied
        end
        
        CS-->>CAS: updateSuccessful
        CAS-->>AdminUI: success
        AdminUI-->>Admin: Configuration updated
        
    else Validation Failed
        Validator-->>CAS: validationErrors
        CAS-->>AdminUI: validationFailed(errors)
        AdminUI-->>Admin: Show validation errors
    end
```

## 7. Real-time Status Updates

This diagram shows how real-time status updates are propagated from the backend to the UI.

```mermaid
sequenceDiagram
    participant UI as UI Component
    participant WS as WebSocket
    participant CS as ConversionService
    participant CP as ConversionPipeline
    participant Module as Processing Module
    
    UI->>WS: connect()
    WS->>CS: registerClient(clientId)
    CS-->>WS: clientRegistered
    WS-->>UI: connected
    
    UI->>CS: subscribeToJob(jobId)
    CS-->>UI: subscribed
    
    Note over CP,Module: Job Processing
    Module->>CP: updateProgress(stage, percentage)
    CP->>CS: jobProgressUpdate(jobId, progress)
    
    CS->>WS: broadcastUpdate(jobId, progress)
    WS->>UI: progressUpdate(progress)
    UI->>UI: updateProgressBar()
    
    alt Job Completed
        Module->>CP: jobCompleted(result)
        CP->>CS: jobCompleted(jobId, result)
        CS->>WS: broadcastUpdate(jobId, completed)
        WS->>UI: jobCompleted(result)
        UI->>UI: showCompletionMessage()
    else Job Failed
        Module->>CP: jobFailed(error)
        CP->>CS: jobFailed(jobId, error)
        CS->>WS: broadcastUpdate(jobId, failed)
        WS->>UI: jobFailed(error)
        UI->>UI: showErrorMessage()
    end
```

## 8. Cache Management

This diagram shows how the caching system manages data across different cache levels.

```mermaid
sequenceDiagram
    participant Service as Any Service
    participant CS as CacheService
    participant L1 as L1 Cache (Memory)
    participant L2 as L2 Cache (Redis)
    participant DB as Database
    participant Monitor as Cache Monitor
    
    Service->>CS: get(key)
    CS->>L1: get(key)
    
    alt L1 Hit
        L1-->>CS: value
        CS->>Monitor: recordHit(L1, key)
        CS-->>Service: value
    else L1 Miss
        CS->>L2: get(key)
        
        alt L2 Hit
            L2-->>CS: value
            CS->>L1: store(key, value)
            CS->>Monitor: recordHit(L2, key)
            CS-->>Service: value
        else L2 Miss
            CS->>DB: query(key)
            DB-->>CS: value
            
            CS->>L2: store(key, value, ttl)
            CS->>L1: store(key, value)
            CS->>Monitor: recordMiss(key)
            CS-->>Service: value
        end
    end
    
    Note over Monitor: Cache Maintenance
    Monitor->>Monitor: checkCacheHealth()
    alt Cache Full
        Monitor->>L1: evictLRU()
        Monitor->>L2: evictExpired()
    end
    
    alt Cache Invalidation Needed
        Service->>CS: invalidate(pattern)
        CS->>L1: removeByPattern(pattern)
        CS->>L2: removeByPattern(pattern)
        CS->>Monitor: recordInvalidation(pattern)
    end
```

These sequence diagrams provide detailed views of the most critical processes in the system, showing how components interact over time and how data flows through the system during various operations.