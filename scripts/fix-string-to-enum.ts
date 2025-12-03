#!/usr/bin/env node

/**
 * Script para corregir strings literales que deberían ser enums.
 * Lee el reporte de validación y aplica correcciones automáticas.
 * 
 * Uso:
 *   tsx scripts/fix-string-to-enum.ts --dry-run    # Solo muestra cambios
 *   tsx scripts/fix-string-to-enum.ts --file <path> # Aplica a un archivo
 *   tsx scripts/fix-string-to-enum.ts              # Aplica a todo
 */

import * as fs from 'fs';
import * as path from 'path';

const projectRoot = process.cwd();

// Mapeo de string literal -> { enum, member, importPath }
// Se construye dinámicamente leyendo los archivos de enums
interface EnumMapping {
  enumName: string;
  memberName: string;
  importPath: string;
  value: string;
}

interface MissingEnumUsage {
  stringLiteral: string;
  possibleEnums: string[];
  count: number;
  occurrences: Array<{
    file: string;
    line: number;
    lineContent: string;
  }>;
}

interface ValidationReport {
  missingEnumUsages: MissingEnumUsage[];
}

// Prioridad de enums para cada contexto
// Cuando un string literal puede pertenecer a múltiples enums,
// usamos el contexto del archivo para decidir cuál usar
const ENUM_PRIORITY_BY_CONTEXT: Record<string, string[]> = {
  // Handlers de AI usan TaskStatus para status
  'ai/handlers': ['TaskStatus'],
  'movement': ['TaskStatus'],
  'needs': ['TaskStatus', 'NeedType'],
  'conflict': ['TaskStatus'],
  'economy': ['TaskStatus', 'MarketOrderStatus'],
  'social': ['TaskStatus'],
  'structures': ['TaskStatus'],
  // Recursos
  'ItemGeneration': ['ResourceType', 'ZoneType'],
  'WorldConfig': ['ResourceType', 'ZoneType'],
  'WorldResource': ['ResourceType', 'WorldResourceType', 'WorldEntityType'],
  // Loading
  'loading': ['LoadingPhaseStatus'],
  'Loading': ['LoadingPhaseStatus'],
};

// Mapeo manual de strings a enums preferidos
const STRING_TO_ENUM_PREFERENCE: Record<string, { enum: string; member: string }> = {
  // Status de handlers (ECS)
  'completed': { enum: 'HandlerResultStatus', member: 'COMPLETED' },
  'pending': { enum: 'TaskStatus', member: 'PENDING' },
  'failed': { enum: 'HandlerResultStatus', member: 'FAILED' },
  'active': { enum: 'TaskStatus', member: 'ACTIVE' },
  'cancelled': { enum: 'TaskStatus', member: 'CANCELLED' },
  'delegated': { enum: 'HandlerResultStatus', member: 'DELEGATED' },
  'in_progress': { enum: 'HandlerResultStatus', member: 'IN_PROGRESS' },
  
  // Recursos básicos
  'water': { enum: 'ResourceType', member: 'WATER' },
  'food': { enum: 'ResourceType', member: 'FOOD' },
  'wood': { enum: 'ResourceType', member: 'WOOD' },
  'stone': { enum: 'ResourceType', member: 'STONE' },
  
  // Entidades del mundo
  'tree': { enum: 'WorldEntityType', member: 'TREE' },
  'rock': { enum: 'WorldEntityType', member: 'ROCK' },
  
  // Zonas
  'storage': { enum: 'ZoneType', member: 'STORAGE' },
  'rest': { enum: 'ZoneType', member: 'REST' },
  'work': { enum: 'ZoneType', member: 'WORK' },
  'social': { enum: 'NeedType', member: 'SOCIAL' },
  'combat': { enum: 'GoalDomain', member: 'COMBAT' },
  'trade': { enum: 'GoalDomain', member: 'TRADE' },
  'crafting': { enum: 'GoalDomain', member: 'CRAFTING' },
  
  // Entidades controladas
  'isa': { enum: 'ControlledEntity', member: 'ISA' },
  'stev': { enum: 'ControlledEntity', member: 'STEV' },
  
  // Asset types
  'terrain': { enum: 'AssetCategory', member: 'TERRAIN' },
  'structure': { enum: 'AssetCategory', member: 'STRUCTURE' },
  
  // Biomas
  'mystical': { enum: 'BiomeType', member: 'MYSTICAL' },
  
  // Niveles
  'critical': { enum: 'AssetPriority', member: 'CRITICAL' },
  
  // Tipos de entidad
  'agent': { enum: 'EntityType', member: 'AGENT' },
};

// Rutas de importación para cada enum
const ENUM_IMPORT_PATHS: Record<string, string> = {
  'TaskStatus': '@/domain/simulation/systems/agents/ai/types',
  'HandlerResultStatus': '@/shared/constants/StatusEnums',
  'NeedType': '@/shared/constants/AIEnums',
  'GoalType': '@/shared/constants/AIEnums',
  'ActionType': '@/shared/constants/AIEnums',
  'GoalDomain': '@/shared/constants/AIEnums',
  'ResourceType': '@/shared/constants/ResourceEnums',
  'WorldResourceType': '@/shared/constants/ResourceEnums',
  'WorldEntityType': '@/shared/constants/ResourceEnums',
  'ZoneType': '@/shared/constants/ZoneEnums',
  'ControlledEntity': '@/shared/constants/ControlledEntities',
  'AssetCategory': '@/shared/constants/AssetEnums',
  'AssetPriority': '@/shared/constants/AssetEnums',
  'BiomeType': '@/shared/constants/BiomeEnums',
  'EntityType': '@/shared/constants/EntityEnums',
  'MarketOrderStatus': '@/shared/constants/EconomyEnums',
  'QuestStatus': '@/shared/constants/QuestEnums',
  'InteractionStatus': '@/shared/constants/StatusEnums',
  'LoadingPhaseStatus': '@/shared/constants/LoadingStates',
};

interface FileChange {
  file: string;
  line: number;
  original: string;
  replacement: string;
  enumName: string;
  enumMember: string;
  importNeeded: string | null;
}

function getEnumForContext(stringLiteral: string, filePath: string, possibleEnums: string[]): { enum: string; member: string } | null {
  // Primero verificar el mapeo manual - siempre tiene prioridad
  const manual = STRING_TO_ENUM_PREFERENCE[stringLiteral];
  if (manual) {
    // El mapeo manual tiene prioridad absoluta
    return manual;
  }
  
  // Si hay un solo enum posible, usarlo
  if (possibleEnums.length === 1) {
    const enumName = possibleEnums[0];
    const member = stringLiteral.toUpperCase().replace(/-/g, '_');
    return { enum: enumName, member };
  }
  
  // Buscar por contexto del archivo
  for (const [context, priorityEnums] of Object.entries(ENUM_PRIORITY_BY_CONTEXT)) {
    if (filePath.includes(context)) {
      for (const enumName of priorityEnums) {
        if (possibleEnums.includes(enumName)) {
          const member = stringLiteral.toUpperCase().replace(/-/g, '_');
          return { enum: enumName, member };
        }
      }
    }
  }
  
  // Fallback: usar el primer enum de la lista
  if (possibleEnums.length > 0) {
    const enumName = possibleEnums[0];
    const member = stringLiteral.toUpperCase().replace(/-/g, '_');
    return { enum: enumName, member };
  }
  
  return null;
}

function analyzeReport(): FileChange[] {
  const reportPath = path.join(projectRoot, 'enum-validation-report.json');
  if (!fs.existsSync(reportPath)) {
    console.error('❌ No se encontró enum-validation-report.json. Ejecuta npm run validate:enums primero.');
    process.exit(1);
  }
  
  const report: ValidationReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  const changes: FileChange[] = [];
  
  for (const usage of report.missingEnumUsages) {
    const { stringLiteral, possibleEnums, occurrences } = usage;
    
    for (const occurrence of occurrences) {
      const { file, line, lineContent } = occurrence;
      
      // Solo procesar archivos del backend (no frontend)
      if (file.includes('../UnaCartaParaIsa/')) continue;
      
      // Obtener el enum apropiado para este contexto
      const enumInfo = getEnumForContext(stringLiteral, file, possibleEnums);
      if (!enumInfo) continue;
      
      const importPath = ENUM_IMPORT_PATHS[enumInfo.enum];
      if (!importPath) continue;
      
      // Crear el reemplazo
      const patterns = [
        { regex: new RegExp(`"${stringLiteral}"`, 'g'), replacement: `${enumInfo.enum}.${enumInfo.member}` },
        { regex: new RegExp(`'${stringLiteral}'`, 'g'), replacement: `${enumInfo.enum}.${enumInfo.member}` },
      ];
      
      let newContent = lineContent;
      for (const p of patterns) {
        newContent = newContent.replace(p.regex, p.replacement);
      }
      
      if (newContent !== lineContent) {
        changes.push({
          file: file.startsWith('src/') ? path.join(projectRoot, file) : path.join(projectRoot, file),
          line,
          original: lineContent,
          replacement: newContent,
          enumName: enumInfo.enum,
          enumMember: enumInfo.member,
          importNeeded: importPath,
        });
      }
    }
  }
  
  return changes;
}

function groupChangesByFile(changes: FileChange[]): Map<string, FileChange[]> {
  const grouped = new Map<string, FileChange[]>();
  for (const change of changes) {
    const existing = grouped.get(change.file) || [];
    existing.push(change);
    grouped.set(change.file, existing);
  }
  return grouped;
}

function getExistingImports(content: string): Set<string> {
  const imports = new Set<string>();
  const importRegex = /import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const items = match[1].split(',').map(s => s.trim().split(' as ')[0].trim());
    items.forEach(item => imports.add(item));
  }
  return imports;
}

function addMissingImports(content: string, enumsNeeded: Map<string, string>): string {
  const existingImports = getExistingImports(content);
  const newImports: Map<string, Set<string>> = new Map();
  
  for (const [enumName, importPath] of enumsNeeded) {
    if (!existingImports.has(enumName)) {
      const existing = newImports.get(importPath) || new Set();
      existing.add(enumName);
      newImports.set(importPath, existing);
    }
  }
  
  if (newImports.size === 0) return content;
  
  // Construir líneas de import
  const importLines: string[] = [];
  for (const [importPath, enums] of newImports) {
    importLines.push(`import { ${Array.from(enums).sort().join(', ')} } from "${importPath}";`);
  }
  
  // Insertar después de los imports existentes
  const lastImportIndex = content.lastIndexOf('import ');
  if (lastImportIndex !== -1) {
    const lineEnd = content.indexOf('\n', lastImportIndex);
    const before = content.slice(0, lineEnd + 1);
    const after = content.slice(lineEnd + 1);
    return before + importLines.join('\n') + '\n' + after;
  } else {
    // No hay imports, agregar al inicio
    return importLines.join('\n') + '\n\n' + content;
  }
}

function applyChangesToFile(filePath: string, changes: FileChange[], dryRun: boolean): boolean {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);
  
  if (!fs.existsSync(absolutePath)) {
    console.warn(`⚠️  Archivo no encontrado: ${absolutePath}`);
    return false;
  }
  
  let content = fs.readFileSync(absolutePath, 'utf-8');
  const lines = content.split('\n');
  
  // Ordenar cambios por línea (descendente para no afectar índices)
  changes.sort((a, b) => b.line - a.line);
  
  // Recolectar enums necesarios
  const enumsNeeded: Map<string, string> = new Map();
  
  for (const change of changes) {
    const lineIndex = change.line - 1;
    if (lineIndex >= 0 && lineIndex < lines.length) {
      const currentLine = lines[lineIndex];
      
      // Verificar que la línea aún contiene el string literal
      if (currentLine.includes(`"${change.original.match(/"([^"]+)"/)?.[1] || ''}"`) ||
          currentLine.includes(`'${change.original.match(/'([^']+)'/)?.[1] || ''}'`)) {
        
        // Aplicar el reemplazo
        const stringLiteral = change.original.match(/["']([^"']+)["']/)?.[1];
        if (stringLiteral) {
          const newLine = currentLine
            .replace(new RegExp(`"${stringLiteral}"`, 'g'), `${change.enumName}.${change.enumMember}`)
            .replace(new RegExp(`'${stringLiteral}'`, 'g'), `${change.enumName}.${change.enumMember}`);
          
          if (newLine !== currentLine) {
            lines[lineIndex] = newLine;
            if (change.importNeeded) {
              enumsNeeded.set(change.enumName, change.importNeeded);
            }
          }
        }
      }
    }
  }
  
  content = lines.join('\n');
  
  // Agregar imports faltantes
  content = addMissingImports(content, enumsNeeded);
  
  if (dryRun) {
    console.log(`\n📄 ${absolutePath}`);
    for (const change of changes.reverse()) {
      console.log(`   L${change.line}: "${change.original.trim()}" → "${change.replacement.trim()}"`);
    }
    return true;
  } else {
    fs.writeFileSync(absolutePath, content, 'utf-8');
    console.log(`✅ ${absolutePath} (${changes.length} cambios)`);
    return true;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fileFilter = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;
  
  console.log('🔍 Analizando reporte de validación de enums...\n');
  
  const changes = analyzeReport();
  console.log(`📊 Se encontraron ${changes.length} cambios potenciales\n`);
  
  if (changes.length === 0) {
    console.log('✨ No hay cambios necesarios');
    return;
  }
  
  const grouped = groupChangesByFile(changes);
  
  let filesProcessed = 0;
  let changesApplied = 0;
  
  for (const [file, fileChanges] of grouped) {
    // Filtrar por archivo si se especificó
    if (fileFilter && !file.includes(fileFilter)) continue;
    
    if (applyChangesToFile(file, fileChanges, dryRun)) {
      filesProcessed++;
      changesApplied += fileChanges.length;
    }
  }
  
  console.log(`\n📈 Resumen: ${changesApplied} cambios en ${filesProcessed} archivos`);
  
  if (dryRun) {
    console.log('\n💡 Ejecuta sin --dry-run para aplicar los cambios');
  }
}

main().catch(console.error);
