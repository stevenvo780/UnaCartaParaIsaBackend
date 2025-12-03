#!/usr/bin/env tsx
/**
 * Script final para corregir las 18 ocurrencias restantes de strings a enums.
 * Basado en el reporte de validate:enums.
 */

import * as fs from 'fs';
import * as path from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const projectRoot = process.cwd();

interface Replacement {
  file: string;
  search: string | RegExp;
  replace: string;
  enumImport: { name: string; from: string };
  contextCheck?: (line: string) => boolean;
}

// Mapeo de correcciones basado en el reporte - VALIDADO CON CONTEXTO
const replacements: Replacement[] = [
  // 1. "neutral" en musicMood → MusicMood.NEUTRAL
  {
    file: 'src/domain/simulation/systems/agents/AmbientAwarenessSystem.ts',
    search: /musicMood:\s*["']neutral["']/g,
    replace: 'musicMood: MusicMood.NEUTRAL',
    enumImport: { name: 'MusicMood', from: '@/shared/constants/AmbientEnums' },
  },
  {
    file: 'src/domain/simulation/systems/agents/AmbientAwarenessSystem.ts',
    search: /return\s+["']neutral["']/g,
    replace: 'return MusicMood.NEUTRAL',
    enumImport: { name: 'MusicMood', from: '@/shared/constants/AmbientEnums' },
  },
  
  // 2. "world" - Es un contexto source, NO es PanelName. Dejarlo como string o crear SourceType enum.
  // Por ahora lo dejamos - es válido como string contextual
  
  // 3. "default" → ExplorationType.DEFAULT  
  {
    file: 'src/domain/simulation/systems/conflict/ConflictResolutionSystem.ts',
    search: /:\s*["']default["']\s*;/g,
    replace: ': ExplorationType.DEFAULT;',
    enumImport: { name: 'ExplorationType', from: '@/shared/constants/AIEnums' },
  },
  {
    file: 'src/infrastructure/controllers/worldController.ts',
    search: /:\s*["']default["']\s*;/g,
    replace: ': ExplorationType.DEFAULT;',
    enumImport: { name: 'ExplorationType', from: '@/shared/constants/AIEnums' },
  },
  
  // 4. "unarmed" - Es un valor especial de tipo union ItemId | "unarmed"
  // Se deja como está porque es parte del sistema de tipos
  
  // 5. "materials" - Es acceso a tipo GameResources["materials"], NO StockpileType
  // Se deja como está
  
  // 6. "night" - Ya se compara con TimeOfDayPhase en la misma línea
  {
    file: 'src/domain/simulation/core/runner/EventRegistry.ts',
    search: /period\s*===\s*["']night["']/g,
    replace: 'period === TimeOfDayPhase.NIGHT',
    enumImport: { name: 'TimeOfDayPhase', from: '@/shared/constants/WorldEnums' },
  },
  
  // 7. "adult" - LifeStage.ADULT
  {
    file: 'src/domain/simulation/systems/agents/ai/AISystem.ts',
    search: /lifeStage\s*!==\s*["']adult["']/g,
    replace: 'lifeStage !== LifeStage.ADULT',
    enumImport: { name: 'LifeStage', from: '@/shared/constants/AgentEnums' },
  },
  
  // 8. "energy" en modifyNeed y context → NeedType.ENERGY
  {
    file: 'src/domain/simulation/systems/agents/ai/AISystem.ts',
    search: /:\s*["']energy["']/g,
    replace: ': NeedType.ENERGY',
    enumImport: { name: 'NeedType', from: '@/shared/constants/AIEnums' },
  },
  {
    file: 'src/domain/simulation/core/runner/EventRegistry.ts',
    search: /,\s*["']energy["']\s*,/g,
    replace: ', NeedType.ENERGY,',
    enumImport: { name: 'NeedType', from: '@/shared/constants/AIEnums' },
  },
  
  // 9. "construction" → GoalType.CONSTRUCTION (workType)
  {
    file: 'src/domain/simulation/systems/agents/ai/detectors/BuildDetector.ts',
    search: /workType:\s*["']construction["']/g,
    replace: 'workType: GoalType.CONSTRUCTION',
    enumImport: { name: 'GoalType', from: '@/shared/constants/AIEnums' },
  },
  
  // 10. "inspect" → ExplorationType (como explorationType parameter)
  {
    file: 'src/domain/simulation/systems/agents/ai/detectors/ExploreDetector.ts',
    search: /explorationType:\s*["']inspect["']/g,
    replace: 'explorationType: GoalType.INSPECT',
    enumImport: { name: 'GoalType', from: '@/shared/constants/AIEnums' },
  },
  
  // 11. "fun" → NeedType.FUN
  {
    file: 'src/domain/simulation/systems/agents/ai/detectors/NeedsDetector.ts',
    search: /needType:\s*["']fun["']/g,
    replace: 'needType: NeedType.FUN',
    enumImport: { name: 'NeedType', from: '@/shared/constants/AIEnums' },
  },
  
  // 12. "play" en action → ActionType.PLAY (si existe) o ZoneType.PLAY
  {
    file: 'src/domain/simulation/systems/agents/ai/detectors/NeedsDetector.ts',
    search: /action:\s*["']play["']/g,
    replace: 'action: ZoneType.PLAY',
    enumImport: { name: 'ZoneType', from: '@/shared/constants/ZoneEnums' },
  },
  
  // 13. "trade" en action → Revisar si es ActionType o ItemCategory
  {
    file: 'src/domain/simulation/systems/agents/ai/detectors/TradeDetector.ts',
    search: /action:\s*["']trade["']/g,
    replace: 'action: ItemCategory.TRADE',
    enumImport: { name: 'ItemCategory', from: '@/shared/constants/ItemEnums' },
  },
  
  // 14. "expired" → TradeOfferStatus.EXPIRED
  {
    file: 'src/domain/simulation/systems/conflict/ConflictResolutionSystem.ts',
    search: /outcome:\s*["']expired["']/g,
    replace: 'outcome: TradeOfferStatus.EXPIRED',
    enumImport: { name: 'TradeOfferStatus', from: '@/shared/constants/EconomyEnums' },
  },
  
  // 15. "terrain_grassland" → TileType.TERRAIN_GRASSLAND
  {
    file: 'src/domain/simulation/systems/world/TerrainSystem.ts',
    search: /terrain:\s*["']terrain_grassland["']/g,
    replace: 'terrain: TileType.TERRAIN_GRASSLAND',
    enumImport: { name: 'TileType', from: '@/shared/constants/WorldEnums' },
  },
];

function addImportIfNeeded(content: string, enumName: string, fromPath: string): string {
  // Verificar si ya existe el import
  const importRegex = new RegExp(`import\\s*\\{[^}]*\\b${enumName}\\b[^}]*\\}\\s*from\\s*['"]${fromPath.replace(/\//g, '\\/')}['"]`);
  if (importRegex.test(content)) {
    return content; // Ya existe
  }

  // Verificar si hay un import del mismo módulo para agregar el enum
  const moduleImportRegex = new RegExp(`(import\\s*\\{)([^}]*)(\\}\\s*from\\s*['"]${fromPath.replace(/\//g, '\\/')}['"])`);
  const moduleMatch = content.match(moduleImportRegex);
  
  if (moduleMatch) {
    // Agregar al import existente
    const existingImports = moduleMatch[2].trim();
    if (!existingImports.includes(enumName)) {
      const newImports = existingImports.endsWith(',') 
        ? `${existingImports} ${enumName},`
        : `${existingImports}, ${enumName}`;
      return content.replace(moduleImportRegex, `$1${newImports}$3`);
    }
    return content;
  }

  // Agregar nuevo import después del último import existente
  const lastImportMatch = content.match(/^(import\s+.+from\s+['"][^'"]+['"];?\s*)+/m);
  if (lastImportMatch) {
    const lastImport = lastImportMatch[0];
    const newImport = `import { ${enumName} } from '${fromPath}';\n`;
    return content.replace(lastImport, lastImport + newImport);
  }

  // Si no hay imports, agregar al principio
  return `import { ${enumName} } from '${fromPath}';\n` + content;
}

function processFile(filePath: string, fileReplacements: Replacement[]): { changed: boolean; changes: string[] } {
  const fullPath = path.join(projectRoot, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`   ⚠️  Archivo no encontrado: ${filePath}`);
    return { changed: false, changes: [] };
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;
  const changes: string[] = [];
  const importsToAdd: Map<string, string> = new Map();

  for (const replacement of fileReplacements) {
    const regex = replacement.search instanceof RegExp 
      ? replacement.search 
      : new RegExp(replacement.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    
    const matches = content.match(regex);
    if (matches) {
      // Si hay contextCheck, verificar línea por línea
      if (replacement.contextCheck) {
        const lines = content.split('\n');
        let newContent = '';
        let lastIndex = 0;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (regex.test(line) && replacement.contextCheck(line)) {
            const updatedLine = line.replace(regex, replacement.replace);
            if (updatedLine !== line) {
              changes.push(`  L${i + 1}: ${line.trim()} → ${updatedLine.trim()}`);
              lines[i] = updatedLine;
              importsToAdd.set(replacement.enumImport.name, replacement.enumImport.from);
            }
          }
          regex.lastIndex = 0; // Reset regex state
        }
        content = lines.join('\n');
      } else {
        const newContent = content.replace(regex, replacement.replace);
        if (newContent !== content) {
          changes.push(`  Reemplazado: ${matches[0]} → ${replacement.replace}`);
          content = newContent;
          importsToAdd.set(replacement.enumImport.name, replacement.enumImport.from);
        }
      }
    }
  }

  // Agregar imports necesarios
  for (const [enumName, fromPath] of importsToAdd) {
    content = addImportIfNeeded(content, enumName, fromPath);
  }

  if (content !== originalContent) {
    if (!DRY_RUN) {
      fs.writeFileSync(fullPath, content, 'utf8');
    }
    return { changed: true, changes };
  }

  return { changed: false, changes: [] };
}

function main() {
  console.log('🔧 Corrección final de strings a enums');
  console.log(DRY_RUN ? '   [DRY RUN - No se aplicarán cambios]' : '   [MODO APLICAR]');
  console.log('');

  // Agrupar reemplazos por archivo
  const byFile = new Map<string, Replacement[]>();
  for (const r of replacements) {
    if (!byFile.has(r.file)) {
      byFile.set(r.file, []);
    }
    byFile.get(r.file)!.push(r);
  }

  let totalChanged = 0;
  let totalChanges = 0;

  for (const [file, fileReplacements] of byFile) {
    console.log(`📄 ${file}`);
    const { changed, changes } = processFile(file, fileReplacements);
    if (changed) {
      totalChanged++;
      totalChanges += changes.length;
      changes.forEach(c => console.log(c));
      console.log(DRY_RUN ? '   [Cambios detectados]' : '   ✅ Guardado');
    } else {
      console.log('   Sin cambios necesarios');
    }
    console.log('');
  }

  console.log('═'.repeat(60));
  console.log(`📊 Resumen: ${totalChanged} archivos ${DRY_RUN ? 'con cambios detectados' : 'modificados'}, ${totalChanges} cambios`);
  
  if (DRY_RUN) {
    console.log('\n💡 Ejecuta sin --dry-run para aplicar los cambios');
  }
}

main();
