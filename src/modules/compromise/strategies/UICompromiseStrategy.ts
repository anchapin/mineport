import { Feature, FeatureType, CompromiseLevel } from '../../../types/compromise.js';
import { ConversionContext } from '../../../types/modules.js';
import { CompromiseStrategy, CompromiseResult, CompromiseOptions } from '../CompromiseStrategy.js';
import { logger } from '../../../utils/logger.js';

/**
 * Strategy for handling UI features that don't have direct Bedrock equivalents
 */
export class UICompromiseStrategy extends CompromiseStrategy {
  constructor() {
    super(
      'UICompromise',
      [FeatureType.GUI, FeatureType.HUD, FeatureType.MENU],
      CompromiseLevel.MEDIUM
    );
  }

  async apply(
    feature: Feature,
    context: ConversionContext,
    options: CompromiseOptions
  ): Promise<CompromiseResult> {
    logger.info('Applying UI compromise strategy', {
      featureName: feature.name,
      featureType: feature.type,
    });

    try {
      const analysis = this.analyzeUIFeature(feature);

      let modifiedFeature: Feature;
      let description: string;
      let impactLevel: CompromiseLevel;
      let userExperienceImpact: number;
      const warnings: string[] = [];
      const suggestions: string[] = [];

      switch (analysis.compromiseType) {
        case 'inventory_adaptation':
          modifiedFeature = this.createInventoryAdaptation(feature);
          description = 'Custom GUI adapted to use standard inventory interface';
          impactLevel = CompromiseLevel.LOW;
          userExperienceImpact = 25;
          suggestions.push('Use custom item names and lore to maintain functionality');
          break;

        case 'chat_command_replacement':
          modifiedFeature = this.createChatCommandReplacement(feature);
          description = 'GUI functionality replaced with chat commands';
          impactLevel = CompromiseLevel.MEDIUM;
          userExperienceImpact = 45;
          warnings.push('Users will need to learn command syntax');
          suggestions.push('Provide clear command help and autocomplete');
          break;

        case 'book_interface':
          modifiedFeature = this.createBookInterface(feature);
          description = 'Complex UI replaced with interactive book interface';
          impactLevel = CompromiseLevel.MEDIUM;
          userExperienceImpact = 40;
          suggestions.push('Use clickable text and page navigation for interactivity');
          break;

        case 'entity_interaction':
          modifiedFeature = this.createEntityInteraction(feature);
          description = 'GUI replaced with entity-based interaction system';
          impactLevel = CompromiseLevel.MEDIUM;
          userExperienceImpact = 35;
          suggestions.push('Use villager-like trading interfaces for complex interactions');
          break;

        case 'scoreboard_display':
          modifiedFeature = this.createScoreboardDisplay(feature);
          description = 'HUD elements replaced with scoreboard display';
          impactLevel = CompromiseLevel.LOW;
          userExperienceImpact = 20;
          warnings.push('Limited formatting options compared to custom HUD');
          suggestions.push('Use multiple scoreboards for complex data display');
          break;

        case 'documentation_guide':
          modifiedFeature = this.createDocumentationGuide(feature);
          description = 'Complex UI documented for manual implementation';
          impactLevel = CompromiseLevel.HIGH;
          userExperienceImpact = 70;
          warnings.push('UI functionality will not be available in converted addon');
          warnings.push('Requires custom UI development using Bedrock UI framework');
          suggestions.push('Consider using behavior packs to simulate UI functionality');
          suggestions.push('Implement as resource pack with custom UI definitions');
          break;

        default:
          throw new Error(`Unknown compromise type: ${analysis.compromiseType}`);
      }

      return {
        success: true,
        modifiedFeature,
        description,
        impactLevel,
        userExperienceImpact,
        warnings,
        suggestions,
        metadata: {
          strategyUsed: this.name,
          confidence: analysis.confidence,
          alternativesConsidered: analysis.alternativesConsidered,
          reversible: analysis.compromiseType !== 'documentation_guide',
        },
      };
    } catch (error) {
      logger.error('Failed to apply UI compromise strategy', {
        featureName: feature.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        description: 'Failed to apply UI compromise strategy',
        impactLevel: CompromiseLevel.CRITICAL,
        userExperienceImpact: 100,
        warnings: ['Strategy application failed'],
        suggestions: ['Consider alternative UI approaches or manual implementation'],
        metadata: {
          strategyUsed: this.name,
          confidence: 0,
          alternativesConsidered: [],
          reversible: false,
        },
      };
    }
  }

  async estimateImpact(
    feature: Feature,
    context: ConversionContext
  ): Promise<{
    impactLevel: CompromiseLevel;
    userExperienceImpact: number;
    confidence: number;
  }> {
    const analysis = this.analyzeUIFeature(feature);

    let impactLevel: CompromiseLevel;
    let userExperienceImpact: number;

    switch (analysis.compromiseType) {
      case 'inventory_adaptation':
        impactLevel = CompromiseLevel.LOW;
        userExperienceImpact = 25;
        break;
      case 'chat_command_replacement':
        impactLevel = CompromiseLevel.MEDIUM;
        userExperienceImpact = 45;
        break;
      case 'book_interface':
        impactLevel = CompromiseLevel.MEDIUM;
        userExperienceImpact = 40;
        break;
      case 'entity_interaction':
        impactLevel = CompromiseLevel.MEDIUM;
        userExperienceImpact = 35;
        break;
      case 'scoreboard_display':
        impactLevel = CompromiseLevel.LOW;
        userExperienceImpact = 20;
        break;
      case 'documentation_guide':
        impactLevel = CompromiseLevel.HIGH;
        userExperienceImpact = 70;
        break;
      default:
        impactLevel = CompromiseLevel.CRITICAL;
        userExperienceImpact = 100;
    }

    return {
      impactLevel,
      userExperienceImpact,
      confidence: analysis.confidence,
    };
  }

  getDescription(): string {
    return 'Handles custom UI elements by adapting them to available Bedrock interface options';
  }

  protected isApplicable(feature: Feature, context: ConversionContext): boolean {
    if (!this.supportedFeatureTypes.includes(feature.type)) {
      return false;
    }

    // Check for UI-specific properties
    const properties = feature.properties || {};
    const hasUIProps =
      properties.guiType ||
      properties.interfaceElements ||
      properties.customUI ||
      properties.hudElements;

    return hasUIProps || this.hasUIKeywords(feature.name);
  }

  /**
   * Check if feature name contains UI-related keywords
   */
  private hasUIKeywords(name: string): boolean {
    const keywords = ['gui', 'hud', 'menu', 'interface', 'screen', 'panel', 'dialog', 'window'];
    const lowerName = name.toLowerCase();
    return keywords.some((keyword) => lowerName.includes(keyword));
  }

  /**
   * Analyze the UI feature to determine the best compromise approach
   */
  private analyzeUIFeature(feature: Feature): {
    compromiseType:
      | 'inventory_adaptation'
      | 'chat_command_replacement'
      | 'book_interface'
      | 'entity_interaction'
      | 'scoreboard_display'
      | 'documentation_guide';
    confidence: number;
    alternativesConsidered: string[];
  } {
    const properties = feature.properties || {};
    const alternativesConsidered: string[] = [];

    // Check for inventory-like interfaces
    if (properties.hasSlots || properties.itemManagement || feature.type === FeatureType.GUI) {
      alternativesConsidered.push('Inventory adaptation', 'Chest interface', 'Custom container');
      return {
        compromiseType: 'inventory_adaptation',
        confidence: 80,
        alternativesConsidered,
      };
    }

    // Check for command-replaceable functionality
    if (properties.hasButtons || properties.simpleActions) {
      alternativesConsidered.push('Chat command replacement', 'Function-based commands');
      return {
        compromiseType: 'chat_command_replacement',
        confidence: 75,
        alternativesConsidered,
      };
    }

    // Check for information display interfaces
    if (properties.textDisplay || properties.informationPanel) {
      alternativesConsidered.push('Book interface', 'Sign-based display', 'Chat messages');
      return {
        compromiseType: 'book_interface',
        confidence: 70,
        alternativesConsidered,
      };
    }

    // Check for interactive elements
    if (properties.npcInteraction || properties.tradingInterface) {
      alternativesConsidered.push('Entity interaction', 'Villager trading', 'NPC dialogue');
      return {
        compromiseType: 'entity_interaction',
        confidence: 75,
        alternativesConsidered,
      };
    }

    // Check for HUD elements
    if (feature.type === FeatureType.HUD || properties.statusDisplay) {
      alternativesConsidered.push('Scoreboard display', 'Action bar text', 'Title display');
      return {
        compromiseType: 'scoreboard_display',
        confidence: 85,
        alternativesConsidered,
      };
    }

    // Complex UI needs documentation
    alternativesConsidered.push('Manual implementation', 'Feature removal', 'Alternative design');
    return {
      compromiseType: 'documentation_guide',
      confidence: 50,
      alternativesConsidered,
    };
  }

  /**
   * Create an inventory-based adaptation
   */
  private createInventoryAdaptation(feature: Feature): Feature {
    return {
      ...feature,
      type: FeatureType.CONTAINER,
      properties: {
        ...feature.properties,
        replacementType: 'inventory',
        containerType: this.determineContainerType(feature),
        slotMapping: this.generateSlotMapping(feature),
        originalUI: feature.name,
      },
      metadata: {
        ...feature.metadata,
        compromiseApplied: true,
        originalType: feature.type,
      },
    };
  }

  /**
   * Create a chat command replacement
   */
  private createChatCommandReplacement(feature: Feature): Feature {
    return {
      ...feature,
      type: FeatureType.COMMAND,
      properties: {
        ...feature.properties,
        replacementType: 'chat_commands',
        commandMappings: this.generateCommandMappings(feature),
        helpText: this.generateHelpText(feature),
        originalUI: feature.name,
      },
      metadata: {
        ...feature.metadata,
        compromiseApplied: true,
        originalType: feature.type,
      },
    };
  }

  /**
   * Create a book-based interface
   */
  private createBookInterface(feature: Feature): Feature {
    return {
      ...feature,
      type: FeatureType.ITEM,
      properties: {
        ...feature.properties,
        replacementType: 'book_interface',
        bookContent: this.generateBookContent(feature),
        interactiveElements: this.extractInteractiveElements(feature),
        originalUI: feature.name,
      },
      metadata: {
        ...feature.metadata,
        compromiseApplied: true,
        originalType: feature.type,
      },
    };
  }

  /**
   * Create an entity-based interaction
   */
  private createEntityInteraction(feature: Feature): Feature {
    return {
      ...feature,
      type: FeatureType.ENTITY,
      properties: {
        ...feature.properties,
        replacementType: 'entity_interaction',
        entityType: 'villager',
        tradeOffers: this.generateTradeOffers(feature),
        dialogueTree: this.generateDialogueTree(feature),
        originalUI: feature.name,
      },
      metadata: {
        ...feature.metadata,
        compromiseApplied: true,
        originalType: feature.type,
      },
    };
  }

  /**
   * Create a scoreboard display
   */
  private createScoreboardDisplay(feature: Feature): Feature {
    return {
      ...feature,
      type: FeatureType.SCOREBOARD,
      properties: {
        ...feature.properties,
        replacementType: 'scoreboard',
        scoreboardObjectives: this.generateScoreboardObjectives(feature),
        displayFormat: this.generateDisplayFormat(feature),
        originalUI: feature.name,
      },
      metadata: {
        ...feature.metadata,
        compromiseApplied: true,
        originalType: feature.type,
      },
    };
  }

  /**
   * Create a documentation guide
   */
  private createDocumentationGuide(feature: Feature): Feature {
    return {
      ...feature,
      type: FeatureType.DOCUMENTATION,
      properties: {
        ...feature.properties,
        implementationType: 'manual_ui',
        documentationPath: `docs/ui/${feature.name}.md`,
        uiRequirements: this.analyzeUIRequirements(feature),
        originalFeature: feature,
      },
      metadata: {
        ...feature.metadata,
        compromiseApplied: true,
        originalType: feature.type,
        requiresManualImplementation: true,
      },
    };
  }

  // Helper methods for generating replacement content

  private determineContainerType(feature: Feature): string {
    const properties = feature.properties || {};

    if (properties.slotCount && properties.slotCount <= 27) {
      return 'chest';
    } else if (properties.slotCount && properties.slotCount <= 54) {
      return 'double_chest';
    } else if (properties.hasWorkbench) {
      return 'crafting_table';
    } else if (properties.hasFurnace) {
      return 'furnace';
    }

    return 'generic_9x3'; // Default container
  }

  private generateSlotMapping(feature: Feature): any {
    const properties = feature.properties || {};
    return {
      inputSlots: properties.inputSlots || [],
      outputSlots: properties.outputSlots || [],
      displaySlots: properties.displaySlots || [],
      totalSlots: properties.slotCount || 27,
    };
  }

  private generateCommandMappings(feature: Feature): any {
    const properties = feature.properties || {};
    const commands: any = {};

    if (properties.buttons) {
      properties.buttons.forEach((button: any, index: number) => {
        commands[`action${index + 1}`] = {
          command: `/function ${feature.name}_${button.name}`,
          description: button.description || `Execute ${button.name}`,
        };
      });
    }

    return commands;
  }

  private generateHelpText(feature: Feature): string {
    return (
      `Commands for ${feature.name}:\n` +
      `Use /function commands to access functionality.\n` +
      `Type /help ${feature.name} for detailed usage.`
    );
  }

  private generateBookContent(feature: Feature): any {
    return {
      title: feature.name,
      pages: this.extractTextContent(feature),
      clickableElements: this.extractClickableElements(feature),
    };
  }

  private extractInteractiveElements(feature: Feature): string[] {
    const properties = feature.properties || {};
    return properties.interactiveElements || [];
  }

  private generateTradeOffers(feature: Feature): any[] {
    const properties = feature.properties || {};
    return (
      properties.tradeOffers || [
        {
          wants: [{ item: 'emerald', quantity: 1 }],
          gives: [{ item: 'paper', quantity: 1 }],
          description: `Access ${feature.name} functionality`,
        },
      ]
    );
  }

  private generateDialogueTree(feature: Feature): any {
    return {
      root: {
        text: `Welcome to ${feature.name}`,
        options: [
          { text: 'Learn more', action: 'info' },
          { text: 'Use feature', action: 'execute' },
          { text: 'Exit', action: 'close' },
        ],
      },
    };
  }

  private generateScoreboardObjectives(feature: Feature): any[] {
    const properties = feature.properties || {};
    return (
      properties.hudElements?.map((element: any) => ({
        name: element.name,
        displayName: element.displayName || element.name,
        type: element.type || 'dummy',
      })) || []
    );
  }

  private generateDisplayFormat(feature: Feature): any {
    return {
      position: 'sidebar',
      sortOrder: 'descending',
      showNumbers: true,
    };
  }

  private analyzeUIRequirements(feature: Feature): any {
    return {
      uiFramework: 'bedrock_ui',
      complexity: 'high',
      requiredElements: this.extractUIElements(feature),
      interactionTypes: this.extractInteractionTypes(feature),
    };
  }

  private extractTextContent(feature: Feature): string[] {
    const properties = feature.properties || {};
    return properties.textContent || [`Information about ${feature.name}`];
  }

  private extractClickableElements(feature: Feature): any[] {
    const properties = feature.properties || {};
    return properties.clickableElements || [];
  }

  private extractUIElements(feature: Feature): string[] {
    const properties = feature.properties || {};
    return properties.uiElements || ['buttons', 'text_fields', 'panels'];
  }

  private extractInteractionTypes(feature: Feature): string[] {
    const properties = feature.properties || {};
    return properties.interactionTypes || ['click', 'hover', 'input'];
  }
}
