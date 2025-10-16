#!/usr/bin/env node

/**
 * Database Migration Runner for ModPorter-AI Integration
 * Handles running and rolling back database migrations
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

class MigrationRunner {
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'mineport',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    });

    this.migrationsDir = path.join(__dirname, '..', 'src', 'database', 'migrations');
  }

  async ensureMigrationsTable() {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          filename VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP DEFAULT NOW(),
          checksum VARCHAR(64) NOT NULL
        )
      `);
      console.log('✓ Migrations table ensured');
    } finally {
      client.release();
    }
  }

  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsDir);
      return files.filter((file) => file.endsWith('.sql')).sort();
    } catch (error) {
      console.error('Error reading migrations directory:', error.message);
      return [];
    }
  }

  async getExecutedMigrations() {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT filename FROM migrations ORDER BY id');
      return result.rows.map((row) => row.filename);
    } finally {
      client.release();
    }
  }

  async calculateChecksum(content) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  async executeMigration(filename) {
    const filePath = path.join(this.migrationsDir, filename);
    const content = await fs.readFile(filePath, 'utf8');
    const checksum = await this.calculateChecksum(content);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Execute the migration
      await client.query(content);

      // Record the migration
      await client.query('INSERT INTO migrations (filename, checksum) VALUES ($1, $2)', [
        filename,
        checksum,
      ]);

      await client.query('COMMIT');
      console.log(`✓ Executed migration: ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to execute migration ${filename}: ${error.message}`);
    } finally {
      client.release();
    }
  }

  async rollbackMigration(filename) {
    const rollbackFile = filename.replace('.sql', '.rollback.sql');
    const rollbackPath = path.join(this.migrationsDir, rollbackFile);

    try {
      const content = await fs.readFile(rollbackPath, 'utf8');

      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        // Execute the rollback
        await client.query(content);

        // Remove the migration record
        await client.query('DELETE FROM migrations WHERE filename = $1', [filename]);

        await client.query('COMMIT');
        console.log(`✓ Rolled back migration: ${filename}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.warn(`⚠ No rollback file found for ${filename}`);
      } else {
        throw new Error(`Failed to rollback migration ${filename}: ${error.message}`);
      }
    }
  }

  async runMigrations() {
    console.log('🚀 Starting database migrations...');

    await this.ensureMigrationsTable();

    const migrationFiles = await this.getMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();

    const pendingMigrations = migrationFiles.filter((file) => !executedMigrations.includes(file));

    if (pendingMigrations.length === 0) {
      console.log('✓ No pending migrations');
      return;
    }

    console.log(`📋 Found ${pendingMigrations.length} pending migrations`);

    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
    }

    console.log('✅ All migrations completed successfully');
  }

  async rollbackLastMigration() {
    console.log('🔄 Rolling back last migration...');

    const executedMigrations = await this.getExecutedMigrations();

    if (executedMigrations.length === 0) {
      console.log('ℹ No migrations to rollback');
      return;
    }

    const lastMigration = executedMigrations[executedMigrations.length - 1];
    await this.rollbackMigration(lastMigration);

    console.log('✅ Rollback completed successfully');
  }

  async validateMigrations() {
    console.log('🔍 Validating migrations...');

    const migrationFiles = await this.getMigrationFiles();
    const client = await this.pool.connect();

    try {
      for (const filename of migrationFiles) {
        const filePath = path.join(this.migrationsDir, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const currentChecksum = await this.calculateChecksum(content);

        const result = await client.query('SELECT checksum FROM migrations WHERE filename = $1', [
          filename,
        ]);

        if (result.rows.length > 0) {
          const storedChecksum = result.rows[0].checksum;
          if (currentChecksum !== storedChecksum) {
            throw new Error(`Migration ${filename} has been modified after execution`);
          }
        }
      }

      console.log('✅ All migrations validated successfully');
    } finally {
      client.release();
    }
  }

  async dryRunMigrations() {
    console.log('🧪 Running migration dry-run...');

    await this.ensureMigrationsTable();

    const migrationFiles = await this.getMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();

    const pendingMigrations = migrationFiles.filter((file) => !executedMigrations.includes(file));

    if (pendingMigrations.length === 0) {
      console.log('✓ No pending migrations to test');
      return;
    }

    console.log(`📋 Testing ${pendingMigrations.length} pending migrations`);

    const client = await this.pool.connect();

    try {
      for (const migration of pendingMigrations) {
        console.log(`🧪 Testing migration: ${migration}`);

        const filePath = path.join(this.migrationsDir, migration);
        const content = await fs.readFile(filePath, 'utf8');

        // Start a transaction for dry-run
        await client.query('BEGIN');
        try {
          // Execute the migration in the transaction
          await client.query(content);
          console.log(`✓ Migration ${migration} syntax is valid`);

          // Rollback the transaction (dry-run)
          await client.query('ROLLBACK');
        } catch (error) {
          await client.query('ROLLBACK');
          throw new Error(`Migration ${migration} failed dry-run: ${error.message}`);
        }
      }

      console.log('✅ All migrations passed dry-run validation');
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];
  const runner = new MigrationRunner();

  try {
    switch (command) {
      case 'up':
        await runner.runMigrations();
        break;
      case 'down':
        await runner.rollbackLastMigration();
        break;
      case 'validate':
        await runner.validateMigrations();
        break;
      case 'dry-run':
        await runner.dryRunMigrations();
        break;
      case 'status':
        await runner.ensureMigrationsTable();
        const files = await runner.getMigrationFiles();
        const executed = await runner.getExecutedMigrations();
        console.log(`📊 Migration Status:`);
        console.log(`   Total migrations: ${files.length}`);
        console.log(`   Executed: ${executed.length}`);
        console.log(`   Pending: ${files.length - executed.length}`);
        break;
      default:
        console.log(`
Usage: node run-migrations.js <command>

Commands:
  up        Run all pending migrations
  down      Rollback the last migration
  dry-run   Test migrations without executing them
  validate  Validate migration checksums
  status    Show migration status
        `);
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await runner.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = MigrationRunner;
