const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { execFileSync } = require('child_process');

function loadConfig(cwd = process.cwd()) {
    const configPath = path.resolve(cwd, 'kuaiblog.config.js');
    if (fs.existsSync(configPath)) {
        delete require.cache[require.resolve(configPath)];
        return require(configPath);
    }
    return {};
}

function buildSidebar(cwd = process.cwd()) {
    const config = loadConfig(cwd);
    const targetDir = config.contentDir || 'posts';
    const absTargetDir = path.resolve(cwd, targetDir);
    const outputFile = path.resolve(cwd, '_sidebar.md');
    const versionFile = path.resolve(cwd, 'js', 'search-version.js');
    const homeLabel = config.homeLabel || 'Home';
    const homeFile = config.homeFile || 'README.md';
    const absHomeFile = path.resolve(cwd, homeFile);

    let sidebarContent = `* ${homeLabel}\n  * [README](${homeFile})\n`;
    const hashEntries = [];

    function walk(dir, relDir, level = 0) {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            if (file.startsWith('.')) return;
            const fullPath = path.join(dir, file);
            const relPath = path.join(relDir, file);
            const stat = fs.statSync(fullPath);
            const indent = '  '.repeat(level);

            if (stat.isDirectory()) {
                sidebarContent += `${indent}* ${file}\n`;
                walk(fullPath, relPath, level + 1);
            } else if (file.endsWith('.md')) {
                const fileNameWithoutExt = file.replace(/\.md$/i, '');
                const urlPath = relPath.replace(/\\/g, '/');
                const encodedUrlPath = urlPath.split('/').map(part => encodeURIComponent(part)).join('/');
                sidebarContent += `${indent}  * [${fileNameWithoutExt}](${encodedUrlPath})\n`;
                hashEntries.push({ path: urlPath, data: fs.readFileSync(fullPath) });
            }
        });
    }

    walk(absTargetDir, targetDir, 0);
    if (fs.existsSync(absHomeFile)) {
        hashEntries.push({ path: homeFile, data: fs.readFileSync(absHomeFile) });
    }

    const hash = crypto.createHash('sha256');
    hashEntries
        .slice()
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
        .forEach(entry => {
            hash.update(entry.path);
            hash.update('\0');
            hash.update(entry.data);
            hash.update('\0');
        });
    const searchVersion = hash.digest('hex').slice(0, 12);

    fs.writeFileSync(outputFile, sidebarContent, 'utf-8');
    fs.mkdirSync(path.dirname(versionFile), { recursive: true });
    fs.writeFileSync(versionFile, `window.__SEARCH_VERSION__ = ${JSON.stringify(searchVersion)};\n`, 'utf-8');

    console.log(`[KuaiBlog] Updated _sidebar.md and js/search-version.js (fingerprint: ${searchVersion}, files: ${hashEntries.length}).`);
    return { searchVersion, count: hashEntries.length };
}

function buildFeed(cwd = process.cwd()) {
    const config = loadConfig(cwd);
    const rssCfg = config.rss || {};
    if (rssCfg.enable === false) {
        return { count: 0, skipped: true };
    }

    const targetDir = config.contentDir || 'posts';
    const absTargetDir = path.resolve(cwd, targetDir);
    const outputFileName = rssCfg.outputFile || 'feed.xml';
    const outputFile = path.resolve(cwd, outputFileName);
    const siteTitle = config.title || 'KuaiBlog';
    const siteDesc = config.description || '';
    const maxItems = rssCfg.maxItems || 30;
    const language = rssCfg.language || 'zh-CN';
    const excludeDirs = Array.isArray(rssCfg.excludeDirs) ? rssCfg.excludeDirs : ['Private', '🔒个人创作'];

    let siteUrl = config.siteUrl || '';
    const cnamePath = path.resolve(cwd, 'CNAME');
    if (!siteUrl && fs.existsSync(cnamePath)) {
        siteUrl = 'https://' + fs.readFileSync(cnamePath, 'utf-8').trim() + '/';
    }
    if (!siteUrl) siteUrl = 'https://example.com/';
    if (!siteUrl.endsWith('/')) siteUrl += '/';

    function xmlEscape(s) {
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }

    function collectMd(dir, relDir, list = []) {
        if (!fs.existsSync(dir)) return list;
        fs.readdirSync(dir).forEach(name => {
            if (name.startsWith('.')) return;
            const full = path.join(dir, name);
            const rel = path.join(relDir, name);
            if (fs.statSync(full).isDirectory()) {
                if (excludeDirs.includes(name)) return;
                collectMd(full, rel, list);
            } else if (name.endsWith('.md')) {
                list.push({ full, rel: rel.replace(/\\/g, '/') });
            }
        });
        return list;
    }

    function gitFirstCommitDates() {
        const map = new Map();
        try {
            const out = execFileSync(
                'git', ['-c', 'core.quotepath=false', 'log', '--name-only', '--format=@@%aI', '--', targetDir],
                { cwd, encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }
            );
            let date = null;
            out.split(/\r?\n/).forEach(line => {
                if (line.startsWith('@@')) date = line.slice(2);
                else if (line.trim() && date) map.set(line.trim(), date);
            });
        } catch (_) {}
        return map;
    }

    function summarize(text, max = 140) {
        const lines = text.replace(/\r/g, '').split('\n');
        let inCode = false;
        for (const raw of lines) {
            const line = raw.trim();
            if (line.startsWith('```')) { inCode = !inCode; continue; }
            if (inCode || !line) continue;
            if (/^(#|>|<|\||[-*+]\s|\d+\.\s|!\[|---|===)/.test(line)) continue;
            const plain = line
                .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
                .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
                .replace(/[*_`~]/g, '')
                .trim();
            if (plain.length < 8) continue;
            return plain.length > max ? plain.slice(0, max) + '…' : plain;
        }
        return '';
    }

    function extractTitle(text, fallback) {
        const m = text.match(/^#\s+(.+)$/m);
        return (m ? m[1] : fallback).trim();
    }

    const dates = gitFirstCommitDates();
    const items = collectMd(absTargetDir, targetDir).map(({ full, rel }) => {
        const content = fs.readFileSync(full, 'utf-8');
        const dt = new Date(dates.get(rel) || fs.statSync(full).mtime);
        const encoded = rel.split('/').map(encodeURIComponent).join('/');
        return {
            title: extractTitle(content, path.basename(rel, '.md')),
            link: `${siteUrl}#/${encoded}`,
            date: dt,
            desc: summarize(content),
            category: rel.split('/')[1] || ''
        };
    }).sort((a, b) => b.date - a.date).slice(0, maxItems);

    const lastBuild = items.length ? items[0].date : new Date();
    const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        '  <channel>',
        `    <title>${xmlEscape(siteTitle)}</title>`,
        `    <link>${siteUrl}</link>`,
        `    <description>${xmlEscape(siteDesc)}</description>`,
        `    <language>${xmlEscape(language)}</language>`,
        `    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>`,
        `    <atom:link href="${siteUrl}${outputFileName}" rel="self" type="application/rss+xml"/>`,
        ...items.map(it => [
            '    <item>',
            `      <title>${xmlEscape(it.title)}</title>`,
            `      <link>${xmlEscape(it.link)}</link>`,
            `      <guid isPermaLink="true">${xmlEscape(it.link)}</guid>`,
            `      <pubDate>${it.date.toUTCString()}</pubDate>`,
            it.category ? `      <category>${xmlEscape(it.category)}</category>` : null,
            `      <description>${xmlEscape(it.desc)}</description>`,
            '    </item>'
        ].filter(Boolean).join('\n')),
        '  </channel>',
        '</rss>',
        ''
    ].join('\n');

    fs.writeFileSync(outputFile, xml, 'utf-8');
    console.log(`[KuaiBlog] Updated ${outputFileName} (${items.length} items).`);
    return { count: items.length, skipped: false };
}

function build(cwd = process.cwd()) {
    const sidebarRes = buildSidebar(cwd);
    const feedRes = buildFeed(cwd);
    return { sidebar: sidebarRes, feed: feedRes };
}

function copyRecursive(src, dest, force = false) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(child => {
            copyRecursive(path.join(src, child), path.join(dest, child), force);
        });
    } else {
        if (!force && fs.existsSync(dest)) return;
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
    }
}

function init(targetDir = process.cwd(), options = {}) {
    const absTarget = path.resolve(targetDir);
    const templateDir = path.resolve(__dirname, '..', 'template');
    fs.mkdirSync(absTarget, { recursive: true });
    copyRecursive(templateDir, absTarget, Boolean(options.force));
    console.log(`[KuaiBlog] Initialized blog workspace at: ${absTarget}`);
    build(absTarget);
}

function serve(cwd = process.cwd(), port = 3000) {
    build(cwd);
    const MIME_TYPES = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.md': 'text/markdown; charset=utf-8',
        '.xml': 'application/xml; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.avif': 'image/avif',
        '.ico': 'image/x-icon',
        '.mp3': 'audio/mpeg',
        '.mp4': 'video/mp4',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf'
    };

    const server = http.createServer((req, res) => {
        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        let relPath = decodeURIComponent(parsedUrl.pathname);
        if (relPath === '/') relPath = '/index.html';
        const safePath = path.normalize(path.join(cwd, relPath));
        if (!safePath.startsWith(path.resolve(cwd))) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }
        if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        const ext = path.extname(safePath).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            'Cache-Control': 'no-cache'
        });
        fs.createReadStream(safePath).pipe(res);
    });

    const config = loadConfig(cwd);
    const contentDir = path.resolve(cwd, config.contentDir || 'posts');
    if (fs.existsSync(contentDir)) {
        let timer = null;
        try {
            fs.watch(contentDir, { recursive: true }, () => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    try { buildSidebar(cwd); } catch (_) {}
                }, 200);
            });
        } catch (_) {}
    }

    server.listen(port, () => {
        console.log(`[KuaiBlog] Local preview server running at http://localhost:${port}`);
    });
    return server;
}

module.exports = {
    loadConfig,
    buildSidebar,
    buildFeed,
    build,
    init,
    serve
};
