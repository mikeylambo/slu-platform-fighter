// Spectris static checks:
//  - no untyped `any` anywhere in the app or the stance package;
//  - no platform/nondeterministic APIs inside simulation code;
//  - no tuning numbers in rules code: numeric literals other than 0, 1 (and -1) are
//    forbidden in `game/rules/`; they belong in `content/`.
import ts from 'typescript';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOTS = [
  'apps/spectris/src',
  'packages/stance/src',
  'packages/soulfire/src',
  'packages/clash/src',
  'packages/life-system/src',
];
const NONDETERMINISTIC = ['Math.random', 'Date.now', 'performance.now', 'window.localStorage'];
const ALLOWED_NUMBERS = new Set([0, 1]);

function collect(dir, files) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collect(full, files);
    } else if (full.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

const isSimulation = (file) => /src\/(game|content|ai)\/|packages\/(stance|soulfire|clash|life-system)/.test(file);
const isRules = (file) => /src\/game\/rules\//.test(file) && !file.endsWith('.test.ts');

function lintFile(file) {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true);
  const problems = [];
  const report = (node, message) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    problems.push(`${file}:${line + 1}: ${message}`);
  };
  function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      report(node, 'avoid untyped any');
    }
    if (isSimulation(file) && ts.isPropertyAccessExpression(node) && NONDETERMINISTIC.includes(node.getText(source))) {
      report(node, 'platform/nondeterministic API in simulation code');
    }
    if (isRules(file) && ts.isNumericLiteral(node) && !ALLOWED_NUMBERS.has(Number(node.text))) {
      report(node, `numeric literal ${node.text} in rules code; move it to content/`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return problems;
}

const files = ROOTS.flatMap((root) => collect(root, []));
const problems = files.flatMap(lintFile);
for (const problem of problems) {
  console.error(problem);
}
if (problems.length) {
  process.exit(1);
}
const rules = files.filter(isRules).length;
console.log(
  `SPECTRIS LINT PASS — ${files.length} files; ${rules} rules modules free of tuning literals; pure simulation`,
);
