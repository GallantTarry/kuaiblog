const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const configPath = path.resolve(process.cwd(), 'kuaiblog.config.js');
const config = fs.existsSync(configPath) ? require(configPath) : {};
const rssCfg = config.rss || {};

if (rssCfg.enable === false) {
    console.log('[KuaiBlog] RSS generation is disabled in kuaiblog.config.js.');
    process.exit(0);
}

const targetDir = config.contentDir || 'posts';
const outputFile = rssCfg.outputFile || 'feed.xml';
const siteTitle = config.title || 'KuaiBlog';
const siteDesc = config.description || '';
const maxItems = rssCfg.maxItems || 30;
const language = rssCfg.language || 'zh-CN';
const excludeDirs = Array.isArray(rssCfg.excludeDirs) ? rssCfg.excludeDirs : ['Private', '🔒个人创作'];

let siteUrl = config.siteUrl || '';
if (!siteUrl && fs.existsSync('CNAME')) {
    siteUrl = 'https://' + fs.readFileSync('CNAME', 'utf-8').trim() + '/';
}
if (!siteUrl) {
    siteUrl = 'https://example.com/';
}
if (!siteUrl.endsWith('/')) {
    siteUrl += '/';
}

function xmlEscape(s) {
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function collectMd(dir, list = []) {
    if (!fs.existsSync(dir)) return list;
    fs.readdirSync(dir).forEach(name => {
        if (name.startsWith('.')) return;
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) {
            if (excludeDirs.includes(name)) return;
            collectMd(full, list);
        } else if (name.endsWith('.md')) {
            list.push(full.replace(/\\/g, '/'));
        }
    });
    return list;
}

function gitFirstCommitDates() {
    const map = new Map();
    try {
        const out = execFileSync(
            'git', ['-c', 'core.quotepath=false', 'log', '--name-only', '--format=@@%aI', '--', targetDir],
            { encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }
        );
        let date = null;
        out.split(/\r?\n/).forEach(line => {
            if (line.startsWith('@@')) date = line.slice(2);
            else if (line.trim() && date) map.set(line.trim(), date);
        });
    } catch (_) {
        // Fallback to file mtime if git history is unavailable
    }
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

console.log(`[KuaiBlog] Generating ${outputFile}...`);
const dates = gitFirstCommitDates();
const items = collectMd(targetDir).map(file => {
    const content = fs.readFileSync(file, 'utf-8');
    const dt = new Date(dates.get(file) || fs.statSync(file).mtime);
    const encoded = file.split('/').map(encodeURIComponent).join('/');
    return {
        title: extractTitle(content, path.basename(file, '.md')),
        link: `${siteUrl}#/${encoded}`,
        date: dt,
        desc: summarize(content),
        category: file.split('/')[1] || ''
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
    `    <atom:link href="${siteUrl}${outputFile}" rel="self" type="application/rss+xml"/>`,
    '    <image>',
    `      <url>${siteUrl}favicon/favicon-96x96.png</url>`,
    `      <title>${xmlEscape(siteTitle)}</title>`,
    `      <link>${siteUrl}</link>`,
    '      <width>96</width>',
    '      <height>96</height>',
    '    </image>',
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
console.log(`[KuaiBlog] Generated ${outputFile} with ${items.length} recent articles.`);
