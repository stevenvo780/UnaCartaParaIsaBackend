#!/usr/bin/env node

/**
 * Script para refactorizar strings literales a Enums basándose en el reporte de validación.
 * 
 * Funcionalidad:
 * 1. Lee el reporte JSON generado por validate-string-to-enum.ts
 * 2. Itera sobre las ocurrencias de "missingEnumUsages"
 * 3. Reemplaza el string literal por el miembro del Enum correspondiente.
 * 4. Añade la importación del Enum si es necesario.
 */

import * as fs from 'fs';
import * as path from 'path';

const projectRoot = process.cwd();
const __dirname = path.join(projectRoot, 'scripts');

// Ruta del reporte
const REPORT_PATH = path.join(__dirname, '../enum-validation-report.json');

interface EnumValue {
  name: string;
  values: string[];
  file: string;
}

interface Occurrence {
  file: string;
  line: number;
  lineContent: string;
}

interface MissingEnumUsage {
  stringLiteral: string;
  possibleEnums: string[];
  count: number;
  occurrences: Occurrence[];
}

interface Report {
  enums: EnumValue[];
  missingEnumUsages: MissingEnumUsage[];
}

// Mapa de EnumName -> FilePath (para importaciones)
const enumFileMap = new Map<string, string>();

/**
 * Carga el reporte y construye el mapa de archivos de enums
 */
function loadReport(): Report {
  if (!fs.existsSync(REPORT_PATH)) {
    console.error(`❌ No se encontró el reporte en: ${REPORT_PATH}`);
    console.error('   Ejecuta primero: npm run validate:enums');
    process.exit(1);
  }

  const report: Report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));

  console.log('📂 Escaneando archivos de Enums...');
  // Escanear Frontend PRIMERO
  scanForEnumFiles(path.join(__dirname, '../../UnaCartaParaIsa/src/constants'));
  // Escanear TODO el backend src para encontrar enums donde sea que estén (domain, shared, etc)
  scanForEnumFiles(path.join(__dirname, '../src'));
  console.log(`   Encontrados ${enumFileMap.size} Enums en el sistema.`);

  return report;
}

function scanForEnumFiles(dir: string) {
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      scanForEnumFiles(filePath);
    } else if (file.endsWith('.ts')) {
      const content = fs.readFileSync(filePath, 'utf8');
      const enumRegex = /export\s+enum\s+(\w+)/g;
      let match;
      while ((match = enumRegex.exec(content)) !== null) {
        enumFileMap.set(match[1], filePath);
      }
    }
  });
}

/**
 * Determina la ruta relativa para la importación
 */
function getRelativeImportPath(sourceFile: string, targetFile: string): string {
  let relativePath = path.relative(path.dirname(sourceFile), targetFile);

  // Quitar extensión .ts
  relativePath = relativePath.replace(/\.ts$/, '');

  // Asegurar que empiece con ./ o ../
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }

  return relativePath;
}

/**
 * Añade la importación al archivo si no existe
 */
function addImport(filePath: string, content: string, enumName: string): string {
  // Verificar si ya está importado
  if (new RegExp(`\\b${enumName}\\b`).test(content)) {
    // Verificar si está importado como valor
    if (new RegExp(`import\\s+.*\\b${enumName}\\b`).test(content)) {
      // Verificar si es "import type"
      const typeImportRegex = new RegExp(`import\\s+type\\s+.*\\b${enumName}\\b`);
      if (typeImportRegex.test(content)) {
        // Es un import type, necesitamos cambiarlo a import normal o añadir uno nuevo
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(`import type`) && lines[i].includes(enumName)) {
            lines[i] = lines[i].replace('import type', 'import');
            return lines.join('\n');
          }
        }
      }
      return content;
    }
  }

  const enumFilePath = enumFileMap.get(enumName);
  if (!enumFilePath) {
    console.warn(`⚠️  No se encontró la definición del Enum: ${enumName} para importar en ${path.basename(filePath)}`);
    return content;
  }

  const importPath = getRelativeImportPath(filePath, enumFilePath);
  const importStatement = `import { ${enumName} } from '${importPath}';`;

  const lines = content.split('\n');
  let lastImportLine = -1;
  let inImportBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Ignorar comentarios
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;

    if (inImportBlock) {
      // Si estamos en un bloque, buscamos el final (generalmente 'from ...;')
      if (line.includes('from') || line.endsWith(';')) {
        inImportBlock = false;
        lastImportLine = i;
      }
    } else {
      if (line.startsWith('import ')) {
        // Si es una línea simple (import ... from ...;)
        if ((line.includes('from') && line.endsWith(';')) || (line.endsWith(';') && !line.includes('{'))) {
          lastImportLine = i;
        } else {
          // Es un bloque multilinea
          inImportBlock = true;
          // Caso especial: import { A } from 'b'; (todo en una linea pero sin ; al final o algo raro)
          if (line.includes('from') && line.includes('}')) {
            inImportBlock = false;
            lastImportLine = i;
          }
        }
      }
    }
  }

  if (lastImportLine !== -1) {
    lines.splice(lastImportLine + 1, 0, importStatement);
  } else {
    // Si no hay imports, intentar ponerlo después de los comentarios iniciales (shebang, license)
    let insertIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#!') || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
        insertIdx = i + 1;
      } else if (line === '') {
        continue;
      } else {
        break;
      }
    }
    lines.splice(insertIdx, 0, importStatement);
  }

  return lines.join('\n');
}

/**
 * Encuentra el miembro del Enum que corresponde al valor
 */
function findEnumMember(enumName: string, value: string): string | null {
  const enumFilePath = enumFileMap.get(enumName);
  if (!enumFilePath) {
    // console.log(`DEBUG: No file found for enum ${enumName}`);
    return null;
  }

  const content = fs.readFileSync(enumFilePath, 'utf8');
  // Buscar el bloque del enum
  const enumRegex = new RegExp(`export\\s+enum\\s+${enumName}\\s*\\{([^}]+)\\}`, 's');
  const match = enumRegex.exec(content);
  if (!match) {
    // console.log(`DEBUG: Enum block not found for ${enumName} in ${enumFilePath}`);
    return null;
  }

  const body = match[1];
  // Buscar KEY = "value"
  // Mejorado: soporta comillas simples y dobles, y espacios flexibles
  const memberRegex = new RegExp(`([a-zA-Z0-9_]+)\\s*=\\s*["']${value}["']`);
  const memberMatch = memberRegex.exec(body);

  if (!memberMatch) {
    // console.log(`DEBUG: Member not found for value "${value}" in ${enumName}`);
    return null;
  }

  return memberMatch[1];
}

/**
 * Resuelve ambigüedades basándose en el contexto del archivo
 */
function resolveAmbiguity(possibleEnums: string[], filePath: string, stringLiteral: string): string | null {
  const fileName = path.basename(filePath).toLowerCase();
  const fileContent = fs.readFileSync(filePath, 'utf8');

  // 1. Preferir Enum ya importado
  for (const enumName of possibleEnums) {
    if (new RegExp(`import.*\\b${enumName}\\b`).test(fileContent)) {
      return enumName;
    }
  }

  // 2. Heurísticas por nombre de archivo
  if (possibleEnums.includes('ZoneType') && (fileName.includes('zone') || fileName.includes('building'))) return 'ZoneType';
  if (possibleEnums.includes('NeedType') && (fileName.includes('need') || fileName.includes('ai'))) return 'NeedType';
  if (possibleEnums.includes('BiomeType') && (fileName.includes('world') || fileName.includes('map') || fileName.includes('biome'))) return 'BiomeType';
  if (possibleEnums.includes('GoalType') && (fileName.includes('goal') || fileName.includes('ai') || fileName.includes('planner'))) return 'GoalType';

  // 3. Heurísticas específicas para colisiones comunes
  if (stringLiteral === 'idle') {
    if (fileName.includes('anim')) return 'ActionType'; // O AnimationState?
    if (fileName.includes('ai')) return 'GoalType';
  }

  return null;
}

/**
 * Función principal
 */
function main() {
  console.log('🚀 Iniciando refactorización inteligente...\n');

  const report = loadReport();
  const changesByFile = new Map<string, {
    original: string,
    replacements: { line: number, old: string, new: string }[],
    imports: Set<string>
  }>();

  let successCount = 0;
  let skipCount = 0;

  report.missingEnumUsages.forEach(usage => {
    if (usage.possibleEnums.length === 0) return;

    let targetEnum: string | null = usage.possibleEnums[0];

    if (usage.possibleEnums.length > 1) {
      // Intentar resolver ambigüedad para CADA ocurrencia, ya que puede variar por archivo
      // Pero aquí estamos iterando por "uso" (string literal), que agrupa ocurrencias.
      // Debemos dividir el procesamiento por ocurrencia si queremos ser precisos.
      targetEnum = null; // Marcar como ambiguo globalmente
    }

    usage.occurrences.forEach(occ => {
      const absPath = path.resolve(path.join(__dirname, '..'), occ.file);

      // Si era ambiguo globalmente, intentar resolver para este archivo específico
      let localTargetEnum = targetEnum;
      if (!localTargetEnum && usage.possibleEnums.length > 1) {
        localTargetEnum = resolveAmbiguity(usage.possibleEnums, absPath, usage.stringLiteral);
      }

      // Si sigue sin resolverse, usar el primero como fallback (arriesgado, mejor saltar)
      // O saltar
      if (!localTargetEnum) {
        // console.warn(`⚠️  Ambigüedad no resuelta para "${usage.stringLiteral}" en ${path.basename(absPath)}: [${usage.possibleEnums.join(', ')}]`);
        skipCount++;
        return;
      }

      const memberName = findEnumMember(localTargetEnum, usage.stringLiteral);
      if (!memberName) {
        // console.warn(`⚠️  No se encontró miembro para valor "${usage.stringLiteral}" en ${localTargetEnum}`);
        skipCount++;
        return;
      }

      const replacement = `${localTargetEnum}.${memberName}`;

      if (!changesByFile.has(absPath)) {
        changesByFile.set(absPath, {
          original: fs.readFileSync(absPath, 'utf8'),
          replacements: [],
          imports: new Set()
        });
      }

      const fileData = changesByFile.get(absPath)!;

      // Evitar duplicados
      const exists = fileData.replacements.some(r => r.line === occ.line && r.new === replacement);
      if (!exists) {
        fileData.replacements.push({
          line: occ.line,
          old: `'${usage.stringLiteral}'`,
          new: replacement
        });
        fileData.replacements.push({
          line: occ.line,
          old: `"${usage.stringLiteral}"`,
          new: replacement
        });

        fileData.imports.add(localTargetEnum);
        successCount++;
      }
    });
  });

  // Aplicar cambios
  console.log(`📝 Preparando cambios para ${changesByFile.size} archivos...`);
  console.log(`   ✅ Reemplazos planificados: ${successCount}`);
  console.log(`   ⚠️  Ocurrencias saltadas (ambigüedad/error): ${skipCount}\n`);

  changesByFile.forEach((data, filePath) => {
    let content = data.original;
    const lines = content.split('\n');
    let modified = false;

    data.replacements.forEach(rep => {
      const lineIdx = rep.line - 1;
      if (lineIdx >= 0 && lineIdx < lines.length) {
        // Usar replace global para la línea por si hay múltiples en la misma línea
        // Escapar comillas para el regex
        // const regex = new RegExp(rep.old, 'g'); 
        // Simple string replace solo reemplaza la primera, pero si iteramos...
        // Mejor usar split/join para reemplazar todas las ocurrencias en la línea
        if (lines[lineIdx].includes(rep.old.replace(/^'|'$/g, ""))) { // Check raw string content roughly
          // Actually, rep.old includes quotes.
          if (lines[lineIdx].includes(rep.old)) {
            lines[lineIdx] = lines[lineIdx].split(rep.old).join(rep.new);
            modified = true;
          }
        }
      }
    });

    if (modified) {
      content = lines.join('\n');

      // Añadir imports
      data.imports.forEach(enumName => {
        content = addImport(filePath, content, enumName);
      });

      fs.writeFileSync(filePath, content);
      console.log(`   ✅ Modificado: ${path.relative(projectRoot, filePath)}`);
    }
  });

  console.log('\n✨ Refactorización completada.');
}

main();
