# Prisma Migrator

A Node.js library that extends Prisma ORM's migration functionality with automatic rollback capabilities when migrations fail.

## Features

- 🚀 Runs `prisma migrate dev` automatically  
- 🔍 Detects failed migrations by checking `_prisma_migrations` table
- 🔄 Automatically executes rollback when migration fails
- 🔒 Safety confirmation prompt before running
- 📝 Supports any `*.rollback.sql` file in migration directories
- 🎯 Simple CLI tool with no configuration needed

## Installation

```bash
npm install prisma-migrator
```

## Usage

### CLI Usage

```bash
npx prisma-migrator
```

The tool will:
1. Show a confirmation prompt with a random string
2. Run `prisma migrate dev`
3. Check for failed migrations
4. Execute rollback if a migration failed and `*.rollback.sql` exists

### Programmatic Usage

```typescript
import { PrismaMigrator } from 'prisma-migrator';

const migrator = new PrismaMigrator();
const result = await migrator.migrate();

if (result.success) {
  console.log('Migration successful');
} else {
  console.log('Migration failed:', result.error);
  if (result.rolledBack) {
    console.log('Rollback was executed');
  }
}

await migrator.disconnect();
```

## How It Works

1. **Safety Check**: Prompts user to enter a random confirmation string
2. **Migration**: Executes `npx prisma migrate dev`
3. **Failure Detection**: Queries `_prisma_migrations` table for entries where `finished_at IS NULL`
4. **Rollback**: If failure detected, looks for any `*.rollback.sql` file in the failed migration directory
5. **Execution**: Runs the rollback SQL using Prisma's raw query execution

## Rollback File Structure

Place your rollback files in the migration directory:

```
prisma/migrations/
├── 20250806120000_add_users_table/
│   ├── migration.sql
│   └── rollback.sql          # ← This will be executed on failure
├── 20250806130000_add_posts_table/
│   ├── migration.sql
│   └── 001.rollback.sql      # ← Any *.rollback.sql works
```

## Example Rollback File

```sql
-- rollback.sql
DROP TABLE IF EXISTS users;
DROP INDEX IF EXISTS users_email_unique;
```

## Requirements

- Node.js ≥ 16
- Prisma ≥ 5.0.0
- @prisma/client ≥ 5.0.0

## TypeScript Support

Full TypeScript support with type definitions included.

```typescript
interface MigrationResult {
  success: boolean;
  error?: string;
  rolledBack?: boolean;
  rollbackError?: string;
}
```

## Safety Features

- **Confirmation prompt**: Prevents accidental execution
- **Random string verification**: User must type exact string to proceed
- **Error handling**: Graceful handling of rollback failures
- **Database safety**: Uses Prisma's built-in SQL execution

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

If you encounter any issues, please file them on the [GitHub issues page](https://github.com/hotpineapple/prisma-migrator/issues).
