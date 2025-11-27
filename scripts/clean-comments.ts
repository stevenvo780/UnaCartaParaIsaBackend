#!/usr/bin/env tsx

import { readFileSync, writeFileSync, copyFileSync, unlinkSync, existsSync } from 'fs';

/**
 * Script SIMPLE Y SEGURO para eliminar comentarios inline
 *
 * SOLO elimina comentarios // que NO estén en strings ni regex
 * NO toca JSDoc, NO toca directivas de sistema
 */

const PRESERVED_PATTERNS = [
  /^\s*\/\/\s*eslint-/,
  /^\s*\/\/\s*@ts-/,
  /^\s*\/\/\s*prettier-ignore/,
  /^\s*\/\/\s*Copyright/i,
  /^\s*\/\/\s*#region/,
  /^\s*\/\/\s*#endregion/,
];

function shouldPreserveLine(commentPart: string): boolean {
  return PRESERVED_PATTERNS.some(pattern => pattern.test(commentPart));
}

function isInStringOrRegex(beforeComment: string): boolean {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inRegex = false;
  let escaped = false;

  for (let i = 0; i < beforeComment.length; i++) {
    const char = beforeComment[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (inRegex) {
      if (char === '/') {
        inRegex = false;
      }
      continue;
    }

    if (inSingleQuote) {
      if (char === "'") inSingleQuote = false;
      continue;
    }

    if (inDoubleQuote) {
      if (char === '"') inDoubleQuote = false;
      continue;
    }

    if (inBacktick) {
      if (char === '`') inBacktick = false;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
    } else if (char === '"') {
      inDoubleQuote = true;
    } else if (char === '`') {
      inBacktick = true;
    } else if (char === '/' && i > 0) {
      const prevChar = beforeComment[i - 1];
      if (prevChar === '=' || prevChar === '(' || prevChar === ',' || prevChar === ' ' || prevChar === '\t') {
        inRegex = true;
      }
    }
  }

  return inSingleQuote || inDoubleQuote || inBacktick || inRegex;
}

function cleanFile(filePath: string): { modified: boolean; removed: number } {
  const originalCode = readFileSync(filePath, 'utf-8');
  const lines = originalCode.split('\n');
  let removed = 0;

  const cleanedLines = lines.map(line => {
    const commentIndex = line.indexOf('//');

    if (commentIndex === -1) {
      return line;
    }

    const beforeComment = line.substring(0, commentIndex);
    const commentPart = line.substring(commentIndex);

    if (shouldPreserveLine(commentPart)) {
      return line;
    }

    if (isInStringOrRegex(beforeComment)) {
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
      console.log(`✓ ${filePath}: ${removed} comentario(s) eliminado(s)`);

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

const filePath = process.argv[2];

if (!filePath) {
  console.error('❌ Uso: npm run clean:comments <archivo.ts>');
  process.exit(1);
}

if (!existsSync(filePath)) {
  console.error(`❌ El archivo ${filePath} no existe`);
  process.exit(1);
}

console.log(`🧹 Limpiando comentarios de: ${filePath}\n`);

const { modified, removed } = cleanFile(filePath);

if (modified) {
  console.log(`\n✅ Eliminados ${removed} comentarios`);
  console.log('💡 Revisa el archivo y si está bien, haz commit');
} else {
  console.log('\n📝 No se encontraron comentarios para eliminar');
}
