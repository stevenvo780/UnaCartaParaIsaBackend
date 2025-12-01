#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

const projectRoot = process.cwd();
const __dirname = path.join(projectRoot, 'scripts');

const BACKEND_SRC = path.join(__dirname, '../src');
const BACKEND_CONSTANTS = path.join(__dirname, '../src/shared/constants');
const FRONTEND_CONSTANTS = path.join(__dirname, '../../UnaCartaParaIsa/src/constants');

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

function getEnumsInFile(filePath: string): Set<string> {
  const enums = new Set<string>();
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const enumRegex = /export\s+enum\s+(\w+)/g;
    let match;
    while ((match = enumRegex.exec(content)) !== null) {
      enums.add(match[1]);
    }
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e);
  }
  return enums;
}

function main() {
  console.log('🔄 Sincronizando Enums del Frontend al Backend (Sin Duplicados)...');

  // 1. Mapear TODOS los enums existentes en el backend
  const backendEnums = new Map<string, string>(); // EnumName -> FilePath
  const allBackendFiles = getAllFiles(BACKEND_SRC);

  allBackendFiles.forEach(file => {
    // Ignorar node_modules y dist por si acaso, aunque getAllFiles usa BACKEND_SRC
    if (file.includes('node_modules') || file.includes('/dist/')) return;

    const enums = getEnumsInFile(file);
    enums.forEach(enumName => {
      if (backendEnums.has(enumName)) {
        // console.warn(`⚠️  Enum duplicado encontrado en backend: ${enumName} en ${path.basename(file)} y ${path.basename(backendEnums.get(enumName)!)}`);
      } else {
        backendEnums.set(enumName, file);
      }
    });
  });

  console.log(`   Backend tiene ${backendEnums.size} Enums únicos.`);

  // 2. Escanear Frontend
  const frontendFiles = getAllFiles(FRONTEND_CONSTANTS);
  let copiedCount = 0;
  let skippedCount = 0;

  frontendFiles.forEach(filePath => {
    const enums = getEnumsInFile(filePath);
    // Si el archivo tiene enums que NO existen en backend, lo copiamos.
    // Pero ojo: un archivo puede tener múltiples enums.
    // Si ALGUN enum ya existe, no deberíamos sobrescribir el archivo ciegamente.
    // Estrategia segura: Solo copiar si NINGUNO de los enums del archivo existe en backend.

    const missingEnums = Array.from(enums).filter(e => !backendEnums.has(e));

    if (missingEnums.length > 0) {
      if (missingEnums.length < enums.size) {
        console.warn(`⚠️  Archivo ${path.basename(filePath)} tiene mezcla de enums nuevos y existentes. Saltando para evitar conflictos.`);
        return;
      }

      // Todos son nuevos, copiamos el archivo
      // Usamos el nombre del archivo original
      const fileName = path.basename(filePath);

      // Verificar si ya existe un archivo con ese nombre en shared/constants (aunque tenga otros enums)
      const destPath = path.join(BACKEND_CONSTANTS, fileName);

      if (fs.existsSync(destPath)) {
        // El archivo existe, pero según nuestro mapa, no contiene los enums que buscamos (o ya los tendría mapeados).
        // Si existe, mejor no tocarlo.
        console.warn(`⚠️  El archivo destino ${fileName} ya existe pero no contiene los enums. Saltando.`);
        return;
      }

      console.log(`   ➕ Copiando ${fileName} (${missingEnums.join(', ')})`);
      fs.copyFileSync(filePath, destPath);
      copiedCount++;

      // Actualizar mapa en memoria
      missingEnums.forEach(e => backendEnums.set(e, destPath));
    } else {
      skippedCount++;
    }
  });

  console.log(`\n✅ Se copiaron ${copiedCount} archivos nuevos.`);
  console.log(`ℹ️  Se saltaron ${skippedCount} archivos porque sus enums ya existen.`);

  // 3. Limpieza de duplicados (Opcional/Manual)
  // Si detectamos que acabamos de crear archivos que colisionan, podríamos borrarlos.
  // Por ahora, confiamos en que la lógica de arriba previene la creación de duplicados.
  // Pero si ya existen del paso anterior...

  // Vamos a verificar si hay archivos en shared/constants que definen enums que TAMBIÉN están definidos en otros lugares del backend (fuera de shared/constants).
  console.log('\n🧹 Verificando duplicados existentes...');

  const constantsFiles = getAllFiles(BACKEND_CONSTANTS);
  constantsFiles.forEach(file => {
    const enums = getEnumsInFile(file);
    enums.forEach(enumName => {
      const existingPath = backendEnums.get(enumName);
      if (existingPath && existingPath !== file) {
        // Conflicto!
        console.warn(`🚨 CONFLICTO: Enum ${enumName} definido en:`);
        console.warn(`   1. ${path.relative(projectRoot, file)} (Posible duplicado)`);
        console.warn(`   2. ${path.relative(projectRoot, existingPath)} (Original)`);

        // Si el contenido es idéntico, borramos el de constants.
        try {
          const content1 = fs.readFileSync(file, 'utf8');
          const content2 = fs.readFileSync(existingPath, 'utf8');
          // Normalizar espacios para comparar
          if (content1.replace(/\s/g, '') === content2.replace(/\s/g, '')) {
            console.log(`   🗑️  Borrando duplicado idéntico: ${path.relative(projectRoot, file)}`);
            fs.unlinkSync(file);
          }
        } catch (e) { }
      }
    });
  });
}

main();
