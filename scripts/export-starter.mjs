import {lstat, readFile, mkdir, writeFile, realpath, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {inspectFile} from './audit.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const reviewKeys = ['reviewedEditionFiles', 'reviewedSiteAssets', 'reviewedHistoricalFiles', 'reviewedFontFiles', 'reviewedIconFiles'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const within = (parent, child) => child === parent || child.startsWith(parent + path.sep);

function validateInventory(manifest) {
  const files = manifest.starterFiles;
  if (!Array.isArray(files) || !files.length || !Array.isArray(manifest.files)) throw Error('Missing starter/publication inventory.');
  const seen = new Set();
  for (const file of files) {
    if (typeof file !== 'string' || !file.split('/').every(part => /^[A-Za-z0-9_.-]+$/.test(part) && part !== '.' && part !== '..') ||
        file.split('/').some(part => part.startsWith('.') && !['.github', '.gitignore', '.vercelignore'].includes(part)) ||
        /^(?:examples|showcase|dist|node_modules|test-results|private|books|source|annotations)(?:\/|$)/i.test(file)) {
      throw Error('Unsafe or optional starter path: ' + file);
    }
    const key = file.toLowerCase();
    if (seen.has(key)) throw Error('Duplicate or case-colliding starter path: ' + file);
    seen.add(key);
    if (!manifest.files.includes(file)) throw Error('Starter path is outside publication inventory: ' + file);
  }
  for (const file of files) {
    const parts = file.split('/');
    while (parts.length > 1) {
      parts.pop();
      if (seen.has(parts.join('/').toLowerCase())) throw Error('File/directory collision in starter inventory: ' + file);
    }
  }
  for (const required of ['publication.json', 'samples/library.json']) {
    if (!files.includes(required)) throw Error('Required starter file missing from inventory: ' + required);
  }
  return files;
}

async function readRegular(source, file) {
  let current = source;
  const parts = file.split('/');
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || (i === parts.length - 1 ? !stat.isFile() : !stat.isDirectory())) {
      throw Error('Starter input must be regular files and directories, without symlinks: ' + file);
    }
  }
  return readFile(current);
}

// Reads the checkout's current files, not Git objects. Also works in an extracted
// archive or a previous export, without inheriting a repository or its history.
export async function exportStarter({source = root, destination} = {}) {
  if (typeof destination !== 'string' || !destination.trim()) throw Error('Name an explicit new destination directory.');
  const sourcePath = path.resolve(source);
  if (!(await lstat(sourcePath)).isDirectory()) throw Error('Source must be a directory, not a symlink.');
  const sourceRoot = await realpath(sourcePath);
  const target = path.resolve(destination);
  const parent = path.dirname(target);
  if (!(await lstat(parent)).isDirectory()) throw Error('Destination parent must already exist and must not be a symlink.');
  const finalTarget = path.join(await realpath(parent), path.basename(target));
  if (within(sourceRoot, finalTarget)) throw Error('Destination must be outside the source directory.');
  try {
    await lstat(finalTarget);
    throw Error('Destination already exists; choose a new directory.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }

  const manifestBytes = await readRegular(sourceRoot, 'publication.json');
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const files = validateInventory(manifest);
  const included = new Set(files);
  const projected = {...manifest, files: [...files], starterFiles: [...files]};
  for (const key of reviewKeys) {
    if (manifest[key] !== undefined && !Array.isArray(manifest[key])) throw Error('Invalid provenance list: ' + key);
    projected[key] = (manifest[key] || []).filter(entry => entry && included.has(entry.path));
    for (const entry of projected[key]) {
      if (!/^[a-f0-9]{64}$/.test(entry.sha256) || typeof entry.reason !== 'string' || !entry.reason.trim()) throw Error('Invalid included asset pin: ' + entry.path);
      for (const field of ['provenance', 'license']) {
        if ((field in entry && !included.has(entry[field])) || (field === 'provenance' && key !== 'reviewedHistoricalFiles' && !(field in entry))) {
          throw Error('Included asset has excluded ' + field + ': ' + entry.path);
        }
      }
    }
  }

  // Preflight every byte before creating even the destination directory.
  const contents = new Map();
  for (const file of files) contents.set(file, file === 'publication.json' ? manifestBytes : await readRegular(sourceRoot, file));
  if (digest(contents.get('samples/library.json')) !== manifest.originalSampleSha256) throw Error('Original sample bytes differ from their reviewed hash.');
  for (const key of reviewKeys.filter(key => key !== 'reviewedHistoricalFiles')) {
    // A checkout's provenance also admits exact reachable historical versions.
    // A history-free export carries only pins matching its current file bytes.
    const current = new Map([...new Set(projected[key].map(entry => entry.path))].map(file => [file, digest(contents.get(file))]));
    const matching = projected[key].filter(entry => current.get(entry.path) === entry.sha256);
    for (const file of current.keys()) {
      if (!matching.some(entry => entry.path === file)) throw Error('Included asset differs from its reviewed hash: ' + file);
    }
    for (const entry of matching) {
      if (entry.license && digest(contents.get(entry.license)) !== entry.licenseSha256) throw Error('Included font license differs from its reviewed hash: ' + entry.license);
    }
    projected[key] = matching;
  }
  contents.set('publication.json', Buffer.from(JSON.stringify(projected, null, 2) + '\n'));
  for (const [file, bytes] of contents) {
    const problems = inspectFile(file, bytes, files, projected.reviewedEditionFiles, projected.reviewedSiteAssets, projected.reviewedFontFiles, projected.reviewedIconFiles);
    if (problems.length) throw Error(file + ': ' + problems.join('; '));
  }

  await mkdir(finalTarget); // No recursive creation, and no overwrite of an existing target.
  try {
    for (const [file, bytes] of contents) {
      await mkdir(path.dirname(path.join(finalTarget, file)), {recursive: true});
      await writeFile(path.join(finalTarget, file), bytes, {flag: 'wx', mode: 0o644});
    }
  } catch (error) {
    await rm(finalTarget, {recursive: true, force: true});
    throw error;
  }
  return {destination: finalTarget, files: [...files]};
}

if (process.argv[1] && await realpath(process.argv[1]).catch(() => null) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 1 || args[0].startsWith('--')) throw Error('Usage: node scripts/export-starter.mjs <new-destination-directory>');
    const result = await exportStarter({destination: args[0]});
    console.log(`Exported ${result.files.length} starter files to ${result.destination}. No Git repository or remote was created.`);
  } catch (error) {
    console.error('Starter export failed: ' + error.message);
    process.exitCode = 1;
  }
}
