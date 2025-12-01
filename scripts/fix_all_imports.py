#!/usr/bin/env python3
"""
Fix imports after moving files to subdirectories in systems/
"""
import os
import re
from pathlib import Path

SYSTEMS_DIR = Path("/datos/repos/Personal/UnaCartaParaIsaBackend/src/domain/simulation/systems")

# Folders that are ONE level deeper (files moved from systems/ to systems/X/)
SUBFOLDERS = ['agents', 'world', 'social', 'economy', 'conflict', 'structures', 'lifecycle', 'objectives', 'core']

# Cross-system imports that need to be updated
# Key: old import path (from root systems/), Value: new path
SYSTEM_RELOCATIONS = {
    # To economy/
    'InventorySystem': 'economy/InventorySystem',
    'EconomySystem': 'economy/EconomySystem',
    'EnhancedCraftingSystem': 'economy/EnhancedCraftingSystem',
    'RecipeDiscoverySystem': 'economy/RecipeDiscoverySystem',
    'ResourceReservationSystem': 'economy/ResourceReservationSystem',
    # To social/
    'SocialSystem': 'social/SocialSystem',
    'MarriageSystem': 'social/MarriageSystem',
    'HouseholdSystem': 'social/HouseholdSystem',
    'ReputationSystem': 'social/ReputationSystem',
    'GenealogySystem': 'social/GenealogySystem',
    # To world/
    'WorldResourceSystem': 'world/WorldResourceSystem',
    'ItemGenerationSystem': 'world/ItemGenerationSystem',
    'ProductionSystem': 'world/ProductionSystem',
    # To conflict/
    'CombatSystem': 'conflict/CombatSystem',
    'ConflictResolutionSystem': 'conflict/ConflictResolutionSystem',
    # To structures/
    'BuildingSystem': 'structures/BuildingSystem',
    'GovernanceSystem': 'structures/GovernanceSystem',
    # To lifecycle/
    'LifeCycleSystem': 'lifecycle/LifeCycleSystem',
    # To objectives/
    'TaskSystem': 'objectives/TaskSystem',
    # To core/
    'TimeSystem': 'core/TimeSystem',
    'ChunkLoadingSystem': 'core/ChunkLoadingSystem',
    'TerrainSystem': 'core/TerrainSystem',
    # To agents/
    'AISystem': 'agents/AISystem',
    'RoleSystem': 'agents/RoleSystem',
    'EquipmentSystem': 'agents/EquipmentSystem',
    'AmbientAwarenessSystem': 'agents/AmbientAwarenessSystem',
    # Nested in agents/
    'NeedsSystem': 'agents/needs/NeedsSystem',
    'NeedsBatchProcessor': 'agents/needs/NeedsBatchProcessor',
    'MovementSystem': 'agents/movement/MovementSystem',
    'MovementBatchProcessor': 'agents/movement/MovementBatchProcessor',
    'SharedKnowledgeSystem': 'agents/ai/SharedKnowledgeSystem',
    # Nested in world/
    'AnimalSystem': 'world/animals/AnimalSystem',
    'AnimalBatchProcessor': 'world/animals/AnimalBatchProcessor',
    'AnimalBehavior': 'world/animals/AnimalBehavior',
}

def get_depth(filepath: Path) -> int:
    """Get how many levels deep the file is from systems/"""
    rel = filepath.relative_to(SYSTEMS_DIR)
    return len(rel.parts) - 1  # -1 for the filename itself

def fix_external_imports(content: str, depth: int) -> str:
    """Fix imports that go outside systems/ (to types/, shared/, core/, etc.)"""
    
    # Calculate how many ../ we need to get out of systems/
    # depth 1 (systems/agents/X.ts) needs 3 ../ to get to src/domain/simulation/
    # depth 2 (systems/agents/ai/X.ts) needs 4 ../
    # etc.
    
    # Patterns for different external paths
    patterns = [
        # ../../types -> add depth ../'s
        (r"from ['\"](\.\./){2}types/", f"from '{'../' * (depth + 2)}types/"),
        # ../../world -> add depth ../'s  
        (r"from ['\"](\.\./){2}world/", f"from '{'../' * (depth + 2)}world/"),
        # ../../../shared -> add depth ../'s
        (r"from ['\"](\.\./){3}shared/", f"from '{'../' * (depth + 3)}shared/"),
        # ../../../infrastructure -> add depth ../'s
        (r"from ['\"](\.\./){3}infrastructure/", f"from '{'../' * (depth + 3)}infrastructure/"),
        # ../../../config -> add depth ../'s
        (r"from ['\"](\.\./){3}config/", f"from '{'../' * (depth + 3)}config/"),
        # ../core/ (simulation core, not systems/core)
        (r"from ['\"]\.\./(core/(?!TimeSystem|ChunkLoadingSystem|TerrainSystem))", f"from '{'../' * (depth + 1)}\\1"),
    ]
    
    for pattern, replacement in patterns:
        content = re.sub(pattern, replacement.replace("'", '"'), content)
        content = re.sub(pattern.replace('[\'"]', "'"), replacement, content)
    
    return content

def fix_cross_system_imports(content: str, current_folder: str, depth: int) -> str:
    """Fix imports between systems that have been relocated"""
    
    for system_name, new_location in SYSTEM_RELOCATIONS.items():
        new_folder = new_location.split('/')[0]
        
        # Pattern: from './SystemName' or from "../SystemName" etc.
        patterns = [
            # ./SystemName (same folder previously)
            (rf"from ['\"]\./({system_name})['\"]", new_folder, new_location),
            # ../SystemName (one up)
            (rf"from ['\"]\.\./{system_name}['\"]", new_folder, new_location),
            # ./subfolder/SystemName
            (rf"from ['\"]\./([\w/]+/)?{system_name}['\"]", new_folder, new_location),
        ]
        
        for pattern, target_folder, target_path in patterns:
            if re.search(pattern, content):
                # Calculate relative path from current file to target
                if current_folder == target_folder:
                    # Same folder
                    rel_path = f"./{system_name}"
                else:
                    # Different folder - need to go up and then down
                    ups = '../' * depth
                    rel_path = f"{ups}{target_path}"
                
                content = re.sub(pattern, f'from "{rel_path}"', content)
    
    return content

def fix_file(filepath: Path):
    """Fix imports in a single file"""
    content = filepath.read_text()
    original = content
    
    rel_path = filepath.relative_to(SYSTEMS_DIR)
    parts = rel_path.parts
    
    if len(parts) < 2:
        return 0  # File at root of systems/
    
    current_folder = parts[0]
    depth = len(parts) - 1
    
    # Fix external imports (types/, shared/, etc.)
    content = fix_external_imports(content, depth)
    
    # Fix cross-system imports
    content = fix_cross_system_imports(content, current_folder, depth)
    
    if content != original:
        filepath.write_text(content)
        return 1
    return 0

def main():
    total_fixed = 0
    
    for subfolder in SUBFOLDERS:
        folder_path = SYSTEMS_DIR / subfolder
        if not folder_path.exists():
            continue
            
        for ts_file in folder_path.rglob("*.ts"):
            fixed = fix_file(ts_file)
            if fixed:
                print(f"Fixed: {ts_file.relative_to(SYSTEMS_DIR)}")
                total_fixed += 1
    
    print(f"\nTotal files fixed: {total_fixed}")

if __name__ == "__main__":
    main()
