#!/usr/bin/env tsx
/**
 * Phase 3: Fix remaining string literals in backend only
 * - water → ResourceType.WATER
 * - food → ResourceType.FOOD (remaining)
 * - wood → ResourceType.WOOD
 * - stone → ResourceType.STONE
 * - mystical → BiomeType.MYSTICAL
 * - work → ZoneType.WORK / GoalDomain.WORK context-aware
 * - storage → ZoneType.STORAGE / BuildingType.STORAGE
 * - market → ZoneType.MARKET
 * - none → ControlledEntity.NONE
 * - unarmed → EquipmentType.UNARMED / WeaponId.UNARMED
 * - wooden_club → WeaponId.WOODEN_CLUB
 *
 * This script is more intelligent:
 * 1. Checks existing imports before adding
 * 2. Handles context-based enum selection
 * 3. Only processes backend src/ files
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRY_RUN = process.argv.includes("--dry-run");
const BACKEND_SRC = path.resolve(__dirname, "../src");

interface ReplacementRule {
  pattern: RegExp;
  enumName: string;
  enumMember: string;
  importPath: string;
  contextCheck?: (line: string, fileContent: string) => boolean;
}

const rules: ReplacementRule[] = [
  // ResourceType replacements
  {
    pattern: /(['"])water\1/g,
    enumName: "ResourceType",
    enumMember: "ResourceType.WATER",
    importPath: "@/shared/constants/ResourceEnums",
    contextCheck: (line) =>
      !line.includes("AnimalTargetType") && !line.includes("TileType"),
  },
  {
    pattern: /(['"])wood\1/g,
    enumName: "ResourceType",
    enumMember: "ResourceType.WOOD",
    importPath: "@/shared/constants/ResourceEnums",
    contextCheck: (line) =>
      !line.includes("GatherableResource") && !line.includes("wooden"),
  },
  {
    pattern: /(['"])stone\1/g,
    enumName: "ResourceType",
    enumMember: "ResourceType.STONE",
    importPath: "@/shared/constants/ResourceEnums",
    contextCheck: (line) =>
      !line.includes("TileType") && !line.includes("stone_"),
  },
  {
    pattern: /(['"])food\1/g,
    enumName: "ZoneType",
    enumMember: "ZoneType.FOOD",
    importPath: "@/shared/constants/ZoneEnums",
    contextCheck: (line) =>
      // Only replace when it's clearly a zone type assignment, not a resource type
      ((line.includes("zoneType") || line.includes(": ZoneType") || 
        line.includes("biomeToZoneType") || /type:\s*ZoneType/.test(line)) &&
       !line.includes("resourceTypes") && !line.includes("resourceType")),
  },
  // BiomeType
  {
    pattern: /(['"])mystical\1/g,
    enumName: "BiomeType",
    enumMember: "BiomeType.MYSTICAL",
    importPath: "@/shared/constants/BiomeEnums",
  },
  // ZoneType - storage
  {
    pattern: /(['"])storage\1/g,
    enumName: "ZoneType",
    enumMember: "ZoneType.STORAGE",
    importPath: "@/shared/constants/ZoneEnums",
    contextCheck: (line, content) =>
      content.includes("zone") ||
      content.includes("Zone") ||
      line.includes("zone"),
  },
  // ZoneType - market
  {
    pattern: /(['"])market\1/g,
    enumName: "ZoneType",
    enumMember: "ZoneType.MARKET",
    importPath: "@/shared/constants/ZoneEnums",
    contextCheck: (line) => !line.includes("PanelName"),
  },
  // ZoneType - work
  {
    pattern: /(['"])work\1/g,
    enumName: "ZoneType",
    enumMember: "ZoneType.WORK",
    importPath: "@/shared/constants/ZoneEnums",
    contextCheck: (line, content) =>
      (line.includes("zone") || line.includes("Zone") || line.includes("biome") ||
       content.includes("biomeToZoneType") || content.includes("ZoneType")),
  },
  // ControlledEntity
  {
    pattern: /(['"])none\1/g,
    enumName: "ControlledEntity",
    enumMember: "ControlledEntity.NONE",
    importPath: "@/shared/constants/EntityEnums",
    contextCheck: (line) =>
      line.includes("controlled") ||
      line.includes("Controlled") ||
      line.includes("entity"),
  },
  // WeaponId - now in CraftingEnums
  {
    pattern: /(['"])unarmed\1/g,
    enumName: "WeaponId",
    enumMember: "WeaponId.UNARMED",
    importPath: "@/shared/constants/CraftingEnums",
    contextCheck: (line) =>
      line.includes("weapon") ||
      line.includes("Weapon") ||
      line.includes("equipment"),
  },
  {
    pattern: /(['"])wooden_club\1/g,
    enumName: "WeaponId",
    enumMember: "WeaponId.WOODEN_CLUB",
    importPath: "@/shared/constants/CraftingEnums",
  },
  // GoalType
  {
    pattern: /(['"])satisfy_need\1/g,
    enumName: "GoalType",
    enumMember: "GoalType.SATISFY_NEED",
    importPath: "@/shared/constants/AIEnums",
  },
  {
    pattern: /(['"])socialize\1/g,
    enumName: "ActionType",
    enumMember: "ActionType.SOCIALIZE",
    importPath: "@/shared/constants/AIEnums",
  },
  // PanelName
  {
    pattern: /(['"])world\1/g,
    enumName: "PanelName",
    enumMember: "PanelName.WORLD",
    importPath: "@/shared/constants/UIEnums",
    contextCheck: (line) =>
      line.includes("panel") ||
      line.includes("Panel") ||
      line.includes("tab"),
  },
  // DialogueSpeaker
  {
    pattern: /(['"])system\1/g,
    enumName: "DialogueSpeaker",
    enumMember: "DialogueSpeaker.SYSTEM",
    importPath: "@/shared/constants/DialogueEnums",
    contextCheck: (line) =>
      line.includes("speaker") ||
      line.includes("Speaker") ||
      line.includes("dialogue"),
  },
  // Energy as ZoneType
  {
    pattern: /(['"])energy\1/g,
    enumName: "ZoneType",
    enumMember: "ZoneType.ENERGY",
    importPath: "@/shared/constants/ZoneEnums",
    contextCheck: (line) =>
      line.includes("zone") ||
      line.includes("Zone") ||
      line.includes("zoneType"),
  },
  // GoalType construction
  {
    pattern: /(['"])construction\1/g,
    enumName: "GoalType",
    enumMember: "GoalType.CONSTRUCTION",
    importPath: "@/shared/constants/AIEnums",
    contextCheck: (line) =>
      line.includes("goal") ||
      line.includes("Goal") ||
      line.includes("type:"),
  },
  // DialogueOutcome neutral
  {
    pattern: /(['"])neutral\1/g,
    enumName: "DialogueOutcome",
    enumMember: "DialogueOutcome.NEUTRAL",
    importPath: "@/shared/constants/DialogueEnums",
    contextCheck: (line) =>
      line.includes("outcome") || line.includes("mood") || line.includes("tone"),
  },
];

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllTsFiles(fullPath));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !entry.name.endsWith(".d.ts") &&
      !entry.name.endsWith("Enums.ts") && // Skip enum definition files
      !entry.name.includes("PanelNames.ts") // Skip panel name definitions
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

function hasImport(content: string, enumName: string): boolean {
  const importRegex = new RegExp(
    `import\\s*{[^}]*\\b${enumName}\\b[^}]*}\\s*from`,
    "m"
  );
  return importRegex.test(content);
}

function addImport(
  content: string,
  enumName: string,
  importPath: string
): string {
  // Check if import from this path already exists
  const pathRegex = new RegExp(
    `(import\\s*{)([^}]*)(}\\s*from\\s*["']${importPath.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    )}["'])`,
    "m"
  );
  const pathMatch = content.match(pathRegex);

  if (pathMatch) {
    // Add to existing import
    const existingImports = pathMatch[2];
    if (!existingImports.includes(enumName)) {
      const newImports = existingImports.trim().endsWith(",")
        ? `${existingImports} ${enumName},`
        : `${existingImports}, ${enumName}`;
      return content.replace(
        pathRegex,
        `${pathMatch[1]}${newImports}${pathMatch[3]}`
      );
    }
    return content;
  }

  // Add new import after last import
  const lastImportMatch = content.match(/^import .+;?\s*$/gm);
  if (lastImportMatch) {
    const lastImport = lastImportMatch[lastImportMatch.length - 1];
    const insertPos = content.lastIndexOf(lastImport) + lastImport.length;
    const newImport = `\nimport { ${enumName} } from "${importPath}";`;
    return content.slice(0, insertPos) + newImport + content.slice(insertPos);
  }

  // No imports, add at beginning
  return `import { ${enumName} } from "${importPath}";\n\n${content}`;
}

interface FileChange {
  file: string;
  replacements: string[];
}

function processFile(filePath: string): FileChange | null {
  let content = fs.readFileSync(filePath, "utf-8");
  const originalContent = content;
  const replacements: string[] = [];
  const neededImports: Map<string, { enumName: string; importPath: string }> =
    new Map();

  for (const rule of rules) {
    const lines = content.split("\n");
    let newContent = "";
    let lineNum = 0;

    for (const line of lines) {
      lineNum++;
      let newLine = line;

      // Skip comments and docstrings
      const trimmed = line.trim();
      const isComment = trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
      
      if (!isComment && rule.pattern.test(line)) {
        // Reset regex lastIndex
        rule.pattern.lastIndex = 0;

        // Check context if needed
        const passesContext =
          !rule.contextCheck || rule.contextCheck(line, content);

        if (passesContext) {
          const originalLine = line;
          newLine = line.replace(rule.pattern, rule.enumMember);

          if (newLine !== originalLine) {
            replacements.push(
              `  L${lineNum}: ${rule.pattern.source} → ${rule.enumMember}`
            );
            neededImports.set(rule.enumName, {
              enumName: rule.enumName,
              importPath: rule.importPath,
            });
          }
        }
      }

      newContent += newLine + "\n";
    }

    content = newContent.slice(0, -1); // Remove trailing newline
  }

  // Add needed imports
  for (const { enumName, importPath } of neededImports.values()) {
    if (!hasImport(content, enumName)) {
      content = addImport(content, enumName, importPath);
      replacements.unshift(`  + import { ${enumName} } from "${importPath}"`);
    }
  }

  if (content !== originalContent) {
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, content, "utf-8");
    }
    return { file: filePath, replacements };
  }

  return null;
}

async function main(): Promise<void> {
  console.log(
    `\n🔧 Phase 3: Fixing remaining enum strings in backend${DRY_RUN ? " (DRY RUN)" : ""}\n`
  );

  const files = getAllTsFiles(BACKEND_SRC);
  console.log(`📁 Found ${files.length} TypeScript files\n`);

  const changes: FileChange[] = [];

  for (const file of files) {
    const change = processFile(file);
    if (change) {
      changes.push(change);
    }
  }

  if (changes.length === 0) {
    console.log("✅ No changes needed!\n");
    return;
  }

  console.log(`📝 ${DRY_RUN ? "Would modify" : "Modified"} ${changes.length} files:\n`);

  for (const change of changes) {
    const relativePath = path.relative(BACKEND_SRC, change.file);
    console.log(`\n📄 ${relativePath}`);
    for (const rep of change.replacements) {
      console.log(rep);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `${DRY_RUN ? "Would apply" : "Applied"} changes to ${changes.length} files`
  );
  if (DRY_RUN) {
    console.log("\nRun without --dry-run to apply changes");
  }
}

main().catch(console.error);
