const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const configPath = path.resolve(process.cwd(), 'kuaiblog.config.js');
const config = fs.existsSync(configPath) ? require(configPath) : {};

const targetDir = config.contentDir || 'posts';
const outputFile = '_sidebar.md';
const versionFile = path.join('js', 'search-version.js');
const homeLabel = config.homeLabel || 'Home';
const homeFile = config.homeFile || 'README.md';

let sidebarContent = `* ${homeLabel}\n  * [README](${homeFile})\n`;
const hashEntries = [];

function generateSidebar(dir, level = 0) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);

    files.forEach(file => {
        if (file.startsWith('.')) return;

        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        const indent = '  '.repeat(level);

        if (stat.isDirectory()) {
            sidebarContent += `${indent}* ${file}\n`;
            generateSidebar(fullPath, level + 1);
        } else if (file.endsWith('.md')) {
            const fileNameWithoutExt = file.replace(/\.md$/i, '');
            const urlPath = fullPath.replace(/\\/g, '/');
            const encodedUrlPath = urlPath.split('/').map(part => encodeURIComponent(part)).join('/');

            sidebarContent += `${indent}  * [${fileNameWithoutExt}](${encodedUrlPath})\n`;
            hashEntries.push({ path: urlPath, data: fs.readFileSync(fullPath) });
        }
    });
}

function buildSearchVersion(entries) {
    const hash = crypto.createHash('sha256');
    entries
        .slice()
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
        .forEach(entry => {
            hash.update(entry.path);
            hash.update('\0');
            hash.update(entry.data);
            hash.update('\0');
        });
    return hash.digest('hex').slice(0, 12);
}

console.log(`[KuaiBlog] Scanning directory "${targetDir}"...`);
generateSidebar(targetDir);
if (fs.existsSync(homeFile)) {
    hashEntries.push({ path: homeFile, data: fs.readFileSync(homeFile) });
}
const searchVersion = buildSearchVersion(hashEntries);

fs.writeFileSync(outputFile, sidebarContent, 'utf-8');
fs.mkdirSync(path.dirname(versionFile), { recursive: true });
fs.writeFileSync(versionFile, `window.__SEARCH_VERSION__ = ${JSON.stringify(searchVersion)};\n`, 'utf-8');
console.log(`[KuaiBlog] Generated ${outputFile} and updated search fingerprint to ${searchVersion} (${hashEntries.length} files).`);
