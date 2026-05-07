const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const SRC_DIR = path.join(__dirname, '..', 'src');
const TOKEN_FILE = path.join(SRC_DIR, 'theme', 'index.ts');

const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g;
const INLINE_STYLE_RE = /style=\{\{[^}]+\}\}/g;

function collectFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const resolved = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(resolved));
      continue;
    }
    if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(resolved);
    }
  }
  return files;
}

function getChangedSourceFiles() {
  try {
    const output = execSync('git status --porcelain', { encoding: 'utf8' });
    return output
      .split('\n')
      .filter(Boolean)
      .map((line) => line.slice(3).trim())
      .map((file) => path.join(process.cwd(), file))
      .filter((file) => file.startsWith(SRC_DIR))
      .filter((file) => /\.(ts|tsx|js|jsx)$/.test(file))
      .filter((file) => fs.existsSync(file));
  } catch {
    return [];
  }
}

function run() {
  const checkAll = process.argv.includes('--all');
  const files = checkAll ? collectFiles(SRC_DIR) : getChangedSourceFiles();

  if (files.length === 0) {
    console.log('Style guardrails skipped: no changed source files. Use --all for full scan.');
    return;
  }

  const violations = [];

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const relPath = path.relative(process.cwd(), file);

    if (file !== TOKEN_FILE) {
      const hexMatches = source.match(HEX_COLOR_RE) || [];
      for (const match of hexMatches) {
        violations.push(`${relPath}: raw hex color found (${match})`);
      }
    }

    const inlineMatches = source.match(INLINE_STYLE_RE) || [];
    for (const match of inlineMatches) {
      violations.push(`${relPath}: inline style object found (${match.slice(0, 80)}...)`);
    }
  }

  if (violations.length === 0) {
    console.log(`Style guardrails passed (${checkAll ? 'all src files' : 'changed files'}).`);
    return;
  }

  console.error('Style guardrails failed:\n');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
}

run();
