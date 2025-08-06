import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { createInterface } from 'readline';
import { PrismaClient } from '@prisma/client';

export class Logger {
  info(message: string): void {
    console.log(`ℹ️  ${message}`);
  }

  success(message: string): void {
    console.log(`✅ ${message}`);
  }

  error(message: string): void {
    console.error(`❌ ${message}`);
  }

  warn(message: string): void {
    console.warn(`⚠️  ${message}`);
  }

  debug(message: string): void {
    console.log(`🔍 ${message}`);
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf-8');
}

export async function findProjectRoot(): Promise<string> {
  let currentDir = process.cwd();
  
  while (currentDir !== '/') {
    const packageJsonPath = join(currentDir, 'package.json');
    const prismaSchemaPath = join(currentDir, 'prisma', 'schema.prisma');
    
    if (await fileExists(packageJsonPath) || await fileExists(prismaSchemaPath)) {
      return currentDir;
    }
    
    const parentDir = resolve(currentDir, '..');
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }
  
  return process.cwd();
}

export async function findMigrationsDir(customDir?: string): Promise<string> {
  if (customDir) {
    const absolutePath = resolve(customDir);
    if (await fileExists(absolutePath)) {
      return absolutePath;
    }
    throw new Error(`Custom migrations directory not found: ${customDir}`);
  }

  const projectRoot = await findProjectRoot();
  
  const possibleLocations = [
    join(projectRoot, 'prisma', 'migrations'),
    join(projectRoot, 'migrations'),
    join(process.cwd(), 'prisma', 'migrations'),
    join(process.cwd(), 'migrations'),
    './prisma/migrations',
    './migrations'
  ];

  for (const location of possibleLocations) {
    if (await fileExists(location)) {
      return resolve(location);
    }
  }

  throw new Error(`Could not find Prisma migrations directory. Searched: ${possibleLocations.join(', ')}`);
}

export async function executeSql(sql: string, prisma: PrismaClient, logger: Logger): Promise<void> {
  logger.debug(`Executing SQL: ${sql.substring(0, 100)}...`);
  
  const statements = sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
  
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
  
  logger.debug('SQL executed successfully');
}

export async function getRollbackFile(migrationName: string, migrationsDir: string): Promise<string | null> {
  const migrationDir = join(migrationsDir, migrationName);
  
  try {
    const files = await fs.readdir(migrationDir);
    const rollbackFile = files.find(file => file.endsWith('rollback.sql'));
    
    if (rollbackFile) {
      return join(migrationDir, rollbackFile);
    }
  } catch (error) {
    return null;
  }
  
  return null;
}

export function generateRandomString(length: number = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function promptConfirmation(message: string): Promise<boolean> {
  const randomString = generateRandomString();
  
  console.log(`\n⚠️  ${message}`);
  console.log(`🔒 To proceed, please type: ${randomString}`);
  
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('Enter confirmation: ', (answer) => {
      rl.close();
      resolve(answer.trim() === randomString);
    });
  });
}
