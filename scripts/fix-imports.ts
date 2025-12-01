#!/usr/bin/env npx ts-node

import * as fs from 'fs';
import * as path from 'path';

const SYSTEMS_DIR = path.join(__dirname, '../src/domain/simulation/systems');

// Map of old paths to new paths
const pathMappings: Record<string, string> = {
  // From agents/ - need to go up one level for peer imports
  './InventorySystem': '../economy/InventorySystem',
  './SocialSystem': '../social/SocialSystem',
  './EnhancedCraftingSystem': '../economy/EnhancedCraftingSystem',
  './WorldResourceSystem': '../world/WorldResourceSystem',
  './HouseholdSystem': '../social/HouseholdSystem',
  './TaskSystem': '../objectives/TaskSystem',
  './CombatSystem': '../conflict/CombatSystem',
  './animals/AnimalSystem': '../world/animals/AnimalSystem',
  './TimeSystem': '../core/TimeSystem',
  './EconomySystem': '../economy/EconomySystem',
  './BuildingSystem': '../structures/BuildingSystem',
  './GovernanceSystem': '../structures/GovernanceSystem',
  './MarriageSystem': '../social/MarriageSystem',
  './ReputationSystem': '../social/ReputationSystem',
  './GenealogySystem': '../social/GenealogySystem',
  './ProductionSystem': '../world/ProductionSystem',
  './ItemGenerationSystem': '../world/ItemGenerationSystem',
  './RoleSystem': './RoleSystem', // Same folder
  './EquipmentSystem': './EquipmentSystem', // Same folder
  './AISystem': './AISystem', // Same folder
  './ConflictResolutionSystem': '../conflict/ConflictResolutionSystem',
  './LifeCycleSystem': '../lifecycle/LifeCycleSystem',
  './RecipeDiscoverySystem': '../economy/RecipeDiscoverySystem',
  './ResourceReservationSystem': '../economy/ResourceReservationSystem',
  './ChunkLoadingSystem': '../core/ChunkLoadingSystem',
  './TerrainSystem': '../core/TerrainSystem',
  './AmbientAwarenessSystem': './AmbientAwarenessSystem', // Same folder (agents)
  './needs/NeedsSystem': './needs/NeedsSystem', // Same parent (agents)
  './movement/MovementSystem': './movement/MovementSystem', // Same parent (agents)
  './ai/SharedKnowledgeSystem': './ai/SharedKnowledgeSystem', // Same parent (agents)
};

// For files that are deeper (like in agents/ai/core)
const deepPathMappings: Record<string, Record<string, string>> = {
  'agents/ai/core': {
    '../InventorySystem': '../../../economy/InventorySystem',
    '../SocialSystem': '../../../social/SocialSystem',
    '../EnhancedCraftingSystem': '../../../economy/EnhancedCraftingSystem',
    '../WorldResourceSystem': '../../../world/WorldResourceSystem',
    '../HouseholdSystem': '../../../social/HouseholdSystem',
    '../TaskSystem': '../../../objectives/TaskSystem',
    '../CombatSystem': '../../../conflict/CombatSystem',
    '../animals/AnimalSystem': '../../../world/animals/AnimalSystem',
    '../TimeSystem': '../../../core/TimeSystem',
    '../EconomySystem': '../../../economy/EconomySystem',
    '../BuildingSystem': '../../../structures/BuildingSystem',
    '../GovernanceSystem': '../../../structures/GovernanceSystem',
    '../MarriageSystem': '../../../social/MarriageSystem',
    '../ReputationSystem': '../../../social/ReputationSystem',
    '../GenealogySystem': '../../../social/GenealogySystem',
    '../ProductionSystem': '../../../world/ProductionSystem',
    '../ItemGenerationSystem': '../../../world/ItemGenerationSystem',
    '../RoleSystem': '../../RoleSystem',
    '../EquipmentSystem': '../../EquipmentSystem',
    '../AISystem': '../../AISystem',
    '../ConflictResolutionSystem': '../../../conflict/ConflictResolutionSystem',
    '../LifeCycleSystem': '../../../lifecycle/LifeCycleSystem',
    '../RecipeDiscoverySystem': '../../../economy/RecipeDiscoverySystem',
    '../ResourceReservationSystem': '../../../economy/ResourceReservationSystem',
    '../ChunkLoadingSystem': '../../../core/ChunkLoadingSystem',
    '../TerrainSystem': '../../../core/TerrainSystem',
    '../AmbientAwarenessSystem': '../../AmbientAwarenessSystem',
  }
};

function fixImportsInFile(filePath: string): number {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changeCount = 0;
  
  const relativePath = path.relative(SYSTEMS_DIR, filePath);
  const dirPath = path.dirname(relativePath);
  
  // Check if we need deep mappings
  const deepMappings = deepPathMappings[dirPath];
  const mappingsToUse = deepMappings || pathMappings;
  
  for (const [oldPath, newPath] of Object.entries(mappingsToUse)) {
    const regex = new RegExp(`from ['"]${oldPath.replace(/\//g, '\\/')}['"]`, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, `from '${newPath}'`);
      changeCount++;
    }
  }
  
  if (changeCount > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${changeCount} imports in ${relativePath}`);
  }
  
  return changeCount;
}

function walkDir(dir: string, callback: (filePath: string) => void) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (file.endsWith('.ts')) {
      callback(filePath);
    }
  }
}

let totalChanges = 0;
walkDir(SYSTEMS_DIR, (filePath) => {
  totalChanges += fixImportsInFile(filePath);
});

console.log(`\nTotal changes: ${totalChanges}`);
