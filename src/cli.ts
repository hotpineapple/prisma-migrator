#!/usr/bin/env node

import { PrismaMigrator } from './migrator';
import { promptConfirmation } from './utils';

function parseArgs(): { migrationsDir?: string } {
  const args = process.argv.slice(2);
  const options: { migrationsDir?: string } = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--migrations-dir' && args[i + 1]) {
      options.migrationsDir = args[i + 1];
      i++; // Skip the next argument as it's the value
    }
  }
  
  return options;
}

async function main() {
  const options = parseArgs();
  
  const confirmed = await promptConfirmation('This will run database migrations with automatic rollback on failure.');
  
  if (!confirmed) {
    console.log('❌ Operation cancelled - confirmation string did not match');
    process.exit(1);
  }

  const migrator = new PrismaMigrator(options);
  
  try {
    const result = await migrator.migrate();
    
    if (result.success) {
      console.log('✅ Migration completed successfully');
      await migrator.disconnect();
      process.exit(0);
    } else {
      console.error(`❌ Migration failed: ${result.error}`);
      
      if (result.rolledBack) {
        console.log('✅ Rollback was executed successfully');
      } else if (result.rollbackError) {
        console.error(`❌ Rollback also failed: ${result.rollbackError}`);
      } else {
        console.warn('⚠️  No rollback.sql file found for failed migration');
      }
      
      await migrator.disconnect();
      process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Unexpected error: ${errorMessage}`);
    await migrator.disconnect();
    process.exit(1);
  }
}

main();
