import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../../utils/logger.js';
import { ErrorSeverity } from '../../types/errors.js';

const logger = createLogger('SoundProcessor');

import { JavaSoundFile, BedrockSoundFile } from '../../types/assets.js';

/**
 * Interface for sound event mapping
 */
export interface SoundEventMapping {
  javaEvent: string;
  bedrockEvent: string;
  category: string;
}

/**
 * Interface for sound conversion result
 */
export interface SoundConversionResult {
  convertedSounds: BedrockSoundFile[];
  soundsJson: object;
  conversionNotes: SoundConversionNote[];
}

/**
 * Interface for sound conversion notes/warnings
 */
export interface SoundConversionNote {
  type: ErrorSeverity;
  message: string;
  soundPath?: string;
}

/**
 * Class responsible for converting Java Edition sound files to Bedrock Edition format
 * and generating the appropriate sounds.json file.
 */
export class SoundProcessor {
  // Common sound formats supported by both Java and Bedrock
  private readonly COMMON_FORMATS = ['ogg', 'wav'];

  // Formats that need conversion (Java to Bedrock)
  private readonly CONVERSION_MAP: Record<string, string> = {
    mp3: 'ogg', // Java supports MP3, Bedrock prefers OGG
    flac: 'ogg', // FLAC needs conversion to OGG for Bedrock
  };

  // Sound categories mapping (Java to Bedrock)
  private readonly CATEGORY_MAP: Record<string, string> = {
    master: 'master',
    music: 'music',
    record: 'record',
    weather: 'weather',
    block: 'block',
    hostile: 'hostile',
    neutral: 'neutral',
    player: 'player',
    ambient: 'ambient',
    voice: 'voice',
  };

  /**
   * Converts a collection of Java sound files to Bedrock format
   *
   * @param javaSounds - Array of Java sound files to convert
   * @returns Conversion result with converted sounds, sounds.json, and notes
   */
  public async convertSounds(javaSounds: JavaSoundFile[]): Promise<SoundConversionResult> {
    logger.info(`Converting ${javaSounds.length} sound files`);

    const convertedSounds: BedrockSoundFile[] = [];
    const conversionNotes: SoundConversionNote[] = [];
    const soundEvents: Record<string, any> = {};

    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const javaSound of javaSounds) {
      try {
        const bedrockSound = await this.convertSingleSound(javaSound);
        convertedSounds.push(bedrockSound);

        // Extract sound event information from the path
        const soundEvent = this.extractSoundEvent(javaSound.path);
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (soundEvent) {
          this.addSoundToEvents(soundEvent, bedrockSound, soundEvents);
        }
      } catch (error) {
        logger.error(`Failed to convert sound ${javaSound.path}: ${error}`);
        conversionNotes.push({
          type: ErrorSeverity.ERROR,
          message: `Failed to convert sound: ${error instanceof Error ? error.message : String(error)}`,
          soundPath: javaSound.path,
        });
      }
    }

    // Generate the sounds.json structure
    const soundsJson = this.generateSoundsJson(soundEvents);

    return {
      convertedSounds,
      soundsJson,
      conversionNotes,
    };
  }

  /**
   * Converts a single Java sound file to Bedrock format
   *
   * @param javaSound - Java sound file to convert
   * @returns Converted Bedrock sound file
   */
  private async convertSingleSound(javaSound: JavaSoundFile): Promise<BedrockSoundFile> {
    // Map the Java sound path to the corresponding Bedrock path
    const bedrockPath = this.mapSoundPath(javaSound.path);

    // Check if format conversion is needed
    const fileExtension = path.extname(javaSound.path).substring(1).toLowerCase();
    const soundData = javaSound.data;
    const metadata = { ...javaSound.metadata };

    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (this.CONVERSION_MAP[fileExtension]) {
      // In a real implementation, this would use a library like ffmpeg to convert the audio
      // For this implementation, we'll just log that conversion would happen
      logger.info(
        `Would convert ${fileExtension} to ${this.CONVERSION_MAP[fileExtension]} for ${javaSound.path}`
      );

      // This is a placeholder for actual conversion logic
      // soundData = await this.convertAudioFormat(javaSound.data, fileExtension, this.CONVERSION_MAP[fileExtension]);

      // Add a note about the conversion
      logger.info(
        `Sound format conversion from ${fileExtension} to ${this.CONVERSION_MAP[fileExtension]} for ${javaSound.path}`
      );
    }

    // Map sound categories if needed
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (metadata.category && this.CATEGORY_MAP[metadata.category]) {
      metadata.category = this.CATEGORY_MAP[metadata.category];
    }

    return {
      path: bedrockPath,
      data: soundData,
      metadata,
    };
  }

  /**
   * Maps a Java sound path to the corresponding Bedrock path
   *
   * @param javaPath - Original Java sound path
   * @returns Mapped Bedrock sound path
   */
  private mapSoundPath(javaPath: string): string {
    // Example mapping logic:
    // Java: assets/modid/sounds/block/example.ogg
    // Bedrock: sounds/block/example.ogg

    // Extract the relevant parts from the Java path
    const parts = javaPath.split('/');
    const modId = parts[1]; // Extract mod ID for potential namespacing

    // Find the sound category and file name
    let category = '';
    let fileName = '';

    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'sounds' && i + 1 < parts.length) {
        category = parts[i + 1];
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (i + 2 < parts.length) {
          fileName = parts.slice(i + 2).join('/');
        }
        break;
      }
    }

    // Construct the Bedrock path
    // In Bedrock, sounds are organized by category in the sounds directory
    return `sounds/${category}/${modId}_${fileName}`;
  }

  /**
   * Extracts sound event name from a sound file path
   *
   * @param soundPath - Path to the sound file
   * @returns Sound event name or undefined if not extractable
   */
  private extractSoundEvent(soundPath: string): string | undefined {
    // Example extraction logic:
    // From: assets/modid/sounds/block/example.ogg
    // Extract: modid:block.example

    const parts = soundPath.split('/');
    const modId = parts[1]; // Extract mod ID

    // Find the sound category and file name
    let category = '';
    let fileName = '';

    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'sounds' && i + 1 < parts.length) {
        category = parts[i + 1];
        /**
         * if method.
         *
         * TODO: Add detailed description of the method's purpose and behavior.
         *
         * @param param - TODO: Document parameters
         * @returns result - TODO: Document return value
         * @since 1.0.0
         */
        if (i + 2 < parts.length) {
          fileName = parts.slice(i + 2).join('/');
          // Remove file extension
          fileName = fileName.replace(/\.[^/.]+$/, '');
          break;
        }
      }
    }

    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (modId && category && fileName) {
      return `${modId}:${category}.${fileName.replace(/\//g, '.')}`;
    }

    return undefined;
  }

  /**
   * Adds a sound to the sound events collection
   *
   * @param soundEvent - Sound event name
   * @param sound - Bedrock sound file
   * @param soundEvents - Collection of sound events
   */
  private addSoundToEvents(
    soundEvent: string,
    sound: BedrockSoundFile,
    soundEvents: Record<string, any>
  ): void {
    // Extract the relative path without the 'sounds/' prefix
    const relativePath = sound.path.startsWith('sounds/') ? sound.path.substring(7) : sound.path;

    // Remove file extension for the sound name
    const soundName = relativePath.replace(/\.[^/.]+$/, '');

    // Initialize the sound event if it doesn't exist
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (!soundEvents[soundEvent]) {
      soundEvents[soundEvent] = {
        category: sound.metadata?.category || 'neutral',
        sounds: [],
      };

      // Add subtitle if available
      /**
       * if method.
       *
       * TODO: Add detailed description of the method's purpose and behavior.
       *
       * @param param - TODO: Document parameters
       * @returns result - TODO: Document return value
       * @since 1.0.0
       */
      if (sound.metadata?.subtitle) {
        soundEvents[soundEvent].subtitle = sound.metadata.subtitle;
      }
    }

    // Add the sound to the event
    const soundEntry: any = {
      name: soundName,
    };

    // Add optional properties if they exist
    if (sound.metadata?.volume !== undefined) {
      soundEntry.volume = sound.metadata.volume;
    }

    if (sound.metadata?.pitch !== undefined) {
      soundEntry.pitch = sound.metadata.pitch;
    }

    if (sound.metadata?.weight !== undefined) {
      soundEntry.weight = sound.metadata.weight;
    }

    if (sound.metadata?.stream !== undefined) {
      soundEntry.stream = sound.metadata.stream;
    }

    soundEvents[soundEvent].sounds.push(soundEntry);
  }

  /**
   * Generates the sounds.json structure for Bedrock
   *
   * @param soundEvents - Collection of sound events
   * @returns Structured sounds.json object
   */
  private generateSoundsJson(soundEvents: Record<string, any>): object {
    // In Bedrock, sounds.json has a different structure than Java
    // We need to transform our collected events to match Bedrock's format

    const bedrockSounds = {
      format_version: '1.14.0',
      sound_definitions: {} as Record<string, any>,
    };

    // Convert each Java sound event to Bedrock format
    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const [eventName, eventData] of Object.entries(soundEvents)) {
      // In Bedrock, we use the event name as the key
      bedrockSounds.sound_definitions[eventName] = {
        category: eventData.category,
        sounds: eventData.sounds.map((sound: any) => {
          const bedrockSound: any = {
            name: sound.name,
          };

          // Add optional properties if they exist
          if (sound.volume !== undefined) {
            bedrockSound.volume = sound.volume;
          }

          if (sound.pitch !== undefined) {
            bedrockSound.pitch = sound.pitch;
          }

          return bedrockSound;
        }),
      };
    }

    return bedrockSounds;
  }

  /**
   * Maps Java sound events to Bedrock sound events
   *
   * @param javaEvent - Java sound event name
   * @param mappings - Custom mappings to use
   * @returns Mapped Bedrock sound event name
   */
  public mapSoundEvent(javaEvent: string, mappings: SoundEventMapping[] = []): string {
    // First check custom mappings
    const customMapping = mappings.find((mapping) => mapping.javaEvent === javaEvent);
    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (customMapping) {
      return customMapping.bedrockEvent;
    }

    // For vanilla Minecraft events, we could have a predefined mapping
    // This would be a large dictionary of vanilla sound events
    const vanillaMappings: Record<string, string> = {
      'minecraft:block.stone.break': 'block.stone.break',
      'minecraft:block.wood.break': 'block.wood.break',
      'minecraft:entity.player.hurt': 'player.hurt',
      // Many more mappings would be defined here
    };

    /**
     * if method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    if (javaEvent.startsWith('minecraft:') && vanillaMappings[javaEvent]) {
      return vanillaMappings[javaEvent];
    }

    // For mod-specific events, we keep the same name but ensure it follows Bedrock conventions
    // Remove minecraft: prefix if present
    let bedrockEvent = javaEvent.replace(/^minecraft:/, '');

    // Ensure the event follows Bedrock naming conventions
    // In Bedrock, sound events typically use dot notation
    bedrockEvent = bedrockEvent.replace(/\//g, '.');

    return bedrockEvent;
  }

  /**
   * Organizes converted sounds according to Bedrock's resource pack structure
   *
   * @param convertedSounds - Array of converted Bedrock sounds
   * @param soundsJson - Generated sounds.json object
   * @param outputDir - Output directory for the organized sounds
   */
  public async organizeSounds(
    convertedSounds: BedrockSoundFile[],
    soundsJson: object,
    outputDir: string
  ): Promise<void> {
    logger.info(`Organizing ${convertedSounds.length} sounds in ${outputDir}`);

    // Write each sound file
    /**
     * for method.
     *
     * TODO: Add detailed description of the method's purpose and behavior.
     *
     * @param param - TODO: Document parameters
     * @returns result - TODO: Document return value
     * @since 1.0.0
     */
    for (const sound of convertedSounds) {
      const outputPath = path.join(outputDir, sound.path);
      const outputDirPath = path.dirname(outputPath);

      // Ensure the directory exists
      await fs.mkdir(outputDirPath, { recursive: true });

      // Write the sound file
      await fs.writeFile(outputPath, sound.data);
    }

    // Write the sounds.json file
    const soundsJsonPath = path.join(outputDir, 'sounds.json');
    await fs.writeFile(soundsJsonPath, JSON.stringify(soundsJson, null, 2));
  }
}
