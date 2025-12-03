#!/usr/bin/env node

/**
 * Script para corregir strings literales a enums específicos.
 * Fase 2: Recursos, zonas, tipos de mundo
 */

import * as fs from 'fs';
import * as path from 'path';

const projectRoot = process.cwd();

// Archivos a procesar en el backend
const BACKEND_FILES = [
  'src/domain/simulation/systems/agents/ai/detectors/NeedsDetector.ts',
  'src/domain/simulation/systems/agents/needs/NeedsSystem.ts',
  'src/domain/simulation/systems/agents/movement/MovementSystem.ts',
  'src/domain/simulation/systems/agents/SystemRegistry.ts',
  'src/domain/simulation/systems/world/ItemGenerationSystem.ts',
  'src/domain/simulation/systems/world/WorldLoader.ts',
  'src/domain/simulation/systems/social/SocialSystem.ts',
  'src/domain/simulation/systems/economy/EconomySystem.ts',
  'src/domain/simulation/systems/economy/EnhancedCraftingSystem.ts',
  'src/domain/simulation/systems/economy/InventorySystem.ts',
  'src/domain/simulation/systems/conflict/CombatSystem.ts',
  'src/domain/simulation/systems/structures/BuildingSystem.ts',
  'src/shared/constants/WorldConfig.ts',
  'src/domain/data/BaseMaterialsCatalog.ts',
];

interface ReplacementRule {
  from: RegExp;
  to: string;
  importNeeded?: { name: string; path: string };
}

// Reglas de reemplazo
const RULES: ReplacementRule[] = [
  // ResourceType
  { 
    from: /resourceType:\s*["']water["']/g, 
    to: 'resourceType: ResourceType.WATER',
    importNeeded: { name: 'ResourceType', path: '@/shared/constants/ResourceEnums' }
  },
  { 
    from: /resourceType:\s*["']food["']/g, 
    to: 'resourceType: ResourceType.FOOD',
    importNeeded: { name: 'ResourceType', path: '@/shared/constants/ResourceEnums' }
  },
  { 
    from: /resourceType:\s*["']wood["']/g, 
    to: 'resourceType: ResourceType.WOOD',
    importNeeded: { name: 'ResourceType', path: '@/shared/constants/ResourceEnums' }
  },
  { 
    from: /resourceType:\s*["']stone["']/g, 
    to: 'resourceType: ResourceType.STONE',
    importNeeded: { name: 'ResourceType', path: '@/shared/constants/ResourceEnums' }
  },
  { 
    from: /resourceType\s*===\s*["']water["']/g, 
    to: 'resourceType === ResourceType.WATER',
    importNeeded: { name: 'ResourceType', path: '@/shared/constants/ResourceEnums' }
  },
  { 
    from: /resourceType\s*===\s*["']food["']/g, 
    to: 'resourceType === ResourceType.FOOD',
    importNeeded: { name: 'ResourceType', path: '@/shared/constants/ResourceEnums' }
  },
  
  // NeedType para params
  { 
    from: /needType:\s*["']hunger["']/g, 
    to: 'needType: NeedType.HUNGER',
    importNeeded: { name: 'NeedType', path: '@/shared/constants/AIEnums' }
  },
  { 
    from: /needType:\s*["']thirst["']/g, 
    to: 'needType: NeedType.THIRST',
    importNeeded: { name: 'NeedType', path: '@/shared/constants/AIEnums' }
  },
  { 
    from: /needType:\s*["']energy["']/g, 
    to: 'needType: NeedType.ENERGY',
    importNeeded: { name: 'NeedType', path: '@/shared/constants/AIEnums' }
  },
  { 
    from: /needType:\s*["']social["']/g, 
    to: 'needType: NeedType.SOCIAL',
    importNeeded: { name: 'NeedType', path: '@/shared/constants/AIEnums' }
  },
  
  // GoalDomain para system: 
  { 
    from: /system:\s*["']combat["']/g, 
    to: 'system: GoalDomain.COMBAT',
    importNeeded: { name: 'GoalDomain', path: '@/shared/constants/AIEnums' }
  },
  { 
    from: /system:\s*["']social["']/g, 
    to: 'system: GoalDomain.SOCIAL',
    importNeeded: { name: 'GoalDomain', path: '@/shared/constants/AIEnums' }
  },
  { 
    from: /system:\s*["']crafting["']/g, 
    to: 'system: GoalDomain.CRAFTING',
    importNeeded: { name: 'GoalDomain', path: '@/shared/constants/AIEnums' }
  },
  { 
    from: /system:\s*["']trade["']/g, 
    to: 'system: GoalDomain.LOGISTICS',
    importNeeded: { name: 'GoalDomain', path: '@/shared/constants/AIEnums' }
  },
  
  // Case statements para system switch
  { 
    from: /case\s*["']combat["']:/g, 
    to: 'case GoalDomain.COMBAT:',
    importNeeded: { name: 'GoalDomain', path: '@/shared/constants/AIEnums' }
  },
  { 
    from: /case\s*["']social["']:/g, 
    to: 'case GoalDomain.SOCIAL:',
    importNeeded: { name: 'GoalDomain', path: '@/shared/constants/AIEnums' }
  },
  { 
    from: /case\s*["']crafting["']:/g, 
    to: 'case GoalDomain.CRAFTING:',
    importNeeded: { name: 'GoalDomain', path: '@/shared/constants/AIEnums' }
  },
  { 
    from: /case\s*["']trade["']:/g, 
    to: 'case GoalDomain.LOGISTICS:',
    importNeeded: { name: 'GoalDomain', path: '@/shared/constants/AIEnums' }
  },
  
  // ZoneType
  { 
    from: /type:\s*["']rest["']/g, 
    to: 'type: ZoneType.REST',
    importNeeded: { name: 'ZoneType', path: '@/shared/constants/ZoneEnums' }
  },
  { 
    from: /type:\s*["']work["']/g, 
    to: 'type: ZoneType.WORK',
    importNeeded: { name: 'ZoneType', path: '@/shared/constants/ZoneEnums' }
  },
  { 
    from: /type:\s*["']storage["']/g, 
    to: 'type: ZoneType.STORAGE',
    importNeeded: { name: 'ZoneType', path: '@/shared/constants/ZoneEnums' }
  },
  { 
    from: /type:\s*["']food["']/g, 
    to: 'type: ZoneType.FOOD',
    importNeeded: { name: 'ZoneType', path: '@/shared/constants/ZoneEnums' }
  },
  { 
    from: /type:\s*["']water["']/g, 
    to: 'type: ZoneType.WATER',
    importNeeded: { name: 'ZoneType', path: '@/shared/constants/ZoneEnums' }
  },
  { 
    from: /zoneType:\s*["']food["']/g, 
    to: 'zoneType: ZoneType.FOOD',
    importNeeded: { name: 'ZoneType', path: '@/shared/constants/ZoneEnums' }
  },
  { 
    from: /zoneType:\s*["']work["']/g, 
    to: 'zoneType: ZoneType.WORK',
    importNeeded: { name: 'ZoneType', path: '@/shared/constants/ZoneEnums' }
  },
  { 
    from: /zoneType:\s*["']storage["']/g, 
    to: 'zoneType: ZoneType.STORAGE',
    importNeeded: { name: 'ZoneType', path: '@/shared/constants/ZoneEnums' }
  },
  
  // WorldEntityType
  { 
    from: /type\s*===\s*["']tree["']/g, 
    to: 'type === WorldEntityType.TREE',
    importNeeded: { name: 'WorldEntityType', path: '@/shared/constants/ResourceEnums' }
  },
  { 
    from: /type\s*===\s*["']rock["']/g, 
    to: 'type === WorldEntityType.ROCK',
    importNeeded: { name: 'WorldEntityType', path: '@/shared/constants/ResourceEnums' }
  },
  
  // ControlledEntity
  { 
    from: /id:\s*["']isa["']/g, 
    to: 'id: ControlledEntity.ISA',
    importNeeded: { name: 'ControlledEntity', path: '@/shared/constants/ControlledEntities' }
  },
  { 
    from: /id:\s*["']stev["']/g, 
    to: 'id: ControlledEntity.STEV',
    importNeeded: { name: 'ControlledEntity', path: '@/shared/constants/ControlledEntities' }
  },
  { 
    from: /===\s*["']isa["']/g, 
    to: '=== ControlledEntity.ISA',
    importNeeded: { name: 'ControlledEntity', path: '@/shared/constants/ControlledEntities' }
  },
  { 
    from: /===\s*["']stev["']/g, 
    to: '=== ControlledEntity.STEV',
    importNeeded: { name: 'ControlledEntity', path: '@/shared/constants/ControlledEntities' }
  },
  
  // BiomeType
  { 
    from: /biome:\s*["']mystical["']/g, 
    to: 'biome: BiomeType.MYSTICAL',
    importNeeded: { name: 'BiomeType', path: '@/shared/constants/BiomeEnums' }
  },
];

function addImportIfNeeded(content: string, importName: string, importPath: string): string {
  // Verificar si ya tiene el import
  const importRegex = new RegExp(`import.*\\{[^}]*${importName}[^}]*\\}.*from.*["']${importPath.replace(/\//g, '\\/')}["']`);
  if (importRegex.test(content)) {
    return content;
  }
  
  // Verificar si ya importa algo de ese path
  const pathImportRegex = new RegExp(`(import\\s*\\{[^}]+)(\\}\\s*from\\s*["']${importPath.replace(/\//g, '\\/')}["'])`);
  const pathMatch = content.match(pathImportRegex);
  
  if (pathMatch) {
    // Agregar al import existente
    const existingImports = pathMatch[1];
    // Verificar que no esté ya
    if (!existingImports.includes(importName)) {
      return content.replace(
        pathImportRegex,
        `${existingImports}, ${importName}$2`
      );
    }
    return content;
  }
  
  // Agregar nuevo import al final de los imports
  const newImport = `import { ${importName} } from "${importPath}";\n`;
  
  // Buscar la última línea de import
  const lines = content.split('\n');
  let lastImportLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ') || lines[i].match(/^import\s*\{/)) {
      lastImportLine = i;
    }
  }
  
  if (lastImportLine >= 0) {
    lines.splice(lastImportLine + 1, 0, newImport.trim());
    return lines.join('\n');
  }
  
  // No hay imports, agregar al inicio
  return newImport + '\n' + content;
}

function processFile(filePath: string, dryRun: boolean): boolean {
  const absolutePath = path.join(projectRoot, filePath);
  
  if (!fs.existsSync(absolutePath)) {
    console.warn(`⚠️  Archivo no encontrado: ${absolutePath}`);
    return false;
  }
  
  let content = fs.readFileSync(absolutePath, 'utf-8');
  const original = content;
  const importsNeeded: Map<string, string> = new Map();
  
  // Aplicar reglas
  for (const rule of RULES) {
    const newContent = content.replace(rule.from, rule.to);
    if (newContent !== content) {
      content = newContent;
      if (rule.importNeeded) {
        importsNeeded.set(rule.importNeeded.name, rule.importNeeded.path);
      }
    }
  }
  
  if (content === original) {
    return false;
  }
  
  // Agregar imports
  for (const [name, path] of importsNeeded) {
    content = addImportIfNeeded(content, name, path);
  }
  
  if (!dryRun) {
    fs.writeFileSync(absolutePath, content, 'utf-8');
    console.log(`✅ ${filePath}`);
  } else {
    console.log(`📄 ${filePath} (cambios pendientes)`);
  }
  
  return true;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fileFilter = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;
  
  console.log('🔧 Corrector de strings a enums - Fase 2\n');
  
  const filesToProcess = fileFilter 
    ? BACKEND_FILES.filter(f => f.includes(fileFilter))
    : BACKEND_FILES;
  
  let changesCount = 0;
  
  for (const file of filesToProcess) {
    if (processFile(file, dryRun)) changesCount++;
  }
  
  console.log(`\n📈 Resumen: ${changesCount} archivos ${dryRun ? 'con cambios pendientes' : 'modificados'}`);
  
  if (dryRun) {
    console.log('\n💡 Ejecuta sin --dry-run para aplicar los cambios');
  }
}

main();
