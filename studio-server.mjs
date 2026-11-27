#!/usr/bin/env node
// Ghostty 主题工坊本地服务（零依赖，仅监听本机 127.0.0.1）
// 功能：
//   - 实时扫描所有中文主题 / 壁纸 / 着色器 / 本机已安装字体
//   - 上传本机壁纸 & 自动 2560px PNG 镜像到 ~/.config/ghostty/assets/（绕过 macOS Documents TCC 与渐进 JPEG 坑）
//   - 一键保存 / 删除自定义主题 & 删除壁纸 & 在访达打开目录
//   - Ghostty CLI 校验 + 写入 ~/.config/ghostty/config + 可选重启 Ghostty

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const PORT = 3847;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const WALLPAPER_DIR = path.join(ROOT, '背景图');
const SHADER_DIR = path.join(ROOT, '着色器');
const CUSTOM_DIR = path.join(ROOT, '我的自定义');
const BUILTIN_THEMES_DIR = '/Applications/Ghostty.app/Contents/Resources/ghostty/themes';
const GHOSTTY_BIN = '/Applications/Ghostty.app/Contents/MacOS/ghostty';
const GHOSTTY_CONFIG_DIR = path.join(os.homedir(), '.config', 'ghostty');
const GHOSTTY_CONFIG = path.join(GHOSTTY_CONFIG_DIR, 'config');
const GHOSTTY_ASSETS_DIR = path.join(GHOSTTY_CONFIG_DIR, 'assets');

const CATEGORIES = ['特效着色器', '自动切换深浅色', '磨砂与液态玻璃', '背景图氛围', '深色经典', '浅色护眼', '我的自定义'];
const MARK_START = '# >>> GHOSTTY-THEME-PACK START >>>';
const MARK_END = '# <<< GHOSTTY-THEME-PACK END <<<';

function execFileAsync(bin, args) {
  return new Promise((resolve) => {
    execFile(bin, args, { maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout || ''), stderr: String(stderr || ''), err });
    });
  });
}

function parseConf(text) {
  const out = {
    title: '',
    desc: '',
    note: '',
    background: '#1a1b26',
    foreground: '#c0caf5',
    cursorColor: '#7aa2f7',
    cursorText: '#1a1b26',
    selectionBackground: '#33467c',
    selectionForeground: '#c0caf5',
    palette: {},
    backgroundOpacity: 1,
    backgroundBlur: 'false',
    backgroundImage: '',
    backgroundImageOpacity: 0.45,
    backgroundImageFit: 'cover',
    backgroundImagePosition: 'center',
    cursorStyle: 'bar',
    cursorStyleBlink: true,
    windowPaddingX: 14,
    windowPaddingY: 12,
    minimumContrast: 1.15,
    fontThicken: false,
    fontFamily: '',
    fontSize: 14,
    adjustCellHeight: 0,
    macosTitlebarStyle: 'transparent',
    alphaBlending: 'linear-corrected',
    windowColorspace: 'display-p3',
    shaders: [],
    themeRaw: ''
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      const mTitle = line.match(/^#\s*(?:风格|自动明暗切换)[：:]\s*(.+)$/);
      if (mTitle && !out.title) out.title = mTitle[1].trim();
      const mDesc = line.match(/^#\s*(?:氛围|效果)[：:]\s*(.+)$/);
      if (mDesc && !out.desc) out.desc = mDesc[1].trim();
      const mNote = line.match(/^#\s*(?:优化点|亮点|特性|视觉优化)[：:]\s*(.+)$/);
      if (mNote && !out.note) out.note = mNote[1].trim();
      continue;
    }
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (key === 'palette') {
      const peq = val.indexOf('=');
      if (peq !== -1) {
        const idx = parseInt(val.slice(0, peq).trim(), 10);
        const hex = val.slice(peq + 1).trim();
        if (!Number.isNaN(idx)) out.palette[idx] = hex;
      }
    } else if (key === 'background') out.background = val;
    else if (key === 'foreground') out.foreground = val;
    else if (key === 'cursor-color') out.cursorColor = val;
    else if (key === 'cursor-text') out.cursorText = val;
    else if (key === 'selection-background') out.selectionBackground = val;
    else if (key === 'selection-foreground') out.selectionForeground = val;
    else if (key === 'background-opacity') out.backgroundOpacity = parseFloat(val) || 1;
    else if (key === 'background-blur') out.backgroundBlur = val;
    else if (key === 'background-image') out.backgroundImage = val;
    else if (key === 'background-image-opacity') out.backgroundImageOpacity = parseFloat(val) || 0.45;
    else if (key === 'background-image-fit') out.backgroundImageFit = val;
    else if (key === 'background-image-position') out.backgroundImagePosition = val;
    else if (key === 'cursor-style') out.cursorStyle = val;
    else if (key === 'cursor-style-blink') out.cursorStyleBlink = val === 'true';
    else if (key === 'window-padding-x') out.windowPaddingX = parseInt(val, 10) || 14;
    else if (key === 'window-padding-y') out.windowPaddingY = parseInt(val, 10) || 12;
    else if (key === 'minimum-contrast') out.minimumContrast = parseFloat(val) || 1.1;
    else if (key === 'font-thicken') out.fontThicken = val === 'true';
    else if (key === 'font-family') out.fontFamily = val.replace(/^["']|["']$/g, '');
    else if (key === 'font-size') out.fontSize = parseFloat(val) || 14;
    else if (key === 'adjust-cell-height') out.adjustCellHeight = parseInt(val.replace('%', ''), 10) || 0;
    else if (key === 'macos-titlebar-style') out.macosTitlebarStyle = val;
    else if (key === 'alpha-blending') out.alphaBlending = val;
    else if (key === 'window-colorspace') out.windowColorspace = val;
    else if (key === 'custom-shader') out.shaders.push(val);
    else if (key === 'theme') out.themeRaw = val;
  }
  return out;
}

function resolveRepoAsset(ref) {
  if (!ref) return '';
  if (path.isAbsolute(ref)) return ref;
  const candidate = path.resolve(ROOT, ref);
  return fs.existsSync(candidate) ? candidate : ref;
}

function resolveThemeRef(ref) {
  if (!ref) return null;
  let fp = resolveRepoAsset(ref);
  if (!path.isAbsolute(fp)) {
    fp = path.join(BUILTIN_THEMES_DIR, ref);
  }
  if (fs.existsSync(fp)) {
    return parseConf(fs.readFileSync(fp, 'utf8'));
  }
  return null;
}

let cachedFonts = null;
async function getInstalledFonts() {
  if (cachedFonts) return cachedFonts;
  const fallback = ['SF Mono', 'Menlo', 'Monaco', 'JetBrainsMono Nerd Font', 'Maple Mono NF CN', 'FiraCode Nerd Font', 'Hack Nerd Font'];
  const r = await execFileAsync(GHOSTTY_BIN, ['+list-fonts']);
  if (!r.ok || !r.stdout) {
    cachedFonts = fallback;
    return cachedFonts;
  }
  const families = new Set();
  for (const line of r.stdout.split(/\r?\n/)) {
    if (!line || line.startsWith(' ')) continue;
    const f = line.trim();
    if (f) families.add(f);
  }
  const preferred = [];
  const others = [];
  for (const f of families) {
    if (/mono|code|nerd|menlo|monaco|fira|jetbrains|maple|hack|iosevka|cascadia|consolas|sarasa|meslo|sf mono|courier/i.test(f)) {
      preferred.push(f);
    } else {
      others.push(f);
    }
  }
  preferred.sort();
  cachedFonts = preferred.length ? preferred : fallback;
  return cachedFonts;
}

function scanAll() {
  const themes = [];
  for (const cat of CATEGORIES) {
    const dir = path.join(ROOT, cat);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.conf')).sort()) {
      const fullPath = path.join(dir, file);
      const raw = fs.readFileSync(fullPath, 'utf8');
      const parsed = parseConf(raw);
      const name = path.basename(file, '.conf');
      let darkVariant = null;
      let lightVariant = null;
      let darkRef = '';
      let lightRef = '';

      if (parsed.themeRaw && parsed.themeRaw.includes('dark:') && parsed.themeRaw.includes('light:')) {
        for (const part of parsed.themeRaw.split(',')) {
          const t = part.trim();
          if (t.startsWith('dark:')) darkRef = t.slice(5).trim();
          if (t.startsWith('light:')) lightRef = t.slice(6).trim();
        }
        darkVariant = resolveThemeRef(darkRef);
        lightVariant = resolveThemeRef(lightRef);
        if (darkVariant) {
          parsed.background = darkVariant.background;
          parsed.foreground = darkVariant.foreground;
          parsed.cursorColor = darkVariant.cursorColor;
          parsed.cursorText = darkVariant.cursorText;
          parsed.selectionBackground = darkVariant.selectionBackground;
          parsed.selectionForeground = darkVariant.selectionForeground;
          parsed.palette = darkVariant.palette;
        }
      }

      const resolvedShaders = (parsed.shaders || []).map((s) => resolveRepoAsset(s));
      const resolvedBgImg = parsed.backgroundImage ? resolveRepoAsset(parsed.backgroundImage) : '';
      const bgImgName = resolvedBgImg ? path.basename(resolvedBgImg) : '';
      const bgImgUrl = bgImgName && fs.existsSync(path.join(WALLPAPER_DIR, bgImgName))
        ? `/wallpapers/${encodeURIComponent(bgImgName)}`
        : '';

      themes.push({
        id: `${cat}/${name}`,
        name,
        category: cat,
        filePath: fullPath,
        isCustom: cat === '我的自定义',
        ...parsed,
        backgroundImage: resolvedBgImg,
        shaders: resolvedShaders,
        backgroundImageUrl: bgImgUrl,
        isAuto: Boolean(darkVariant && lightVariant),
        darkRef: darkRef ? resolveRepoAsset(darkRef) : '',
        lightRef: lightRef ? resolveRepoAsset(lightRef) : '',
        darkVariant,
        lightVariant
      });
    }
  }

  const wallpapers = fs.existsSync(WALLPAPER_DIR)
    ? fs.readdirSync(WALLPAPER_DIR)
        .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
        .map((f) => {
          const fp = path.join(WALLPAPER_DIR, f);
          const st = fs.statSync(fp);
          return {
            name: path.basename(f, path.extname(f)),
            filename: f,
            filePath: fp,
            sizeKB: Math.round(st.size / 1024),
            mtime: st.mtimeMs,
            url: `/wallpapers/${encodeURIComponent(f)}`
          };
        })
        .sort((a, b) => b.mtime - a.mtime)
    : [];

  const shaders = fs.existsSync(SHADER_DIR)
    ? fs.readdirSync(SHADER_DIR)
        .filter((f) => f.endsWith('.glsl'))
        .sort()
        .map((f) => ({
          name: path.basename(f, '.glsl'),
          filename: f,
          filePath: path.join(SHADER_DIR, f)
        }))
    : [];

  let activePath = '';
  if (fs.existsSync(GHOSTTY_CONFIG)) {
    const cfg = fs.readFileSync(GHOSTTY_CONFIG, 'utf8');
    const mSrc = cfg.match(/^#\s*源文件[：:]\s*(.+)$/m);
    const mCfg = cfg.match(/^\s*config-file\s*=\s*(.+)$/m);
    activePath = (mSrc && mSrc[1].trim()) || (mCfg && mCfg[1].trim()) || '';
  }

  return { themes, wallpapers, shaders, activePath, root: ROOT, configPath: GHOSTTY_CONFIG };
}

async function mirrorImageForGhostty(srcPath) {
  const resolved = resolveRepoAsset(srcPath);
  if (!resolved || !fs.existsSync(resolved)) return resolved;
  fs.mkdirSync(GHOSTTY_ASSETS_DIR, { recursive: true });
  const stat = fs.statSync(resolved);
  const ext = path.extname(resolved).toLowerCase();
  const safeBase = Buffer.from(path.basename(resolved, ext)).toString('hex').slice(0, 24);
  const outPath = path.join(GHOSTTY_ASSETS_DIR, `wp_${safeBase}_${stat.size}.png`);
  if (!fs.existsSync(outPath)) {
    const r = await execFileAsync('/usr/bin/sips', ['-s', 'format', 'png', '-Z', '2560', resolved, '--out', outPath]);
    if (!r.ok || !fs.existsSync(outPath)) {
      fs.copyFileSync(resolved, outPath);
    }
  }
  return outPath;
}

function mirrorShaderForGhostty(srcPath) {
  const resolved = resolveRepoAsset(srcPath);
  if (!resolved || !fs.existsSync(resolved)) return resolved;
  fs.mkdirSync(GHOSTTY_ASSETS_DIR, { recursive: true });
  const safeBase = Buffer.from(path.basename(resolved, '.glsl')).toString('hex').slice(0, 24);
  const outPath = path.join(GHOSTTY_ASSETS_DIR, `sh_${safeBase}.glsl`);
  fs.copyFileSync(resolved, outPath);
  return outPath;
}

function mirrorThemeFileForGhostty(srcPath) {
  const resolved = resolveRepoAsset(srcPath);
  if (!resolved || !path.isAbsolute(resolved) || !fs.existsSync(resolved)) return srcPath;
  fs.mkdirSync(GHOSTTY_ASSETS_DIR, { recursive: true });
  const safeBase = Buffer.from(path.basename(resolved, '.conf')).toString('hex').slice(0, 24);
  const outPath = path.join(GHOSTTY_ASSETS_DIR, `th_${safeBase}.conf`);
  fs.copyFileSync(resolved, outPath);
  return outPath;
}

async function prepareRuntimeConf(sourceConfPath) {
  fs.mkdirSync(GHOSTTY_ASSETS_DIR, { recursive: true });
  const raw = fs.readFileSync(sourceConfPath, 'utf8');
  const lines = [];
  for (const line of raw.split(/\r?\n/)) {
    const mImg = line.match(/^\s*background-image\s*=\s*(.+)$/);
    if (mImg) {
      const orig = mImg[1].trim();
      const mirrored = await mirrorImageForGhostty(orig);
      lines.push(`background-image = ${mirrored}`);
      continue;
    }
    const mSh = line.match(/^\s*custom-shader\s*=\s*(.+)$/);
    if (mSh) {
      const orig = mSh[1].trim();
      const mirrored = mirrorShaderForGhostty(orig);
      lines.push(`custom-shader = ${mirrored}`);
      continue;
    }
    const mTh = line.match(/^\s*theme\s*=\s*(.+)$/);
    if (mTh && mTh[1].includes('dark:') && mTh[1].includes('light:')) {
      const parts = mTh[1].split(',').map((p) => {
        const s = p.trim();
        if (s.startsWith('dark:')) return `dark:${mirrorThemeFileForGhostty(s.slice(5).trim())}`;
        if (s.startsWith('light:')) return `light:${mirrorThemeFileForGhostty(s.slice(6).trim())}`;
        return s;
      });
      lines.push(`theme = ${parts.join(',')}`);
      continue;
    }
    lines.push(line);
  }
  const runtimePath = path.join(GHOSTTY_ASSETS_DIR, 'active-theme.conf');
  fs.writeFileSync(runtimePath, lines.join('\n'), 'utf8');
  return runtimePath;
}

function writeGhosttyActive(runtimeConfPath, sourceConfPath, label) {
  fs.mkdirSync(path.dirname(GHOSTTY_CONFIG), { recursive: true });
  let existing = fs.existsSync(GHOSTTY_CONFIG) ? fs.readFileSync(GHOSTTY_CONFIG, 'utf8') : '';
  const re = new RegExp(`${MARK_START}[\\s\\S]*?${MARK_END}\\n?`, 'g');
  existing = existing.replace(re, '').trimEnd();
  const block = [
    MARK_START,
    `# 当前启用主题：${label}`,
    `# 源文件：${sourceConfPath}`,
    `config-file = ${runtimeConfPath}`,
    MARK_END
  ].join('\n');
  const next = existing ? `${existing}\n\n${block}\n` : `${block}\n`;
  fs.writeFileSync(GHOSTTY_CONFIG, next, 'utf8');
}

async function validateGhosttyConf(confPath) {
  if (!fs.existsSync(GHOSTTY_BIN)) return { ok: true, output: '' };
  const r = await execFileAsync(GHOSTTY_BIN, ['+validate-config', `--config-file=${confPath}`]);
  const out = `${r.stdout}${r.stderr}`.trim();
  return { ok: r.ok && !out, output: out };
}

function sendJSON(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(obj));
}

function readBody(req, maxBytes = 30 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > maxBytes) {
        req.destroy();
        reject(new Error('Body too large'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Allow CLI mode: `node studio-server.mjs --apply <confPath> [label]`
if (process.argv[2] === '--apply' && process.argv[3]) {
  const confPath = path.resolve(process.argv[3]);
  const label = process.argv[4] || path.basename(confPath, '.conf');
  const runtimePath = await prepareRuntimeConf(confPath);
  const check = await validateGhosttyConf(runtimePath);
  if (!check.ok) {
    console.error(`校验失败：${check.output}`);
    process.exit(1);
  }
  writeGhosttyActive(runtimePath, confPath, label);
  console.log(`✅ 已通过镜像安全应用：${label}`);
  process.exit(0);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      const htmlPath = path.join(ROOT, '主题工坊.html');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(htmlPath));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/data') {
      sendJSON(res, 200, scanAll());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/fonts') {
      const fonts = await getInstalledFonts();
      sendJSON(res, 200, { fonts });
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/wallpapers/')) {
      const filename = path.basename(decodeURIComponent(url.pathname.slice('/wallpapers/'.length)));
      const fp = path.join(WALLPAPER_DIR, filename);
      if (!fs.existsSync(fp)) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      const ext = path.extname(fp).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=3600' });
      fs.createReadStream(fp).pipe(res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/upload-wallpaper') {
      const body = JSON.parse(await readBody(req));
      const rawName = (body.filename || '自定义壁纸.png').replace(/[/\\:*?"<>|]/g, '_');
      const m = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(body.dataUrl || '');
      if (!m) return sendJSON(res, 400, { error: '仅支持 PNG / JPG / WEBP 图片' });
      const ext = m[1].toLowerCase() === 'jpeg' ? '.jpg' : `.${m[1].toLowerCase()}`;
      const base = path.basename(rawName, path.extname(rawName)) || '自定义壁纸';
      const safeFile = `${base}${ext}`;
      fs.mkdirSync(WALLPAPER_DIR, { recursive: true });
      const outPath = path.join(WALLPAPER_DIR, safeFile);
      fs.writeFileSync(outPath, Buffer.from(m[2], 'base64'));
      const st = fs.statSync(outPath);
      sendJSON(res, 200, {
        ok: true,
        name: base,
        filename: safeFile,
        filePath: outPath,
        sizeKB: Math.round(st.size / 1024),
        mtime: st.mtimeMs,
        url: `/wallpapers/${encodeURIComponent(safeFile)}`
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/delete-custom') {
      const body = JSON.parse(await readBody(req));
      const target = path.resolve(body.filePath || '');
      const customRoot = path.resolve(CUSTOM_DIR) + path.sep;
      if (!target.startsWith(customRoot) || !target.endsWith('.conf')) {
        return sendJSON(res, 400, { error: '只允许删除「我的自定义」目录下的 .conf 主题' });
      }
      if (fs.existsSync(target)) fs.unlinkSync(target);
      sendJSON(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/delete-wallpaper') {
      const body = JSON.parse(await readBody(req));
      const target = path.resolve(body.filePath || '');
      const wpRoot = path.resolve(WALLPAPER_DIR) + path.sep;
      if (!target.startsWith(wpRoot)) {
        return sendJSON(res, 400, { error: '只允许删除「背景图」目录下的图片' });
      }
      if (fs.existsSync(target)) fs.unlinkSync(target);
      sendJSON(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/open-finder') {
      const body = JSON.parse(await readBody(req) || '{}');
      const dir = body.target === 'wallpapers' ? WALLPAPER_DIR : ROOT;
      await execFileAsync('/usr/bin/open', [dir]);
      sendJSON(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/apply') {
      const body = JSON.parse(await readBody(req));
      let targetPath = body.filePath || '';
      let label = body.label || '自定义主题';

      if (body.content) {
        fs.mkdirSync(CUSTOM_DIR, { recursive: true });
        const cleanName = (body.saveName || '我的当前定制').replace(/[/\\:*?"<>|]/g, '_').replace(/\.conf$/, '');
        targetPath = path.join(CUSTOM_DIR, `${cleanName}.conf`);
        fs.writeFileSync(targetPath, body.content, 'utf8');
        label = `我的自定义 / ${cleanName}`;
      }

      if (!targetPath || !fs.existsSync(targetPath)) {
        return sendJSON(res, 400, { error: '找不到目标配置文件' });
      }

      const runtimePath = await prepareRuntimeConf(targetPath);
      const check = await validateGhosttyConf(runtimePath);
      if (!check.ok) {
        return sendJSON(res, 400, { error: `Ghostty 配置校验失败：${check.output}` });
      }

      if (!body.saveOnly) {
        writeGhosttyActive(runtimePath, targetPath, label);
      }

      sendJSON(res, 200, {
        ok: true,
        applied: !body.saveOnly,
        targetPath,
        label,
        configPath: GHOSTTY_CONFIG
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/restart-ghostty') {
      await execFileAsync('/usr/bin/osascript', ['-e', 'tell application "Ghostty" to quit']);
      await new Promise((r) => setTimeout(r, 600));
      await execFileAsync('/usr/bin/open', ['-a', 'Ghostty']);
      sendJSON(res, 200, { ok: true });
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  } catch (err) {
    sendJSON(res, 500, { error: err.message || String(err) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n✨ Ghostty 主题工坊已启动：http://127.0.0.1:${PORT}\n`);
});
