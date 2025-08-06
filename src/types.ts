export interface MigrationResult {
  success: boolean;
  error?: string;
  rolledBack?: boolean;
  rollbackError?: string;
}

export interface FailedMigration {
  id: string;
  checksum: string;
  finished_at: Date | null;
  migration_name: string;
  logs: string | null;
  rolled_back_at: Date | null;
  started_at: Date;
  applied_steps_count: number;
}
