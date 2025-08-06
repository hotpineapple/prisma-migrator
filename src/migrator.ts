import { exec } from 'child_process';
import { promisify } from 'util';
import { PrismaClient } from '@prisma/client';
import { MigrationResult, FailedMigration } from './types';
import { Logger, readFile, findMigrationsDir, executeSql, getRollbackFile } from './utils';

const execAsync = promisify(exec);

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
      
      this.logger.info('Starting migration with prisma migrate dev...');
      
      const migrateCommand = `npx prisma migrate deploy`;
      
      this.logger.debug(`Executing: ${migrateCommand}`);
      
      const { stdout, stderr } = await execAsync(migrateCommand);
      
      if (stderr && !stderr.includes('warnings') && !stderr.includes('Generated Prisma Client')) {
        throw new Error(`Migration failed: ${stderr}`);
      }
      
      this.logger.success('Prisma migrate dev completed');
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
      this.logger.error(`Migration process failed: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage
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

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
