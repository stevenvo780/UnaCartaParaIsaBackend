#!/usr/bin/env node

/**
 * Script para corregir el uso de enums en el sistema de handlers.
 * 
 * Cambios principales:
 * 1. Reemplazar strings literales "completed", "failed", "delegated", "in_progress" 
 *    con HandlerResultStatus
 * 2. Reemplazar QuestStatus.FAILED con HandlerResultStatus.FAILED en handlers
 * 3. Agregar imports necesarios
 */

import * as fs from 'fs';
import * as path from 'path';

const projectRoot = process.cwd();

interface FileChange {
  file: string;
  original: string;
  modified: string;
}

// Archivos a procesar
const FILES_TO_PROCESS = [
  // Handlers
  'src/domain/simulation/systems/agents/ai/handlers/AttackHandler.ts',
  'src/domain/simulation/systems/agents/ai/handlers/BuildHandler.ts',
  'src/domain/simulation/systems/agents/ai/handlers/ConsumeHandler.ts',
  'src/domain/simulation/systems/agents/ai/handlers/CraftHandler.ts',
  'src/domain/simulation/systems/agents/ai/handlers/DepositHandler.ts',
  'src/domain/simulation/systems/agents/ai/handlers/ExploreHandler.ts',
  'src/domain/simulation/systems/agents/ai/handlers/FleeHandler.ts',
  'src/domain/simulation/systems/agents/ai/handlers/GatherHandler.ts',
  'src/domain/simulation/systems/agents/ai/handlers/MoveHandler.ts',
  'src/domain/simulation/systems/agents/ai/handlers/RestHandler.ts',
  'src/domain/simulation/systems/agents/ai/handlers/SocialHandler.ts',
  'src/domain/simulation/systems/agents/ai/handlers/TradeHandler.ts',
  // Types
  'src/domain/simulation/systems/agents/ai/types.ts',
  // Systems
  'src/domain/simulation/systems/agents/movement/MovementSystem.ts',
  'src/domain/simulation/systems/agents/needs/NeedsSystem.ts',
  'src/domain/simulation/systems/conflict/CombatSystem.ts',
  'src/domain/simulation/systems/economy/EconomySystem.ts',
  'src/domain/simulation/systems/economy/EnhancedCraftingSystem.ts',
  'src/domain/simulation/systems/economy/InventorySystem.ts',
  'src/domain/simulation/systems/social/SocialSystem.ts',
  'src/domain/simulation/systems/structures/BuildingSystem.ts',
];

// Reemplazos de strings a enums
const REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  // Status strings -> HandlerResultStatus
  { pattern: /"completed"/g, replacement: 'HandlerResultStatus.COMPLETED' },
  { pattern: /'completed'/g, replacement: 'HandlerResultStatus.COMPLETED' },
  { pattern: /"failed"/g, replacement: 'HandlerResultStatus.FAILED' },
  { pattern: /'failed'/g, replacement: 'HandlerResultStatus.FAILED' },
  { pattern: /"delegated"/g, replacement: 'HandlerResultStatus.DELEGATED' },
  { pattern: /'delegated'/g, replacement: 'HandlerResultStatus.DELEGATED' },
  { pattern: /"in_progress"/g, replacement: 'HandlerResultStatus.IN_PROGRESS' },
  { pattern: /'in_progress'/g, replacement: 'HandlerResultStatus.IN_PROGRESS' },
  // QuestStatus.FAILED -> HandlerResultStatus.FAILED (en contexto de handlers)
  { pattern: /QuestStatus\.FAILED/g, replacement: 'HandlerResultStatus.FAILED' },
];

// Import necesario
const HANDLER_RESULT_STATUS_IMPORT = 'import { HandlerResultStatus } from';
const HANDLER_RESULT_STATUS_IMPORT_FULL = 'import { HandlerResultStatus } from "@/shared/constants/StatusEnums";';

function processFile(filePath: string, dryRun: boolean): FileChange | null {
  const absolutePath = path.join(projectRoot, filePath);
  
  if (!fs.existsSync(absolutePath)) {
    console.warn(`⚠️  Archivo no encontrado: ${absolutePath}`);
    return null;
  }
  
  let content = fs.readFileSync(absolutePath, 'utf-8');
  const original = content;
  
  // Aplicar reemplazos
  let hasChanges = false;
  for (const { pattern, replacement } of REPLACEMENTS) {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      hasChanges = true;
      content = newContent;
    }
  }
  
  if (!hasChanges) {
    return null;
  }
  
  // Agregar import si es necesario
  if (!content.includes(HANDLER_RESULT_STATUS_IMPORT) && content.includes('HandlerResultStatus.')) {
    // Buscar la última línea de import
    const importLines = content.match(/^import .+;$/gm);
    if (importLines && importLines.length > 0) {
      const lastImport = importLines[importLines.length - 1];
      const insertPos = content.indexOf(lastImport) + lastImport.length;
      content = content.slice(0, insertPos) + '\n' + HANDLER_RESULT_STATUS_IMPORT_FULL + content.slice(insertPos);
    } else {
      // Sin imports, agregar al inicio
      content = HANDLER_RESULT_STATUS_IMPORT_FULL + '\n\n' + content;
    }
  }
  
  // Eliminar import de QuestStatus si ya no se usa
  if (!content.includes('QuestStatus.') && !content.includes('QuestStatus,')) {
    // Quitar QuestStatus del import
    content = content.replace(
      /import \{ QuestStatus \} from[^;]+;?\n?/g, 
      ''
    );
    // También manejar imports combinados
    content = content.replace(
      /,\s*QuestStatus\s*}/g,
      ' }'
    );
    content = content.replace(
      /{\s*QuestStatus\s*,/g,
      '{'
    );
  }
  
  if (content === original) {
    return null;
  }
  
  if (!dryRun) {
    fs.writeFileSync(absolutePath, content, 'utf-8');
    console.log(`✅ ${filePath}`);
  } else {
    console.log(`📄 ${filePath} (cambios pendientes)`);
  }
  
  return { file: filePath, original, modified: content };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const singleFile = args.includes('--file') ? args[args.indexOf('--file') + 1] : null;
  
  console.log('🔧 Corrector de HandlerResultStatus\n');
  
  const filesToProcess = singleFile 
    ? FILES_TO_PROCESS.filter(f => f.includes(singleFile))
    : FILES_TO_PROCESS;
  
  let changesCount = 0;
  
  for (const file of filesToProcess) {
    const change = processFile(file, dryRun);
    if (change) changesCount++;
  }
  
  console.log(`\n📈 Resumen: ${changesCount} archivos ${dryRun ? 'con cambios pendientes' : 'modificados'}`);
  
  if (dryRun) {
    console.log('\n💡 Ejecuta sin --dry-run para aplicar los cambios');
  }
}

main();
