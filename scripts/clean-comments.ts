#!/usr/bin/env tsx

import { readFileSync, writeFileSync, readdirSync, statSync, copyFileSync, unlinkSync, existsSync } from 'fs';
import { join, relative, extname } from 'path';

/**
 * Script SIMPLE Y SEGURO para eliminar comentarios inline
 *
 * SOLO elimina comentarios // que NO estén en strings ni regex
 * NO toca JSDoc, NO toca directivas de sistema
 */

const PRESERVED_PATTERNS = [
  /eslint-/,
  /@ts-/,
  /prettier-ignore/,
  /Copyright/i,
  /#region/,
  /#endregion/,
];

function shouldPreserveLine(commentPart: string): boolean {
  return PRESERVED_PATTERNS.some(pattern => pattern.test(commentPart));
}

function findCommentStart(line: string): number {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;

  for (let i = 0; i < line.length - 1; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '\\' && (nextChar === '"' || nextChar === "'" || nextChar === '`' || nextChar === '\\')) {
      i++;
      continue;
    }

    if (inSingleQuote) {
      if (char === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      if (char === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (inBacktick) {
      if (char === '`') {
        inBacktick = false;
      }
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      continue;
    }

    if (char === '`') {
      inBacktick = true;
      continue;
    }

    if (char === '/' && nextChar === '/') {
      const before = line.substring(0, i);
      if (before.includes('/') && !before.includes('"') && !before.includes("'") && !before.includes('`')) {
        return -1;
      }
      return i;
    }
  }

  return -1;
}

function cleanFile(filePath: string): { modified: boolean; removed: number } {
  const originalCode = readFileSync(filePath, 'utf-8');
  const lines = originalCode.split('\n');
  let removed = 0;

  const cleanedLines = lines.map(line => {
    const commentIndex = findCommentStart(line);

    if (commentIndex === -1) {
      return line;
    }

    const beforeComment = line.substring(0, commentIndex);
    const commentPart = line.substring(commentIndex);

    if (shouldPreserveLine(commentPart)) {
      return line;
    }

    removed++;
    return beforeComment.trimEnd();
  });

  const finalCode = cleanedLines.join('\n');
  const modified = finalCode !== originalCode;

  if (modified) {
    const backupPath = `${filePath}.backup`;
    copyFileSync(filePath, backupPath);

    try {
      writeFileSync(filePath, finalCode, 'utf-8');

      if (existsSync(backupPath)) {
        unlinkSync(backupPath);
      }
    } catch (error) {
      console.error(`❌ Error: ${(error as Error).message}`);
      if (existsSync(backupPath)) {
        copyFileSync(backupPath, filePath);
        unlinkSync(backupPath);
      }
      throw error;
    }
  }

  return { modified, removed };
}

function processFile(filePath: string, stats: { processed: number; modified: number; removed: number }): void {
  try {
    stats.processed++;
    const { modified, removed } = cleanFile(filePath);

    if (modified) {
      stats.modified++;
      stats.removed += removed;
      const relativePath = relative(process.cwd(), filePath);
      console.log(`✓ ${relativePath}: ${removed} comentario(s)`);
    }
  } catch (error) {
    console.error(`❌ Error en ${filePath}: ${(error as Error).message}`);
  }
}

function processDirectory(dir: string, stats: { processed: number; modified: number; removed: number }): void {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (['node_modules', 'dist', '.git', 'coverage', '.claude', 'scripts'].includes(entry)) {
        continue;
      }
      processDirectory(fullPath, stats);
    } else if (stat.isFile() && extname(fullPath) === '.ts') {
      processFile(fullPath, stats);
    }
  }
}

const args = process.argv.slice(2);
const targetPath = args[0] || './src';

if (!existsSync(targetPath)) {
  console.error(`❌ La ruta "${targetPath}" no existe`);
  process.exit(1);
}

console.log('🧹 Limpiador de Comentarios TypeScript\n');

const stats = { processed: 0, modified: 0, removed: 0 };
const stat = statSync(targetPath);

if (stat.isFile()) {
  if (extname(targetPath) === '.ts') {
    processFile(targetPath, stats);
  } else {
    console.error(`❌ "${targetPath}" no es un archivo .ts`);
    process.exit(1);
  }
} else if (stat.isDirectory()) {
  processDirectory(targetPath, stats);
}

console.log('\n' + '='.repeat(60));
console.log('📊 Resumen:');
console.log('='.repeat(60));
console.log(`Archivos procesados:  ${stats.processed}`);
console.log(`Archivos modificados: ${stats.modified}`);
console.log(`Comentarios eliminados: ${stats.removed}`);

if (stats.removed > 0) {
  console.log('\n✅ Cambios aplicados');
  console.log('💡 Revisa con "git diff" y luego ejecuta "npm run lint"');
}
