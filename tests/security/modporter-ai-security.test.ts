import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SecurityScanner } from '@modules/ingestion/SecurityScanner';
import { FileProcessor } from '@modules/ingestion/FileProcessor';
import * as fs from 'fs/promises';
import * as path from 'path';
import AdmZip from 'adm-zip';

describe('ModPorter-AI Security Tests', () => {
  let securityScanner: SecurityScanner;
  let fileProcessor: FileProcessor;
  let tempDir: string;

  beforeEach(async () => {
    securityScanner = new SecurityScanner();
    fileProcessor = new FileProcessor();
    tempDir = path.join(process.cwd(), 'temp', `security-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('ZIP Bomb Detection', () => {
    it('should detect ZIP bomb with high compression ratio', async () => {
      // Create a ZIP bomb - small file that expands to large size
      const zip = new AdmZip();
      const largeContent = 'A'.repeat(1024 * 1024); // 1MB of 'A's
      zip.addFile('bomb.txt', Buffer.from(largeContent));
      
      const zipBuffer = zip.toBuffer();
      const tempFile = path.join(tempDir, 'zipbomb.zip');
      await fs.writeFile(tempFile, zipBuffer);

      const result = await securityScanner.scanFile(tempFile);
      
      expect(result.threats).toContainEqual(
        expect.objectContaining({
          type: 'zip_bomb',
          severity: 'high'
        })
      );
      expect(result.isSafe).toBe(false);
    });

    it('should detect nested ZIP bomb', async () => {
      // Create nested ZIP structure
      const innerZip = new AdmZip();
      innerZip.addFile('inner.txt', Buffer.from('A'.repeat(1024 * 1024)));
      
      const outerZip = new AdmZip();
      outerZip.addFile('inner.zip', innerZip.toBuffer());
      
      const zipBuffer = outerZip.toBuffer();
      const tempFile = path.join(tempDir, 'nested-bomb.zip');
      await fs.writeFile(tempFile, zipBuffer);

      const result = await securityScanner.scanFile(tempFile);
      
      expect(result.threats.some(t => t.type === 'zip_bomb')).toBe(true);
      expect(result.isSafe).toBe(false);
    });

    it('should allow normal ZIP files', async () => {
      const zip = new AdmZip();
      zip.addFile('normal.txt', Buffer.from('Normal content'));
      zip.addFile('another.txt', Buffer.from('More normal content'));
      
      const zipBuffer = zip.toBuffer();
      const tempFile = path.join(tempDir, 'normal.zip');
      await fs.writeFile(tempFile, zipBuffer);

      const result = await securityScanner.scanFile(tempFile);
      
      expect(result.isSafe).toBe(true);
      expect(result.threats).toHaveLength(0);
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should detect path traversal attempts with ../', async () => {
      const zip = new AdmZip();
      zip.addFile('../../../etc/passwd', Buffer.from('malicious'));
      zip.addFile('../../windows/system32/config', Buffer.from('malicious'));
      
      const zipBuffer = zip.toBuffer();
      const tempFile = path.join(tempDir, 'traversal.zip');
      await fs.writeFile(tempFile, zipBuffer);

      const result = await securityScanner.scanFile(tempFile);
      
      expect(result.threats).toContainEqual(
        expect.objectContaining({
          type: 'path_traversal',
          severity: 'high'
        })
      );
      expect(result.isSafe).toBe(false);
    });

    it('should detect absolute path attempts', async () => {
      const zip = new AdmZip();
      zip.addFile('/etc/passwd', Buffer.from('malicious'));
      zip.addFile('C:\\Windows\\System32\\config', Buffer.from('malicious'));
      
      const zipBuffer = zip.toBuffer();
      const tempFile = path.join(tempDir, 'absolute-path.zip');
      await fs.writeFile(tempFile, zipBuffer);

      const result = await securityScanner.scanFile(tempFile);
      
      expect(result.threats.some(t => t.type === 'path_traversal')).toBe(true);
      expect(result.isSafe).toBe(false);
    });

    it('should allow normal relative paths', async () => {
      const zip = new AdmZip();
      zip.addFile('assets/textures/block.png', Buffer.from('texture'));
      zip.addFile('data/recipes/recipe.json', Buffer.from('recipe'));
      
      const zipBuffer = zip.toBuffer();
      const tempFile = path.join(tempDir, 'normal-paths.zip');
      await fs.writeFile(tempFile, zipBuffer);

      const result = await securityScanner.scanFile(tempFile);
      
      expect(result.isSafe).toBe(true);
      expect(result.threats.filter(t => t.type === 'path_traversal')).toHaveLength(0);
    });
  });

  describe('Malware Detection', () => {
    it('should detect suspicious Java code patterns', async () => {
      const suspiciousCode = `
        public class MaliciousClass {
          public void execute() {
            Runtime.getRuntime().exec("rm -rf /");
            ProcessBuilder pb = new ProcessBuilder("cmd", "/c", "del C:\\\\*");
            System.exit(0);
          }
        }
      `;
      
      const zip = new AdmZip();
      zip.addFile('MaliciousClass.java', Buffer.from(suspiciousCode));
      
      const zipBuffer = zip.toBuffer();
      const tempFile = path.join(tempDir, 'malicious.jar');
      await fs.writeFile(tempFile, zipBuffer);

      const result = await securityScanner.scanFile(tempFile);
      
      expect(result.threats).toContainEqual(
        expect.objectContaining({
          type: 'malicious_code',
          severity: expect.stringMatching(/medium|high/)
        })
      );
      expect(result.isSafe).toBe(false);
    });

    it('should detect file system manipulation attempts', async () => {
      const maliciousCode = `
        import java.io.File;
        import java.io.FileOutputStream;
        
        public class FileManipulator {
          public void deleteFiles() {
            File file = new File("/important/file");
            file.delete();
            
            FileOutputStream fos = new FileOutputStream("/etc/passwd");
          }
        }
      `;
      
      const zip = new AdmZip();
      zip.addFile('FileManipulator.java', Buffer.from(maliciousCode));
      
      const zipBuffer = zip.toBuffer();
      const tempFile = path.join(tempDir, 'file-manipulator.jar');
      await fs.writeFile(tempFile, zipBuffer);

      const result = await securityScanner.scanFile(tempFile);
      
      expect(result.threats.some(t => t.type === 'malicious_code')).toBe(true);
      expect(result.isSafe).toBe(false);
    });

    it('should allow normal Minecraft mod code', async () => {
      const normalCode = `
        @Mod("testmod")
        public class TestMod {
          public static final String MODID = "testmod";
          
          @SubscribeEvent
          public void onBlockPlace(BlockEvent.PlaceEvent event) {
            // Normal mod functionality
          }
        }
      `;
      
      const zip = new AdmZip();
      zip.addFile('TestMod.java', Buffer.from(normalCode));
      zip.addFile('mcmod.info', Buffer.from('{"modid":"testmod","name":"Test Mod"}'));
      
      const zipBuffer = zip.toBuffer();
      const tempFile = path.join(tempDir, 'normal-mod.jar');
      await fs.writeFile(tempFile, zipBuffer);

      const result = await securityScanner.scanFile(tempFile);
      
      expect(result.isSafe).toBe(true);
      expect(result.threats.filter(t => t.type === 'malicious_code')).toHaveLength(0);
    });
  });

  describe('File Validation', () => {
    it('should reject files exceeding size limit', async () => {
      const largeBuffer = Buffer.alloc(600 * 1024 * 1024); // 600MB
      
      const result = await fileProcessor.validateUpload(largeBuffer, 'large.jar');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: expect.stringContaining('SIZE'),
          severity: 'critical'
        })
      );
    });

    it('should reject invalid MIME types', async () => {
      const textBuffer = Buffer.from('This is not a JAR file');
      
      const result = await fileProcessor.validateUpload(textBuffer, 'fake.jar');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: expect.stringContaining('MIME'),
          severity: 'critical'
        })
      );
    });

    it('should validate ZIP magic numbers', async () => {
      const invalidZip = Buffer.from('INVALID ZIP CONTENT');
      
      const result = await fileProcessor.validateUpload(invalidZip, 'invalid.zip');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('magic number'))).toBe(true);
    });

    it('should accept valid JAR files', async () => {
      const zip = new AdmZip();
      zip.addFile('META-INF/MANIFEST.MF', Buffer.from('Manifest-Version: 1.0\n'));
      zip.addFile('TestClass.class', Buffer.from('fake class content'));
      
      const jarBuffer = zip.toBuffer();
      
      const result = await fileProcessor.validateUpload(jarBuffer, 'valid.jar');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Security Performance', () => {
    it('should complete security scan within reasonable time', async () => {
      const zip = new AdmZip();
      // Add multiple files to test performance
      for (let i = 0; i < 100; i++) {
        zip.addFile(`file${i}.txt`, Buffer.from(`Content ${i}`));
      }
      
      const zipBuffer = zip.toBuffer();
      const tempFile = path.join(tempDir, 'performance-test.zip');
      await fs.writeFile(tempFile, zipBuffer);

      const startTime = Date.now();
      const result = await securityScanner.scanFile(tempFile);
      const scanTime = Date.now() - startTime;
      
      expect(scanTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.scanTime).toBeLessThan(5000);
    });

    it('should handle concurrent security scans', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        const zip = new AdmZip();
        zip.addFile(`test${i}.txt`, Buffer.from(`Test content ${i}`));
        
        const zipBuffer = zip.toBuffer();
        const tempFile = path.join(tempDir, `concurrent-${i}.zip`);
        
        promises.push(
          fs.writeFile(tempFile, zipBuffer)
            .then(() => securityScanner.scanFile(tempFile))
        );
      }
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toHaveProperty('isSafe');
        expect(result).toHaveProperty('threats');
        expect(result).toHaveProperty('scanTime');
      });
    });
  });
});