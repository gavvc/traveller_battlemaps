#!/usr/bin/env node
/**
 * GeomorphForge - Tile Manifest Generator
 * Recursively scans the Geomorphs folder and produces public/tile-manifest.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GEOMORPHS_ROOT = path.join(__dirname, '..', 'public', 'Geomorphs');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'tile-manifest.json');

// Collections to skip (PSD-only, no usable PNG tiles)
const SKIP_COLLECTIONS = ['GeomorphsStarships2', 'GeomorphsStarships3'];

/**
 * Parse a tile filename to extract all available metadata.
 *
 * Examples:
 *   "HG-001 [100x50] [100-dTons] Cargo Bay - Empty.png"
 *   "501 [50x50] Fuel Deck (Intake Scoop).png"
 *   "101 [100x100] [Overlay] Escape Pod.png"
 *   "E101 [100x100] Tractor Beam Control.png"
 *   "HG-004 [100x50] [Overlay] 20-dTon Launches and Cargo.png"
 */

// Room/function keywords to detect in tile names
const ROOM_KEYWORDS = [
  'Bridge', 'Engineering', 'Cargo', 'Fuel', 'Hangar', 'Medical', 'Stateroom',
  'Lounge', 'Galley', 'Lab', 'Laboratory', 'Office', 'Brig', 'Barracks',
  'Airlock', 'Airlocks', 'Turret', 'Weapons', 'Sensors', 'Prison',
  'Robotics', 'Arboretum', 'Workshop', 'Briefing', 'Library', 'Gym',
  'Surgery', 'Escape Pod', 'Launch Bay', 'Repair', 'Security',
];

// Banded dTon ranges for UI filter groupings
function dtonBand(dt) {
  if (dt === null) return null;
  if (dt <= 10)  return '1–10 dT';
  if (dt <= 25)  return '11–25 dT';
  if (dt <= 50)  return '26–50 dT';
  if (dt <= 100) return '51–100 dT';
  if (dt <= 200) return '101–200 dT';
  return '200+ dT';
}

function parseTileFilename(filename) {
  const base = path.basename(filename, '.png');

  // ── Grid size ───────────────────────────────────────────────────────────────
  const gridSizeMatch = base.match(/\[(\d+)x(\d+)\]/);
  const gridSize = gridSizeMatch
    ? [parseInt(gridSizeMatch[1]), parseInt(gridSizeMatch[2])]
    : null;

  // ── Flags ───────────────────────────────────────────────────────────────────
  const isOverlay = /\[Overlay\]/i.test(base);
  const isMirror  = /\[Mirror\]/i.test(base);

  // ── Orientation / deck position ─────────────────────────────────────────────
  const orientationMatch = base.match(/\[(Fore|Aft|Port|Starboard)\]/i);
  const orientation = orientationMatch ? orientationMatch[1] : null;

  // ── dTon displacement ───────────────────────────────────────────────────────
  // Handles: [100-dTons], [12+6-dTons], [26 or 34-dTons], [16+36 or 16+117-dTons]
  const dtonMatch = base.match(/\[([0-9+\s\w]+?)-dTons?\]/i);
  let dtons = null;          // primary value (integer)
  let dtonsSecondary = null; // secondary/optional value
  let dtonsRaw = null;       // raw string for display

  if (dtonMatch) {
    dtonsRaw = dtonMatch[1].trim();
    // Extract all numbers
    const nums = dtonsRaw.match(/\d+/g)?.map(Number) ?? [];
    if (nums.length >= 1) dtons = nums[0];
    if (nums.length >= 2) dtonsSecondary = nums[1];
  }

  // ── Series prefix ───────────────────────────────────────────────────────────
  // e.g. "HG-001", "E101", "VC09", "TR-04", "AF-05"
  const prefixMatch = base.match(/^([A-Z]{1,3}-?\d*)\s/);
  const seriesCode = prefixMatch ? prefixMatch[1].replace(/-?\d+$/, '') : null;

  // ── Tile number ─────────────────────────────────────────────────────────────
  const tileNumMatch = base.match(/^[A-Z-]*(\d+)/);
  const tileNumber = tileNumMatch ? parseInt(tileNumMatch[1]) : null;

  // ── Clean name ──────────────────────────────────────────────────────────────
  let name = base
    .replace(/^[A-Z]{0,3}-?\d+\s*/,'')          // leading code + number
    .replace(/\[\d+x\d+\]\s*/g, '')              // [WxH]
    .replace(/\[\d[^\]]*-dTons?\]\s*/gi, '')     // [N-dTons]
    .replace(/\[Overlay\]\s*/gi, '')
    .replace(/\[Mirror\]\s*/gi, '')
    .replace(/\[(Fore|Aft|Port|Starboard)\]\s*/gi, '')
    .replace(/\(\d+\)\s*/g, '')                  // variant markers (1), (2)
    .trim();

  // ── Room/function tags ──────────────────────────────────────────────────────
  const rooms = ROOM_KEYWORDS.filter(r =>
    new RegExp(`\\b${r}`, 'i').test(base)
  ).map(r => r.toLowerCase());

  // ── Search tags ─────────────────────────────────────────────────────────────
  const tags = [
    ...name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2),
    ...rooms,
    ...(orientation ? [orientation.toLowerCase()] : []),
    ...(seriesCode ? [seriesCode.toLowerCase()] : []),
    ...(dtons !== null ? [`${dtons}dt`] : []),
  ].filter((v, i, a) => a.indexOf(v) === i); // dedupe

  return {
    gridSize,
    isOverlay,
    isMirror,
    orientation,
    dtons,
    dtonsSecondary,
    dtonsRaw,
    dtonBand: dtonBand(dtons),
    tileNumber,
    name,
    rooms,
    seriesCode,
    tags,
  };
}

/**
 * Generate a stable slug ID from a file path.
 */
function pathToId(relPath) {
  return relPath
    .replace(/\.png$/i, '')
    .replace(/[^a-zA-Z0-9/]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/**
 * Generate thumbnail filename from relative path.
 * Flattens the path into a single filename with __ separators.
 */
function pathToThumbnail(relPath) {
  const slug = relPath
    .replace(/\.png$/i, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
  return `thumbnails/${slug}.webp`;
}

/**
 * Recursively walk a directory, collecting PNG files.
 */
function walkDir(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, results);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      results.push(fullPath);
    }
  }
  return results;
}

function main() {
  console.log('🔍 Scanning Geomorphs directory...');

  if (!fs.existsSync(GEOMORPHS_ROOT)) {
    console.error(`❌ Geomorphs directory not found: ${GEOMORPHS_ROOT}`);
    process.exit(1);
  }

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

  const tiles = [];
  let skipped = 0;

  // Top-level collection folders
  const collections = fs.readdirSync(GEOMORPHS_ROOT, { withFileTypes: true })
    .filter(e => e.isDirectory() && !SKIP_COLLECTIONS.includes(e.name));

  for (const collection of collections) {
    const collectionPath = path.join(GEOMORPHS_ROOT, collection.name);
    const allFiles = walkDir(collectionPath);

    for (const fullPath of allFiles) {
      const relPath = path.relative(path.join(GEOMORPHS_ROOT, '..'), fullPath)
        .replace(/\\/g, '/'); // normalize Windows paths

      const filename = path.basename(fullPath);
      const dirPath = path.dirname(fullPath);
      const dirRelPath = path.relative(collectionPath, dirPath).replace(/\\/g, '/');

      // Determine category from the immediate subfolder chain
      const pathParts = dirRelPath.split('/').filter(Boolean);
      // For CustomTiles: first part is "Custom Tiles" or "Symbols", second is category
      // For others: first part is category
      let category = pathParts[pathParts.length - 1] || collection.name;

      // Detect if this tile comes from a Symbols folder
      const isSymbol = fullPath.includes('/Symbols/') || fullPath.includes('\\Symbols\\');

      const parsed = parseTileFilename(filename);

      // Skip files with no grid size (e.g. readme PNGs, Symbols & Abbreviations.png)
      if (!parsed.gridSize && !isSymbol) {
        skipped++;
        continue;
      }

      const id = pathToId(relPath);
      const thumbnail = pathToThumbnail(relPath);

      tiles.push({
        id,
        filename,
        path: relPath,
        thumbnail,
        collection: collection.name,
        category,
        gridSize: parsed.gridSize,
        tileNumber: parsed.tileNumber,
        name: parsed.name || filename.replace('.png', ''),
        tags: parsed.tags,
        isOverlay: parsed.isOverlay,
        isMirror: parsed.isMirror,
        isSymbol,
        // Enriched metadata
        dtons: parsed.dtons,
        dtonsSecondary: parsed.dtonsSecondary,
        dtonsRaw: parsed.dtonsRaw,
        dtonBand: parsed.dtonBand,
        orientation: parsed.orientation,
        rooms: parsed.rooms,
        seriesCode: parsed.seriesCode,
      });
    }
  }

  // Sort: by collection, then category, then tile number, then name
  tiles.sort((a, b) => {
    if (a.collection !== b.collection) return a.collection.localeCompare(b.collection);
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.tileNumber !== b.tileNumber) return (a.tileNumber ?? 9999) - (b.tileNumber ?? 9999);
    return a.name.localeCompare(b.name);
  });

  const manifest = {
    version: 1,
    generated: new Date().toISOString(),
    totalTiles: tiles.length,
    tiles,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));

  console.log(`✅ Manifest written to ${OUTPUT_FILE}`);
  console.log(`   Total tiles: ${tiles.length}`);
  console.log(`   Skipped:     ${skipped}`);

  // Print breakdown by collection
  const byCollection = {};
  for (const t of tiles) {
    byCollection[t.collection] = (byCollection[t.collection] || 0) + 1;
  }
  for (const [col, count] of Object.entries(byCollection)) {
    console.log(`   ${col}: ${count}`);
  }
}

main();
