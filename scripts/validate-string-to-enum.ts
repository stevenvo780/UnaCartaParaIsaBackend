#!/usr/bin/env node

/**
 * Script para validar que strings en el sistema no se hayan reemplazado por enums.
 * Ignora valores por defecto del sistema como "number", "string", etc.
 * Genera un reporte de qué strings faltan por convertir a enums.
 */

import * as fs from 'fs';
import * as path from 'path';

// Obtener __dirname - calcular desde process.cwd() ya que el script está en scripts/
// Si estamos en el directorio raíz del proyecto, scripts está en ./scripts
const projectRoot = process.cwd();
const __dirname = path.join(projectRoot, 'scripts');

// Directorios a analizar
const BACKEND_SRC = path.join(__dirname, '../src');
const FRONTEND_SRC = path.join(__dirname, '../../UnaCartaParaIsa/src');

// Patrones de archivos a excluir
const EXCLUDED_PATTERNS = [
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /node_modules/,
  /\.d\.ts$/,
  /dist\//,
  /coverage\//,
  /\.js$/,
];

// Valores por defecto del sistema a ignorar
const SYSTEM_DEFAULT_VALUES = new Set([
  // Tipos primitivos
  'number',
  'string',
  'boolean',
  'object',
  'undefined',
  'null',
  'function',
  'symbol',
  'bigint',
  // Valores comunes de JavaScript/TypeScript
  'true',
  'false',
  'void',
  'any',
  'unknown',
  'never',
  // Métodos comunes
  'toString',
  'valueOf',
  'hasOwnProperty',
  'constructor',
  'prototype',
  // HTTP y web
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'options',
  'head',
  'http',
  'https',
  'localhost',
  // Valores de configuración comunes
  'id',
  'name',
  'type',
  'value',
  'key',
  'data',
  'error',
  'success',
  'status',
  'message',
  'code',
  // Valores muy cortos o genéricos
  'x',
  'y',
  'z',
  'i',
  'j',
  'k',
  'a',
  'b',
  'c',
  'v',
  'w',
  'h',
  'r',
  'g',
  'b',
  'p',
  'q',
  't',
  'u',
  's',
  'n',
  'm',
  'l',
  'd',
  'e',
  'f',
  'o',
]);

// Patrones para encontrar strings literales que podrían ser enums
const STRING_LITERAL_PATTERNS = [
  // Comparaciones con === o !==
  {
    name: 'Comparaciones',
    regex: /(===|!==|==|!=)\s*["']([a-z_][a-z0-9_]*?)["']/gi,
    captureGroup: 2,
  },
  // Asignaciones con strings literales
  {
    name: 'Asignaciones',
    regex: /:\s*["']([a-z_][a-z0-9_]*?)["']\s*[,;\)\}]/g,
    captureGroup: 1,
  },
  // Case statements
  {
    name: 'Case statements',
    regex: /case\s+["']([a-z_][a-z0-9_]*?)["']\s*:/gi,
    captureGroup: 1,
  },
  // Includes/StartsWith/EndsWith
  {
    name: 'Métodos de string',
    regex: /\.(includes|startsWith|endsWith|indexOf|match|search)\(["']([a-z_][a-z0-9_]*?)["']/gi,
    captureGroup: 2,
  },
  // Return statements
  {
    name: 'Return statements',
    regex: /return\s+["']([a-z_][a-z0-9_]*?)["']/gi,
    captureGroup: 1,
  },
  // Object property access
  {
    name: 'Acceso a propiedades',
    regex: /\[["']([a-z_][a-z0-9_]*?)["']\]/g,
    captureGroup: 1,
  },
  // Set/Map operations
  {
    name: 'Operaciones Set/Map',
    regex: /\.(set|add|has|get|delete)\(["']([a-z_][a-z0-9_]*?)["']/gi,
    captureGroup: 2,
  },
  // Array methods
  {
    name: 'Métodos de array',
    regex: /\.(push|includes|indexOf|find|filter|some|every)\(["']([a-z_][a-z0-9_]*?)["']/gi,
    captureGroup: 2,
  },
  // Switch statements
  {
    name: 'Switch statements',
    regex: /switch\s*\([^)]+\)\s*\{[^}]*case\s+["']([a-z_][a-z0-9_]*?)["']/gi,
    captureGroup: 1,
  },
];

interface StringOccurrence {
  file: string;
  line: number;
  column: number;
  pattern: string;
  stringLiteral: string;
  lineContent: string;
  context: string;
}

interface EnumValues {
  enumName: string;
  values: Set<string>;
  file: string;
}

/**
 * Obtiene todos los archivos TypeScript recursivamente
 */
function getAllFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) {
    return fileList;
  }

  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (
      file.endsWith('.ts') &&
      !EXCLUDED_PATTERNS.some((pattern) => pattern.test(filePath))
    ) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Extrae todos los valores de los enums de un archivo
 */
function extractEnumValues(filePath: string): EnumValues[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const enums: EnumValues[] = [];

  // Buscar enums exportados
  const enumRegex =
    /export\s+enum\s+(\w+)\s*\{([^}]+)\}/gs;
  let match;

  while ((match = enumRegex.exec(content)) !== null) {
    const enumName = match[1];
    const enumBody = match[2];
    const values = new Set<string>();

    // Extraer valores del enum (formato: KEY = "value" o KEY = 'value')
    const valueRegex = /=\s*["']([^"']+)["']/g;
    let valueMatch;

    while ((valueMatch = valueRegex.exec(enumBody)) !== null) {
      const value = valueMatch[1];
      if (value && !SYSTEM_DEFAULT_VALUES.has(value)) {
        values.add(value);
      }
    }

    if (values.size > 0) {
      enums.push({
        enumName,
        values,
        file: filePath,
      });
    }
  }

  return enums;
}

/**
 * Encuentra todas las ocurrencias de strings literales en un archivo
 */
function findStringLiterals(
  filePath: string,
  content: string,
): StringOccurrence[] {
  const occurrences: StringOccurrence[] = [];
  const lines = content.split('\n');

  STRING_LITERAL_PATTERNS.forEach((pattern) => {
    let match;
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);

    while ((match = regex.exec(content)) !== null) {
      const stringLiteral = match[pattern.captureGroup];

      // Ignorar si es un valor por defecto del sistema
      if (
        !stringLiteral ||
        SYSTEM_DEFAULT_VALUES.has(stringLiteral) ||
        stringLiteral.length < 2
      ) {
        continue;
      }

      // Ignorar si parece ser un ID o hash (muy largo o con caracteres especiales)
      if (stringLiteral.length > 50 || /[^a-z0-9_]/.test(stringLiteral)) {
        continue;
      }

      const lineNumber =
        content.substring(0, match.index).split('\n').length;
      const line = lines[lineNumber - 1] || '';
      const column = match.index - content.lastIndexOf('\n', match.index) - 1;

      // Obtener contexto (líneas anteriores y posteriores)
      const contextStart = Math.max(0, lineNumber - 2);
      const contextEnd = Math.min(lines.length, lineNumber + 1);
      const context = lines
        .slice(contextStart, contextEnd)
        .map((l, i) => {
          const num = contextStart + i + 1;
          const marker = num === lineNumber ? '>>>' : '   ';
          return `${marker} ${num.toString().padStart(4, ' ')}: ${l}`;
        })
        .join('\n');

      occurrences.push({
        file: filePath,
        line: lineNumber,
        column,
        pattern: pattern.name,
        stringLiteral,
        lineContent: line.trim(),
        context,
      });
    }
  });

  return occurrences;
}

/**
 * Encuentra todos los enums en los directorios de constantes
 */
function findAllEnums(backendSrc: string, frontendSrc: string): Map<string, EnumValues> {
  const enumMap = new Map<string, EnumValues>();

  // Buscar enums en el backend
  const backendConstantsDir = path.join(backendSrc, 'shared/constants');
  if (fs.existsSync(backendConstantsDir)) {
    const enumFiles = getAllFiles(backendConstantsDir);
    enumFiles.forEach((file) => {
      const enums = extractEnumValues(file);
      enums.forEach((enumData) => {
        enumMap.set(enumData.enumName, enumData);
      });
    });
  }

  // Buscar enums en el frontend
  const frontendConstantsDir = path.join(frontendSrc, 'constants');
  if (fs.existsSync(frontendConstantsDir)) {
    const enumFiles = getAllFiles(frontendConstantsDir);
    enumFiles.forEach((file) => {
      const enums = extractEnumValues(file);
      enums.forEach((enumData) => {
        enumMap.set(enumData.enumName, enumData);
      });
    });
  }

  return enumMap;
}

/**
 * Verifica si un string literal está en algún enum
 */
function isStringInEnum(
  stringLiteral: string,
  enumMap: Map<string, EnumValues>,
): { found: boolean; enumName?: string; file?: string } {
  const entries = Array.from(enumMap.entries());
  for (const [enumName, enumData] of entries) {
    if (enumData.values.has(stringLiteral)) {
      return {
        found: true,
        enumName,
        file: enumData.file,
      };
    }
  }
  return { found: false };
}

/**
 * Función principal
 */
function main() {
  console.log('🔍 Validando strings que deberían ser enums...\n');

  // Encontrar todos los enums
  console.log('📚 Extrayendo enums existentes...');
  const enumMap = findAllEnums(BACKEND_SRC, FRONTEND_SRC);
  console.log(`   Encontrados ${enumMap.size} enums\n`);

  // Crear un mapa de todos los valores de enum para búsqueda rápida
  const allEnumValues = new Set<string>();
  enumMap.forEach((enumData) => {
    const values = Array.from(enumData.values);
    values.forEach((value) => allEnumValues.add(value));
  });

  console.log(`   Total de valores únicos en enums: ${allEnumValues.size}\n`);

  // Buscar strings literales en ambos proyectos
  console.log('🔎 Buscando strings literales...\n');

  const backendFiles = getAllFiles(BACKEND_SRC);
  const frontendFiles = getAllFiles(FRONTEND_SRC);
  const allFiles = [...backendFiles, ...frontendFiles];

  console.log(`   Analizando ${allFiles.length} archivos...\n`);

  const allOccurrences: StringOccurrence[] = [];
  const stringCounts = new Map<string, number>();

  allFiles.forEach((filePath) => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const occurrences = findStringLiterals(filePath, content);

      occurrences.forEach((occ) => {
        allOccurrences.push(occ);
        stringCounts.set(
          occ.stringLiteral,
          (stringCounts.get(occ.stringLiteral) || 0) + 1,
        );
      });
    } catch (error) {
      console.error(`   ⚠️  Error leyendo ${filePath}:`, error);
    }
  });

  console.log(`   Encontradas ${allOccurrences.length} ocurrencias de strings literales\n`);

  // Filtrar strings que NO están en ningún enum
  const missingEnums = new Map<string, StringOccurrence[]>();

  allOccurrences.forEach((occ) => {
    if (!allEnumValues.has(occ.stringLiteral)) {
      if (!missingEnums.has(occ.stringLiteral)) {
        missingEnums.set(occ.stringLiteral, []);
      }
      missingEnums.get(occ.stringLiteral)!.push(occ);
    }
  });

  // Agrupar por archivo
  const byFile = new Map<string, StringOccurrence[]>();
  missingEnums.forEach((occurrences) => {
    occurrences.forEach((occ) => {
      if (!byFile.has(occ.file)) {
        byFile.set(occ.file, []);
      }
      byFile.get(occ.file)!.push(occ);
    });
  });

  // Generar reporte
  console.log('📊 REPORTE DE STRINGS FALTANTES POR CONVERTIR A ENUMS\n');
  console.log('='.repeat(80));
  console.log(`Total de strings únicos sin enum: ${missingEnums.size}`);
  console.log(`Total de ocurrencias: ${Array.from(missingEnums.values()).reduce((sum, arr) => sum + arr.length, 0)}`);
  console.log(`Archivos afectados: ${byFile.size}`);
  console.log('='.repeat(80));
  console.log();

  // Ordenar por frecuencia de uso
  const sortedStrings = Array.from(missingEnums.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  );

  // Mostrar top 50 strings más usados
  const topStrings = sortedStrings.slice(0, 50);
  console.log('🔝 TOP 50 STRINGS MÁS USADOS SIN ENUM:\n');

  topStrings.forEach(([stringLiteral, occurrences], index) => {
    console.log(`${(index + 1).toString().padStart(3, ' ')}. "${stringLiteral}" (${occurrences.length} ocurrencias)`);
    
    // Mostrar algunos ejemplos
    const examples = occurrences.slice(0, 3);
    examples.forEach((occ) => {
      const relativePath = path.relative(
        path.join(__dirname, '..'),
        occ.file,
      );
      console.log(`      ${relativePath}:${occ.line} (${occ.pattern})`);
    });
    if (occurrences.length > 3) {
      console.log(`      ... y ${occurrences.length - 3} más`);
    }
    console.log();
  });

  // Guardar reporte completo en JSON
  const reportPath = path.join(__dirname, '../string-to-enum-validation-report.json');
  const report = {
    summary: {
      totalEnums: enumMap.size,
      totalEnumValues: allEnumValues.size,
      totalStringOccurrences: allOccurrences.length,
      missingEnumStrings: missingEnums.size,
      missingEnumOccurrences: Array.from(missingEnums.values()).reduce(
        (sum, arr) => sum + arr.length,
        0,
      ),
      filesAffected: byFile.size,
    },
    enums: Array.from(enumMap.entries()).map(([name, data]) => ({
      name,
      values: Array.from(data.values),
      file: path.relative(path.join(__dirname, '..'), data.file),
    })),
    missingStrings: sortedStrings.map(([stringLiteral, occurrences]) => ({
      stringLiteral,
      count: occurrences.length,
      occurrences: occurrences.map((occ) => ({
        file: path.relative(path.join(__dirname, '..'), occ.file),
        line: occ.line,
        column: occ.column,
        pattern: occ.pattern,
        lineContent: occ.lineContent,
      })),
    })),
    byFile: Array.from(byFile.entries()).map(([file, occurrences]) => ({
      file: path.relative(path.join(__dirname, '..'), file),
      count: occurrences.length,
      uniqueStrings: Array.from(
        new Set(occurrences.map((occ) => occ.stringLiteral)),
      ),
    })),
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ Reporte completo guardado en: ${reportPath}`);
  console.log(`\n💡 Revisa el reporte JSON para ver todos los detalles.`);
}

main();

