#!/usr/bin/env node

/**
 * Script para validar que strings en el sistema no se hayan reemplazado por enums.
 * También detecta enums y miembros de enums que no se están utilizando.
 * Ignora valores por defecto del sistema como "number", "string", etc.
 * Genera un reporte detallado.
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
  values: Set<string>; // Valores del enum (e.g. "active", "pending")
  members: Map<string, string>; // NombreMiembro -> Valor (e.g. "ACTIVE" -> "active")
  file: string;
  usageCount: number; // Uso del Enum como tipo o valor
  memberUsageCounts: Map<string, number>; // Uso de cada miembro específico
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
 * Extrae todos los valores y miembros de los enums de un archivo
 */
function extractEnumValues(filePath: string): EnumValues[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const enums: EnumValues[] = [];

  // Buscar enums exportados
  const enumRegex = /export\s+enum\s+(\w+)\s*\{([^}]+)\}/gs;
  let match;

  while ((match = enumRegex.exec(content)) !== null) {
    const enumName = match[1];
    const enumBody = match[2];
    const values = new Set<string>();
    const members = new Map<string, string>();
    const memberUsageCounts = new Map<string, number>();

    // Extraer miembros y valores del enum (formato: KEY = "value" o KEY = 'value')
    // También soporta KEY = "value", (con coma)
    const memberRegex = /([a-zA-Z0-9_]+)\s*=\s*["']([^"']+)["']/g;
    let memberMatch;

    while ((memberMatch = memberRegex.exec(enumBody)) !== null) {
      const memberName = memberMatch[1];
      const value = memberMatch[2];

      if (value && !SYSTEM_DEFAULT_VALUES.has(value)) {
        values.add(value);
        members.set(memberName, value);
        memberUsageCounts.set(memberName, 0);
      }
    }

    if (values.size > 0) {
      enums.push({
        enumName,
        values,
        members,
        file: filePath,
        usageCount: 0,
        memberUsageCounts,
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
        // Si ya existe (e.g. compartido), no lo sobrescribimos para mantener el del backend como fuente
        if (!enumMap.has(enumData.enumName)) {
          enumMap.set(enumData.enumName, enumData);
        }
      });
    });
  }

  return enumMap;
}

/**
 * Cuenta los usos de Enums y sus miembros en el código
 */
function countEnumUsages(
  filePath: string,
  content: string,
  enumMap: Map<string, EnumValues>
) {
  // Ignorar el archivo donde se define el enum para no contar la definición como uso
  // Aunque idealmente deberíamos ignorar solo la definición específica.
  // Por simplicidad, asumimos que si el archivo contiene "export enum X", esos usos no cuentan.

  enumMap.forEach((enumData, enumName) => {
    if (filePath === enumData.file) return;

    // 1. Buscar uso del Enum como tipo o valor (e.g. "let x: EnumName" o "EnumName.Member")
    // Usamos \b para asegurar palabra completa
    const enumUsageRegex = new RegExp(`\\b${enumName}\\b`, 'g');
    const matches = content.match(enumUsageRegex);
    if (matches) {
      enumData.usageCount += matches.length;
    }

    // 2. Buscar uso de miembros específicos (e.g. "EnumName.Member")
    enumData.members.forEach((_, memberName) => {
      const memberUsageRegex = new RegExp(`\\b${enumName}\\.${memberName}\\b`, 'g');
      const memberMatches = content.match(memberUsageRegex);
      if (memberMatches) {
        const count = memberMatches.length;
        enumData.memberUsageCounts.set(
          memberName,
          (enumData.memberUsageCounts.get(memberName) || 0) + count
        );
      }
    });
  });
}

/**
 * Función principal
 */
function main() {
  console.log('🔍 Validando strings y uso de Enums...\n');

  // Encontrar todos los enums
  console.log('📚 Extrayendo enums existentes...');
  const enumMap = findAllEnums(BACKEND_SRC, FRONTEND_SRC);
  console.log(`   Encontrados ${enumMap.size} enums\n`);

  // Crear un mapa de todos los valores de enum para búsqueda rápida
  // Value -> List of Enums containing this value
  const valueToEnums = new Map<string, string[]>();

  enumMap.forEach((enumData, enumName) => {
    enumData.values.forEach((value) => {
      if (!valueToEnums.has(value)) {
        valueToEnums.set(value, []);
      }
      valueToEnums.get(value)!.push(enumName);
    });
  });

  console.log(`   Total de valores únicos en enums: ${valueToEnums.size}\n`);

  // Analizar archivos
  console.log('🔎 Analizando código fuente...\n');

  const backendFiles = getAllFiles(BACKEND_SRC);
  const frontendFiles = getAllFiles(FRONTEND_SRC);
  const allFiles = [...backendFiles, ...frontendFiles];

  console.log(`   Analizando ${allFiles.length} archivos...\n`);

  const missingEnumOccurrences: StringOccurrence[] = [];

  allFiles.forEach((filePath) => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');

      // 1. Buscar strings literales que deberían ser enums
      const occurrences = findStringLiterals(filePath, content);

      occurrences.forEach((occ) => {
        // Solo nos importa si el string coincide EXACTAMENTE con un valor de algún Enum
        if (valueToEnums.has(occ.stringLiteral)) {
          missingEnumOccurrences.push(occ);
        }
      });

      // 2. Contar usos de Enums
      countEnumUsages(filePath, content, enumMap);

    } catch (error) {
      console.error(`   ⚠️  Error leyendo ${filePath}:`, error);
    }
  });

  // --- REPORTE 1: Strings que deberían ser Enums ---

  // Agrupar por string literal
  const missingByString = new Map<string, StringOccurrence[]>();
  missingEnumOccurrences.forEach((occ) => {
    if (!missingByString.has(occ.stringLiteral)) {
      missingByString.set(occ.stringLiteral, []);
    }
    missingByString.get(occ.stringLiteral)!.push(occ);
  });

  // Ordenar por frecuencia
  const sortedMissing = Array.from(missingByString.entries()).sort(
    (a, b) => b[1].length - a[1].length
  );

  console.log('📊 REPORTE DE USO DE STRINGS LITERALES (POSIBLES ENUMS)\n');
  console.log('='.repeat(80));
  console.log(`Total de ocurrencias detectadas: ${missingEnumOccurrences.length}`);
  console.log('='.repeat(80));
  console.log();

  if (sortedMissing.length === 0) {
    console.log('✅ ¡Excelente! No se detectaron strings literales que deban ser enums.\n');
  } else {
    sortedMissing.slice(0, 50).forEach(([stringLiteral, occurrences], index) => {
      const possibleEnums = valueToEnums.get(stringLiteral) || [];
      console.log(`${(index + 1).toString().padStart(3, ' ')}. "${stringLiteral}" (${occurrences.length} ocurrencias)`);
      console.log(`      Posibles Enums: ${possibleEnums.join(', ')}`);

      const examples = occurrences.slice(0, 3);
      examples.forEach((occ) => {
        const relativePath = path.relative(path.join(__dirname, '..'), occ.file);
        console.log(`      ${relativePath}:${occ.line} (${occ.pattern})`);
      });
      if (occurrences.length > 3) {
        console.log(`      ... y ${occurrences.length - 3} más`);
      }
      console.log();
    });
  }

  // --- REPORTE 2: Enums sin uso ---

  console.log('📉 REPORTE DE ENUMS SIN USO\n');
  console.log('='.repeat(80));

  const unusedEnums: EnumValues[] = [];
  const unusedMembers: { enumName: string; member: string; file: string }[] = [];

  enumMap.forEach((enumData) => {
    if (enumData.usageCount === 0) {
      unusedEnums.push(enumData);
    } else {
      // Si el enum se usa, verificar sus miembros
      enumData.memberUsageCounts.forEach((count, member) => {
        if (count === 0) {
          unusedMembers.push({
            enumName: enumData.enumName,
            member: member,
            file: enumData.file
          });
        }
      });
    }
  });

  if (unusedEnums.length === 0) {
    console.log('✅ Todos los Enums definidos parecen estar en uso.\n');
  } else {
    console.log(`⚠️  Se encontraron ${unusedEnums.length} Enums que no parecen usarse:\n`);
    unusedEnums.forEach((e) => {
      const relativePath = path.relative(path.join(__dirname, '..'), e.file);
      console.log(`   - ${e.enumName} (en ${relativePath})`);
    });
    console.log();
  }

  // --- REPORTE 3: Miembros de Enum sin uso ---

  console.log('📉 REPORTE DE MIEMBROS DE ENUM SIN USO\n');
  console.log('='.repeat(80));

  if (unusedMembers.length === 0) {
    console.log('✅ Todos los miembros de los Enums usados parecen estar en uso.\n');
  } else {
    console.log(`⚠️  Se encontraron ${unusedMembers.length} miembros de Enums sin uso explícito:\n`);

    // Agrupar por Enum
    const membersByEnum = new Map<string, string[]>();
    unusedMembers.forEach((item) => {
      if (!membersByEnum.has(item.enumName)) {
        membersByEnum.set(item.enumName, []);
      }
      membersByEnum.get(item.enumName)!.push(item.member);
    });

    membersByEnum.forEach((members, enumName) => {
      console.log(`   ${enumName}:`);
      console.log(`      ${members.join(', ')}`);
    });
    console.log();
  }

  // Guardar reporte completo en JSON
  const reportPath = path.join(__dirname, '../enum-validation-report.json');
  const report = {
    summary: {
      totalEnums: enumMap.size,
      unusedEnums: unusedEnums.length,
      unusedMembers: unusedMembers.length,
      missingEnumOccurrences: missingEnumOccurrences.length,
    },
    unusedEnums: unusedEnums.map(e => ({
      name: e.enumName,
      file: path.relative(path.join(__dirname, '..'), e.file)
    })),
    unusedMembers: unusedMembers.map(m => ({
      enum: m.enumName,
      member: m.member,
      file: path.relative(path.join(__dirname, '..'), m.file)
    })),
    missingEnumUsages: sortedMissing.map(([stringLiteral, occurrences]) => ({
      stringLiteral,
      possibleEnums: valueToEnums.get(stringLiteral),
      count: occurrences.length,
      occurrences: occurrences.map((occ) => ({
        file: path.relative(path.join(__dirname, '..'), occ.file),
        line: occ.line,
        lineContent: occ.lineContent,
      })),
    })),
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ Reporte completo guardado en: ${reportPath}`);
}

main();
