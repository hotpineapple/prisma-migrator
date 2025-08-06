import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { MigrationResult, FailedMigration } from './types';
import { Logger, readFile, findMigrationsDir, executeSql, getRollbackFile } from './utils';

export class PrismaMigrator {
  private logger: Logger;
  private migrationsDir!: string;
  private prisma: PrismaClient;

  constructor() {
    this.logger = new Logger();
    this.prisma = new PrismaClient();
  }

  async initialize(): Promise<void> {
    this.migrationsDir = await findMigrationsDir();
    this.logger.debug(`Using migrations directory: ${this.migrationsDir}`);
  }

  async migrate(): Promise<MigrationResult> {
    try {
      await this.initialize();
      
      this.logger.info('Starting migration with prisma migrate deploy...');
      
      const migrateCommand = `npx prisma migrate deploy`;
      
      this.logger.debug(`Executing: ${migrateCommand}`);
      
      let stdout: string;
      try {
        stdout = execSync(migrateCommand, { 
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
      } catch (execError: any) {
        this.logger.error('Migration command failed');
        
        const errorOutput = execError.stderr ? execError.stderr.toString() : execError.message;
        
        const rollbackResult = await this.attemptRollbackFromError(errorOutput);
        
        return {
          success: false,
          error: errorOutput,
          rolledBack: rollbackResult.success,
          rollbackError: rollbackResult.error
        };
      }
      
      this.logger.success('Prisma migrate deploy completed');
      this.logger.debug(`Migration output: ${stdout}`);
      
      const failedMigration = await this.checkForFailedMigrations();
      
      if (failedMigration) {
        this.logger.warn(`Failed migration detected: ${failedMigration.migration_name}`);
        
        const rollbackResult = await this.attemptRollback(failedMigration.migration_name);
        
        return {
          success: false,
          error: failedMigration.logs || 'Migration failed',
          rolledBack: rollbackResult.success,
          rollbackError: rollbackResult.error
        };
      }
      
      return {
        success: true
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Migration - rollback process failed`);
      
      const rollbackResult = await this.attemptRollbackFromError(errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        rolledBack: rollbackResult.success,
        rollbackError: rollbackResult.error
      };
    }
  }

  private async checkForFailedMigrations(): Promise<FailedMigration | null> {
    try {
      this.logger.debug('Checking _prisma_migrations table for failures...');
      
      const failedMigrations = await this.prisma.$queryRaw<FailedMigration[]>`
        SELECT * FROM "_prisma_migrations" 
        WHERE "finished_at" IS NULL 
        ORDER BY "started_at" DESC 
        LIMIT 1
      `;
      
      if (failedMigrations.length > 0) {
        this.logger.debug(`Found failed migration: ${failedMigrations[0].migration_name}`);
        return failedMigrations[0];
      }
      
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.debug(`Error checking for failed migrations: ${errorMessage}`);
      return null;
    }
  }

  private async attemptRollback(migrationName: string): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.warn('Attempting rollback...');
      
      const rollbackFile = await getRollbackFile(migrationName, this.migrationsDir);
      
      if (!rollbackFile) {
        this.logger.warn(`No rollback.sql file found for migration: ${migrationName}`);
        return { success: false, error: 'No rollback.sql file found' };
      }
      
      this.logger.info(`Found rollback file: ${rollbackFile}`);
      
      const rollbackSql = await readFile(rollbackFile);
      await executeSql(rollbackSql, this.prisma, this.logger);
      
      this.logger.success('Rollback executed successfully');
      
      return { success: true };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Rollback failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  private async attemptRollbackFromError(errorOutput: string): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.warn('Attempting rollback from error output...');
      
      const migrationDirs = await this.findRecentMigrationDirs();
      
      for (const migrationName of migrationDirs) {
        const rollbackFile = await getRollbackFile(migrationName, this.migrationsDir);
        if (rollbackFile) {
          this.logger.info(`Found rollback file for migration: ${migrationName}`);
          
          const rollbackSql = await readFile(rollbackFile);
          await executeSql(rollbackSql, this.prisma, this.logger);
          
          this.logger.success('Rollback executed successfully');
          return { success: true };
        }
      }
      
      this.logger.warn('No rollback files found for recent migrations');
      return { success: false, error: 'No rollback files found' };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Rollback failed: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  private async findRecentMigrationDirs(): Promise<string[]> {
    try {
      const fs = await import('fs/promises');
      const migrations = await fs.readdir(this.migrationsDir);
      
      return migrations
        .filter(name => name.match(/^\d{14}_/))
        .sort()
        .reverse()
        .slice(0, 3);
    } catch {
      return [];
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
