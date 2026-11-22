#!/usr/bin/env node

const path = require('path');
const pkg = require('../package.json');
const { init, build, serve } = require('../lib/index.js');

const args = process.argv.slice(2);
const cmd = args[0] || 'help';

function printHelp() {
    console.log(`
KuaiBlog CLI v${pkg.version}

Usage:
  npx kuaiblog init [dir] [--force]   Initialize a new KuaiBlog project
  npx kuaiblog build                  Regenerate _sidebar.md, search-version.js, and feed.xml
  npx kuaiblog serve [--port 3000]    Start a local preview server with auto-sidebar refresh
  npx kuaiblog --version              Show version number
  npx kuaiblog --help                 Show this help message
`);
}

if (cmd === '--version' || cmd === '-v') {
    console.log(pkg.version);
    process.exit(0);
}

if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
    printHelp();
    process.exit(0);
}

if (cmd === 'init') {
    const dirArg = args.slice(1).find(a => !a.startsWith('-')) || '.';
    const force = args.includes('--force') || args.includes('-f');
    init(path.resolve(process.cwd(), dirArg), { force });
} else if (cmd === 'build' || cmd === 'refresh') {
    build(process.cwd());
} else if (cmd === 'serve' || cmd === 'dev') {
    const portIdx = args.indexOf('--port');
    const port = portIdx !== -1 && args[portIdx + 1] ? Number(args[portIdx + 1]) : 3000;
    serve(process.cwd(), port);
} else {
    console.error(`[KuaiBlog] Unknown command: ${cmd}`);
    printHelp();
    process.exit(1);
}
