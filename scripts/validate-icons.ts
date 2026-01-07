#!/usr/bin/env npx tsx
/**
 * Icon Validation Script
 *
 * This script validates that all icons registered in Icon.tsx exist as SVG files.
 * Run this as part of the build process to catch missing icon files early.
 *
 * Usage:
 *   npx tsx scripts/validate-icons.ts
 *   npm run validate:icons
 */

import * as fs from 'fs';
import * as path from 'path';

const ICON_FILE = path.join(__dirname, '../src/components/Icon.tsx');
const ICONS_DIR = path.join(__dirname, '../assets/icons');

// Extract icon paths from the ICON_REGISTRY in Icon.tsx
function extractIconPaths(): string[] {
  const content = fs.readFileSync(ICON_FILE, 'utf-8');

  // Find the ICON_REGISTRY object
  const registryMatch = content.match(/const ICON_REGISTRY\s*=\s*\{([\s\S]*?)\}\s*as\s*const/);
  if (!registryMatch) {
    console.error('Could not find ICON_REGISTRY in Icon.tsx');
    process.exit(1);
  }

  const registryContent = registryMatch[1];

  // Extract all icon paths (strings in quotes before the colon)
  const iconPaths: string[] = [];
  const pathRegex = /'([^']+)':/g;
  let match;
  while ((match = pathRegex.exec(registryContent)) !== null) {
    iconPaths.push(match[1]);
  }

  return iconPaths;
}

// Validate that each icon path exists as an SVG file
function validateIconPaths(iconPaths: string[]): { valid: string[]; missing: string[] } {
  const valid: string[] = [];
  const missing: string[] = [];

  for (const iconPath of iconPaths) {
    const svgPath = path.join(ICONS_DIR, `${iconPath}.svg`);
    if (fs.existsSync(svgPath)) {
      valid.push(iconPath);
    } else {
      missing.push(iconPath);
    }
  }

  return { valid, missing };
}

// Main
function main() {
  console.log('Validating icon registry...\n');

  const iconPaths = extractIconPaths();
  console.log(`Found ${iconPaths.length} icons in ICON_REGISTRY\n`);

  const { valid, missing } = validateIconPaths(iconPaths);

  if (missing.length === 0) {
    console.log(`✓ All ${valid.length} icons validated successfully!`);
    console.log('\nAll icon paths in ICON_REGISTRY have corresponding SVG files.');
    process.exit(0);
  } else {
    console.error(`✗ ${missing.length} icon(s) missing:\n`);
    for (const iconPath of missing) {
      const expectedPath = path.join(ICONS_DIR, `${iconPath}.svg`);
      console.error(`  - ${iconPath}`);
      console.error(`    Expected: ${expectedPath}`);
    }
    console.error('\nPlease ensure the SVG files exist or remove the icons from ICON_REGISTRY.');
    process.exit(1);
  }
}

main();
