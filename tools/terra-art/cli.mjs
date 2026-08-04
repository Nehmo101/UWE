#!/usr/bin/env node
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TERRA = path.join(ROOT, 'terra');
const ART = path.join(ROOT, '.artifacts', 'terra-art');
const CONTRACT = path.join(TERRA, 'art-direction', 'quality-contract.json');
const SCENES = path.join(TERRA, 'art-direction', 'scenes.json');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}
function argsOf(values) {
  const result = { _: [] };
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (!value.startsWith('--')) { result._.push(value); continue; }
    const key = value.slice(2);
    result[key] = values[i + 1] && !values[i + 1].startsWith('--') ? values[++i] : true;
  }
  return result;
}
function runTool(name, args, options = {}) {
  const windowsWrapper = process.platform === 'win32'
    && (!path.extname(name) || /\.(?:cmd|bat)$/i.test(name));
  return spawnSync(name, args, { ...options, shell: windowsWrapper });
}
function executable(name) {
  const probe = runTool(name, ['--version'], { encoding: 'utf8' });
  return probe.status === 0 ? (probe.stdout || probe.stderr).split('\n')[0].trim() : null;
}
function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function requireFile(file, label) {
  if (!fs.existsSync(file)) throw new Error(`${label} fehlt: ${path.relative(ROOT, file)}`);
  return file;
}
function briefFile(input) {
  if (!input) throw new Error('--brief <id|datei> fehlt');
  const direct = path.resolve(ROOT, input);
  return requireFile(fs.existsSync(direct) ? direct :
    path.join(TERRA, 'art-direction', 'briefs', input.replace(/\.json$/, '') + '.json'), 'Brief');
}
function validateContracts() {
  const contract = readJson(requireFile(CONTRACT, 'Qualitaetsvertrag'));
  const scenes = readJson(requireFile(SCENES, 'Szenenvertrag'));
  if (contract.version !== 1 || !contract.budgets?.heroAsset || !contract.workflow) {
    throw new Error('Qualitaetsvertrag ist unvollstaendig');
  }
  if (scenes.version !== 1 || !Array.isArray(scenes.scenes) || !scenes.scenes.length) {
    throw new Error('Szenenvertrag ist unvollstaendig');
  }
  const ids = scenes.scenes.map((scene) => scene.id);
  if (new Set(ids).size !== ids.length) throw new Error('Szenen-IDs muessen eindeutig sein');
  return { contract, scenes };
}

async function doctor(options) {
  const { contract, scenes } = validateContracts();
  const playwright = fs.existsSync(path.join(ROOT, 'node_modules', '@playwright', 'test'));
  const result = {
    ok: true,
    required: {
      node: process.version,
      playwright,
      contractVersion: contract.version,
      scenes: scenes.scenes.length
    },
    optional: {
      blender: executable(process.env.BLENDER_BIN || 'blender'),
      gltfTransform: executable(process.env.GLTF_TRANSFORM_BIN || 'gltf-transform'),
      chromiumOverride: process.env.PLAYWRIGHT_CHROMIUM_PATH || null
    },
    notes: []
  };
  if (!result.optional.blender) result.notes.push('Blender fehlt; Baseline/Compare bleiben nutzbar, Generate nicht.');
  if (!result.optional.gltfTransform) result.notes.push('glTF Transform fehlt; Optimize kann nur validieren/kopieren.');
  result.ok = playwright && (!options.strict || (!!result.optional.blender && !!result.optional.gltfTransform));
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

function staticServer(root) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
    '.css': 'text/css', '.webp': 'image/webp', '.glb': 'model/gltf-binary' };
  return createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(root, relative);
    if (!file.startsWith(path.resolve(root) + path.sep) && file !== path.join(root, 'index.html')) {
      response.writeHead(403).end(); return;
    }
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404).end(); return; }
      response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      response.end(data);
    });
  });
}

async function baseline(options) {
  const { scenes } = validateContracts();
  const target = path.resolve(ROOT, options.output || path.join(ART, 'baseline'));
  fs.mkdirSync(target, { recursive: true });
  const { chromium } = await import('@playwright/test');
  const server = staticServer(TERRA);
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', (error) => error ? reject(error) : resolve()));
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
  const report = { version: 1, createdAt: new Date().toISOString(), scenes: [] };
  try {
    for (const scene of scenes.scenes) {
      const page = await browser.newPage({ viewport: scene.viewport });
      const errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      const started = performance.now();
      await page.goto(`http://127.0.0.1:${port}/index.html${scene.query}`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction(() => window.__terraOk === true, null, { timeout: 90000 });
      await page.waitForTimeout(scene.settleMs || 3000);
      const file = path.join(target, scene.id + '.png');
      await page.screenshot({ path: file });
      report.scenes.push({ id: scene.id, file: path.basename(file), bytes: fs.statSync(file).size,
        elapsedMs: Math.round(performance.now() - started), errors });
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
  writeJson(path.join(target, 'manifest.json'), report);
  console.log(`Baseline: ${report.scenes.length} Szenen -> ${path.relative(ROOT, target)}`);
}

async function renderCandidates(options) {
  const brief = readJson(briefFile(options.brief));
  const { scenes } = validateContracts();
  const target = path.join(ART, 'renders', brief.assetId);
  const { chromium } = await import('@playwright/test');
  const server = staticServer(ROOT);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
  try {
    for (let i = 0; i < (brief.candidateCount || 3); i++) {
      const candidate = String.fromCharCode(97 + i);
      const model = path.join(ART, 'candidates', brief.assetId, candidate, 'model-optimized.glb');
      if (options.candidate && candidate !== options.candidate) continue;
      requireFile(model, `Optimierter Kandidat ${candidate}`);
      const candidateTarget = path.join(target, candidate);
      fs.mkdirSync(candidateTarget, { recursive: true });
      for (const scene of scenes.scenes.filter((item) => brief.scenes.includes(item.id) &&
        (!options.scene || item.id === options.scene))) {
        const page = await browser.newPage({ viewport: scene.viewport });
        const meldungen = [];
        page.on('pageerror', (error) => meldungen.push('pageerror: ' + String(error)));
        page.on('console', (message) => {
          if (message.type() === 'warning' || message.type() === 'error') {
            meldungen.push(message.type() + ': ' + message.text());
          }
        });
        const assetUrl = '/' + path.relative(ROOT, model).split(path.sep).join('/');
        const separator = scene.query.includes('?') ? '&' : '?';
        await page.goto(`http://127.0.0.1:${port}/terra/index.html${scene.query}${separator}terraAsset=${encodeURIComponent(assetUrl)}`,
          { waitUntil: 'load', timeout: 90000 });
        await page.waitForFunction(() => window.__terraOk === true, null, { timeout: 90000 });
        const zustand = await page.evaluate((assetId) => {
          const pool = window.__terraDebug && window.__terraDebug.POOLS[assetId];
          const canvas = document.querySelector('canvas');
          return pool ? {
            extern: pool.externesAsset || null,
            vertices: pool.geo && pool.geo.attributes.position.count,
            radius: pool.geo && pool.geo.boundingSphere && pool.geo.boundingSphere.radius,
            min: pool.geo && pool.geo.boundingBox && pool.geo.boundingBox.min.toArray(),
            max: pool.geo && pool.geo.boundingBox && pool.geo.boundingBox.max.toArray(),
            render: window.__terraDebug.getRenderInfo(),
            canvas: canvas && {
              width: canvas.width, height: canvas.height,
              clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight,
              devicePixelRatio: window.devicePixelRatio
            }
          } : null;
        }, brief.assetId);
        if (!zustand || zustand.extern !== brief.assetId || !zustand.vertices ||
            !Number.isFinite(zustand.radius)) {
          throw new Error(`Kandidat ${candidate}/${scene.id} nicht aktiv: `
            + JSON.stringify({ zustand, meldungen }));
        }
        console.log(`Kandidat ${candidate}/${scene.id}: ${zustand.vertices} Vertices, `
          + `Bounds ${JSON.stringify(zustand)}`);
        await page.waitForTimeout(scene.settleMs || 3000);
        await page.screenshot({ path: path.join(candidateTarget, scene.id + '.png') });
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
  console.log(`Kandidatenbilder -> ${path.relative(ROOT, target)}`);
}

async function generate(options) {
  const file = briefFile(options.brief);
  const brief = readJson(file);
  const count = Number(brief.candidateCount || 3);
  const blender = process.env.BLENDER_BIN || 'blender';
  if (!executable(blender)) throw new Error('Blender fehlt. Erst `pnpm terra:art:doctor --strict` beheben.');
  const target = path.join(ART, 'candidates', brief.assetId);
  fs.mkdirSync(target, { recursive: true });
  let generated = 0;
  for (let i = 0; i < count; i++) {
    const id = String.fromCharCode(97 + i);
    if (options.candidate && id !== options.candidate) continue;
    const out = path.join(target, id, 'model.glb');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const child = runTool(blender, ['--background', '--factory-startup', '--python',
      path.join(ROOT, 'tools', 'terra-art', 'blender', 'generate_asset.py'), '--',
      '--brief', file, '--variant', id, '--output', out], { stdio: 'inherit' });
    if (child.status !== 0) throw new Error(`Blender-Variante ${id} fehlgeschlagen`);
    generated++;
  }
  if (!generated) throw new Error('Kein passender Kandidat fuer --candidate');
  console.log(`${generated} Kandidat(en) -> ${path.relative(ROOT, target)}`);
}

function optimize(options) {
  const input = requireFile(path.resolve(ROOT, options.input || ''), '--input');
  const output = path.resolve(ROOT, options.output || input.replace(/\.glb$/, '-optimized.glb'));
  const tool = process.env.GLTF_TRANSFORM_BIN || 'gltf-transform';
  fs.mkdirSync(path.dirname(output), { recursive: true });
  if (executable(tool)) {
    const child = runTool(tool, ['optimize', input, output,
      '--compress', 'false', '--instance', 'false', '--palette', 'false',
      '--texture-compress', 'false', '--vertex-layout', 'separate'],
    { stdio: 'inherit' });
    if (child.status !== 0) throw new Error('glTF Transform fehlgeschlagen');
  } else {
    fs.copyFileSync(input, output);
    console.warn('WARN: glTF Transform fehlt; Datei wurde nur kopiert.');
  }
  console.log(`${path.relative(ROOT, output)} (${fs.statSync(output).size} Bytes)`);
}

function verifyGlb(file, budget) {
  const buffer = fs.readFileSync(file);
  if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'glTF' || buffer.readUInt32LE(4) !== 2) {
    throw new Error(`${file}: kein gueltiges GLB v2`);
  }
  if (buffer.length > budget.maxDownloadBytes) throw new Error(`${file}: Dateibudget ueberschritten`);
  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a || 20 + jsonLength > buffer.length) throw new Error(`${file}: JSON-Chunk fehlt`);
  const json = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength).replace(/\u0000+$/g, '').trim());
  const triangles = (json.meshes || []).flatMap((mesh) => mesh.primitives || []).reduce((sum, primitive) => {
    const accessor = primitive.indices === undefined ? json.accessors?.[primitive.attributes?.POSITION] :
      json.accessors?.[primitive.indices];
    return sum + Math.floor((accessor?.count || 0) / 3);
  }, 0);
  const materials = (json.materials || []).length;
  const textures = (json.textures || []).length;
  if (triangles > budget.maxTriangles) throw new Error(`${file}: Dreiecksbudget ueberschritten`);
  if (materials > budget.maxMaterials) throw new Error(`${file}: Materialbudget ueberschritten`);
  if (textures > budget.maxTextures) throw new Error(`${file}: Texturbudget ueberschritten`);
  return { bytes: buffer.length, triangles, materials, textures, sha256: sha256(file) };
}

function verify() {
  const { contract } = validateContracts();
  const manifestFile = path.join(TERRA, 'assets', 'models', 'manifest.json');
  const manifest = readJson(requireFile(manifestFile, 'Asset-Manifest'));
  const ids = new Set();
  const checked = [];
  for (const asset of manifest.assets || []) {
    if (!asset.id || ids.has(asset.id)) throw new Error('Asset-IDs fehlen oder sind doppelt');
    ids.add(asset.id);
    const file = path.resolve(path.dirname(manifestFile), asset.file);
    const result = verifyGlb(requireFile(file, asset.id), contract.budgets.heroAsset);
    if (asset.sha256 !== result.sha256) throw new Error(`${asset.id}: SHA-256 stimmt nicht`);
    checked.push({ id: asset.id, ...result });
  }
  console.log(JSON.stringify({ ok: true, assets: checked }, null, 2));
}

function compare(options) {
  const brief = readJson(briefFile(options.brief));
  const baselineDir = path.resolve(ROOT, options.baseline || path.join(ART, 'baseline'));
  const candidates = path.join(ART, 'renders', brief.assetId);
  const output = path.join(ART, 'reports', brief.assetId + '.html');
  const manifest = readJson(requireFile(path.join(baselineDir, 'manifest.json'), 'Baseline-Manifest'));
  const columns = ['baseline', ...Array.from({ length: brief.candidateCount || 3 }, (_, i) => String.fromCharCode(97 + i))];
  const rows = manifest.scenes.filter((scene) => brief.scenes.includes(scene.id)).map((scene) =>
    `<tr><th>${scene.id}</th>${columns.map((column) => {
      const source = column === 'baseline' ? path.join(baselineDir, scene.file) :
        path.join(candidates, column, scene.file);
      return `<td>${fs.existsSync(source) ? `<img src="${path.relative(path.dirname(output), source)}">` : '<em>fehlt</em>'}</td>`;
    }).join('')}</tr>`).join('\n');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `<!doctype html><meta charset="utf-8"><title>${brief.assetId}</title>
<style>body{font:14px system-ui;background:#171512;color:#eee}table{border-collapse:collapse}th,td{padding:8px;border:1px solid #555}img{width:320px;height:auto}</style>
<h1>${brief.assetId}: Zwischenabnahme</h1><p>Spalten: ${columns.join(' · ')}</p><table>${rows}</table>`);
  console.log(`Kontaktblatt -> ${path.relative(ROOT, output)}`);
}

function approve(options) {
  if (!options.asset || !options.candidate || !options.by) {
    throw new Error('approve braucht --asset, --candidate und --by');
  }
  const source = requireFile(path.join(ART, 'candidates', options.asset, options.candidate, 'model-optimized.glb'), 'Kandidat');
  const targetDir = path.join(TERRA, 'assets', 'models', options.asset);
  fs.mkdirSync(targetDir, { recursive: true });
  const target = path.join(targetDir, 'model.glb');
  fs.copyFileSync(source, target);
  const manifestFile = path.join(TERRA, 'assets', 'models', 'manifest.json');
  const manifest = readJson(manifestFile);
  const entry = { id: options.asset, file: `${options.asset}/model.glb`, sha256: sha256(target),
    fallback: options.fallback || options.asset, approvedBy: options.by };
  manifest.assets = (manifest.assets || []).filter((asset) => asset.id !== options.asset).concat(entry);
  writeJson(manifestFile, manifest);
  writeJson(path.join(TERRA, 'art-direction', 'approvals', options.asset + '.json'), {
    version: 1, assetId: options.asset, status: 'approved', selectedCandidate: options.candidate,
    approvedBy: options.by, approvedAt: new Date().toISOString(), sha256: entry.sha256
  });
  console.log(`Freigegeben: ${options.asset}/${options.candidate}`);
}

const options = argsOf(process.argv.slice(2));
const command = options._[0] || 'doctor';
try {
  if (command === 'doctor') await doctor(options);
  else if (command === 'baseline') await baseline(options);
  else if (command === 'generate') await generate(options);
  else if (command === 'render') await renderCandidates(options);
  else if (command === 'optimize') optimize(options);
  else if (command === 'verify') verify();
  else if (command === 'compare' || command === 'report') compare(options);
  else if (command === 'approve') approve(options);
  else throw new Error(`Unbekannter Befehl: ${command}`);
} catch (error) {
  console.error(`[terra-art] ${error.message}`);
  process.exitCode = 1;
}
