#!/usr/bin/env node
/**
 * GeomorphForge - Thumbnail Generator
 * Reads tile-manifest.json and generates 150px WebP thumbnails
 * for all tiles into public/thumbnails/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_FILE = path.join(__dirname, '..', 'public', 'tile-manifest.json');
const GEOMORPHS_ROOT = path.join(__dirname, '..');  // tiles are at root/Geomorphs/...
const THUMBNAILS_DIR = path.join(__dirname, '..', 'public', 'thumbnails');
const THUMBNAIL_MAX_WIDTH = 150;
const THUMBNAIL_MAX_HEIGHT = 150;
const CONCURRENCY = 8; // parallel thumbnail generations

async function generateThumbnail(tile) {
  const sourcePath = path.join(GEOMORPHS_ROOT, tile.path);
  const thumbPath = path.join(path.dirname(MANIFEST_FILE), tile.thumbnail);

  // Ensure directory exists
  fs.mkdirSync(path.dirname(thumbPath), { recursive: true });

  // Skip if thumbnail already exists and source is older
  if (fs.existsSync(thumbPath)) {
    const thumbStat = fs.statSync(thumbPath);
    const sourceStat = fs.statSync(sourcePath);
    if (thumbStat.mtimeMs > sourceStat.mtimeMs) {
      return 'skipped';
    }
  }

  try {
    await sharp(sourcePath)
      .resize(THUMBNAIL_MAX_WIDTH, THUMBNAIL_MAX_HEIGHT, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toFile(thumbPath);
    return 'generated';
  } catch (err) {
    console.error(`  ⚠️  Failed: ${tile.path} — ${err.message}`);
    return 'failed';
  }
}

async function runBatch(tiles) {
  const results = { generated: 0, skipped: 0, failed: 0 };

  // Process in batches of CONCURRENCY
  for (let i = 0; i < tiles.length; i += CONCURRENCY) {
    const batch = tiles.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(generateThumbnail));
    for (const r of batchResults) results[r]++;

    if ((i + CONCURRENCY) % 200 === 0 || i + CONCURRENCY >= tiles.length) {
      const done = Math.min(i + CONCURRENCY, tiles.length);
      const pct = Math.round((done / tiles.length) * 100);
      process.stdout.write(`\r  Progress: ${done}/${tiles.length} (${pct}%)   `);
    }
  }
  return results;
}

async function main() {
  if (!fs.existsSync(MANIFEST_FILE)) {
    console.error(`❌ Manifest not found. Run generate-manifest.js first.`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
  console.log(`🖼️  Generating thumbnails for ${manifest.totalTiles} tiles...`);
  console.log(`   Output: ${THUMBNAILS_DIR}`);
  console.log(`   Max size: ${THUMBNAIL_MAX_WIDTH}×${THUMBNAIL_MAX_HEIGHT}px WebP`);

  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });

  const results = await runBatch(manifest.tiles);

  console.log(`\n✅ Done!`);
  console.log(`   Generated: ${results.generated}`);
  console.log(`   Skipped (up-to-date): ${results.skipped}`);
  console.log(`   Failed: ${results.failed}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
