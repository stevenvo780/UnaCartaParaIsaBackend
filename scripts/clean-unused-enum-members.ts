#!/usr/bin/env npx tsx
/**
 * Script para limpiar miembros de enum no usados en el backend.
 * 
 * USO:
 *   npx tsx scripts/clean-unused-enum-members.ts          # Modo dry-run (solo muestra)
 *   npx tsx scripts/clean-unused-enum-members.ts --apply  # Aplica cambios
 * 
 * @module scripts/clean-unused-enum-members
 */

import * as fs from 'fs';
import * as path from 'path';

const projectRoot = process.cwd();
const srcDir = path.join(projectRoot, 'src');
const testsDir = path.join(projectRoot, 'tests');

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply');

interface EnumMember {
  name: string;
  value: string;
  line: number;
}

interface EnumInfo {
  name: string;
  file: string;
  members: EnumMember[];
  startLine: number;
  endLine: number;
}

interface UnusedMember {
  enumName: string;
  memberName: string;
  file: string;
  line: number;
}

// Enums protegidos - no tocar sus miembros aunque no se usen
const PROTECTED_ENUMS = new Set([
  // Enums usados en datos externos/JSON
  'ItemId',
  'FoodId', 
  'WeaponId',
  'RecipeId',
  'BuildingType',
  'ZoneType',
  'TileType',
  // Enums de estado que pueden estar en DB/persistencia
  'HandlerResultStatus',
  'EntityStatus',
  'StorageStatus',
  'WorldGenerationStatus',
  // Enums de configuración
  'Environment',
  // Enums que pueden venir de API externa
  'GameEventType',
]);

// Miembros protegidos específicos
const PROTECTED_MEMBERS = new Set([
  // Valores por defecto comunes
  'DEFAULT',
  'NONE',
  'UNKNOWN',
  // Valores que pueden estar en datos
  'IDLE',
  'READY',
]);

function getAllTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) return files;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', 'coverage', '.git'].includes(entry.name)) {
        files.push(...getAllTypeScriptFiles(fullPath));
      }
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function extractEnums(files: string[]): EnumInfo[] {
  const enums: EnumInfo[] = [];
  const enumRegex = /export\s+enum\s+(\w+)\s*\{([^}]+)\}/g;
  const memberRegex = /(\w+)\s*=\s*["']([^"']+)["']/g;

  for (const file of files) {
    // Solo archivos de constantes/enums
    if (!file.includes('/constants/') && !file.includes('/shared/')) continue;
    
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    
    let match;
    while ((match = enumRegex.exec(content)) !== null) {
      const enumName = match[1];
      const enumBody = match[2];
      const enumStart = content.substring(0, match.index).split('\n').length;
      const enumEnd = enumStart + enumBody.split('\n').length;
      
      const members: EnumMember[] = [];
      let memberMatch;
      const memberLines = enumBody.split('\n');
      
      while ((memberMatch = memberRegex.exec(enumBody)) !== null) {
        const memberName = memberMatch[1];
        const memberValue = memberMatch[2];
        // Encontrar línea del miembro
        const memberLineOffset = enumBody.substring(0, memberMatch.index).split('\n').length - 1;
        
        members.push({
          name: memberName,
          value: memberValue,
          line: enumStart + memberLineOffset,
        });
      }
      
      if (members.length > 0) {
        enums.push({
          name: enumName,
          file: path.relative(projectRoot, file),
          members,
          startLine: enumStart,
          endLine: enumEnd,
        });
      }
    }
  }

  return enums;
}

function findUsedMembers(files: string[], enums: EnumInfo[]): Set<string> {
  const usedMembers = new Set<string>();
  
  // Crear mapa de enum → miembros
  const enumMemberMap = new Map<string, string[]>();
  for (const enumInfo of enums) {
    enumMemberMap.set(enumInfo.name, enumInfo.members.map(m => m.name));
  }

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    
    for (const enumInfo of enums) {
      for (const member of enumInfo.members) {
        // Buscar uso como EnumName.MEMBER
        const usagePattern = new RegExp(`${enumInfo.name}\\.${member.name}\\b`, 'g');
        if (usagePattern.test(content)) {
          usedMembers.add(`${enumInfo.name}.${member.name}`);
        }
        
        // Buscar uso del valor literal (solo si es único)
        const valuePattern = new RegExp(`["']${member.value}["']`, 'g');
        if (valuePattern.test(content)) {
          usedMembers.add(`${enumInfo.name}.${member.name}`);
        }
      }
    }
  }

  return usedMembers;
}

function findUnusedMembers(enums: EnumInfo[], usedMembers: Set<string>): UnusedMember[] {
  const unused: UnusedMember[] = [];

  for (const enumInfo of enums) {
    // Saltar enums protegidos
    if (PROTECTED_ENUMS.has(enumInfo.name)) continue;
    
    for (const member of enumInfo.members) {
      const key = `${enumInfo.name}.${member.name}`;
      
      // Saltar miembros protegidos
      if (PROTECTED_MEMBERS.has(member.name)) continue;
      
      if (!usedMembers.has(key)) {
        unused.push({
          enumName: enumInfo.name,
          memberName: member.name,
          file: enumInfo.file,
          line: member.line,
        });
      }
    }
  }

  return unused;
}

function removeUnusedMembers(unusedMembers: UnusedMember[]): Map<string, string> {
  const fileChanges = new Map<string, string>();
  
  // Agrupar por archivo
  const byFile = new Map<string, UnusedMember[]>();
  for (const unused of unusedMembers) {
    const list = byFile.get(unused.file) || [];
    list.push(unused);
    byFile.set(unused.file, list);
  }

  for (const [relFile, members] of byFile) {
    const fullPath = path.join(projectRoot, relFile);
    let content = fs.readFileSync(fullPath, 'utf-8');
    
    for (const member of members) {
      // Patrón para eliminar línea del miembro
      const patterns = [
        // Con coma al final
        new RegExp(`\\s*${member.memberName}\\s*=\\s*["'][^"']+["'],?\\s*\\n`, 'g'),
        // Sin coma (último miembro)
        new RegExp(`\\s*${member.memberName}\\s*=\\s*["'][^"']+["']\\s*\\n`, 'g'),
      ];
      
      for (const pattern of patterns) {
        content = content.replace(pattern, '\n');
      }
    }
    
    // Limpiar comas dobles y líneas vacías múltiples
    content = content.replace(/,(\s*,)+/g, ',');
    content = content.replace(/,(\s*\})/g, '$1');
    content = content.replace(/\n{3,}/g, '\n\n');
    
    fileChanges.set(relFile, content);
  }

  return fileChanges;
}

async function main(): Promise<void> {
  console.log('🔍 Analizando miembros de enum no usados en el BACKEND...\n');
  
  if (!applyChanges) {
    console.log('ℹ️  Modo DRY-RUN: No se aplicarán cambios.');
    console.log('   Usa --apply para aplicar los cambios.\n');
  }

  // 1. Obtener archivos
  const srcFiles = getAllTypeScriptFiles(srcDir);
  const testFiles = getAllTypeScriptFiles(testsDir);
  const allFiles = [...srcFiles, ...testFiles];
  
  console.log(`📁 Archivos a analizar: ${allFiles.length}`);

  // 2. Extraer enums (solo de src/)
  const enums = extractEnums(srcFiles);
  console.log(`📚 Enums encontrados: ${enums.length}`);
  
  const totalMembers = enums.reduce((sum, e) => sum + e.members.length, 0);
  console.log(`📝 Total de miembros: ${totalMembers}`);

  // 3. Encontrar miembros usados
  const usedMembers = findUsedMembers(allFiles, enums);
  console.log(`✅ Miembros usados: ${usedMembers.size}`);

  // 4. Encontrar miembros no usados
  const unusedMembers = findUnusedMembers(enums, usedMembers);
  console.log(`❌ Miembros no usados: ${unusedMembers.length}\n`);

  if (unusedMembers.length === 0) {
    console.log('🎉 ¡No hay miembros de enum sin uso!');
    return;
  }

  // Agrupar por enum para mostrar
  const byEnum = new Map<string, UnusedMember[]>();
  for (const unused of unusedMembers) {
    const list = byEnum.get(unused.enumName) || [];
    list.push(unused);
    byEnum.set(unused.enumName, list);
  }

  console.log('📋 Miembros a eliminar:\n');
  for (const [enumName, members] of byEnum) {
    console.log(`   ${enumName}:`);
    for (const m of members) {
      console.log(`      - ${m.memberName} (línea ${m.line})`);
    }
  }

  if (!applyChanges) {
    console.log('\n⚠️  Ejecuta con --apply para eliminar estos miembros.');
    return;
  }

  // 5. Aplicar cambios
  console.log('\n🔧 Aplicando cambios...');
  const changes = removeUnusedMembers(unusedMembers);
  
  for (const [relFile, newContent] of changes) {
    const fullPath = path.join(projectRoot, relFile);
    fs.writeFileSync(fullPath, newContent, 'utf-8');
    console.log(`   ✅ ${relFile}`);
  }

  console.log('\n🎉 ¡Limpieza completada!');
  console.log('   Ejecuta "npm run build" para verificar.');
}

main().catch(console.error);
