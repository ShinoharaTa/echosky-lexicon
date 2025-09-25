import { execSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';

const PREV_TAG = process.env.PREV_TAG || 'v0.1.0';

async function loadAtTag(tag: string) {
  const tmp = '.tmp_lex_prev';
  execSync(`rm -rf ${tmp}`);
  try {
    execSync(`git archive --format=tar ${tag} lexicons | tar -x -C .`);
  } catch {
    // no-op for initial
  }
  return tmp;
}

function analyzeChange(prev: any, curr: any) {
  return [] as string[];
}

async function main() {
  console.log(`Comparing against ${PREV_TAG} (stub)`);
  console.log('No breaking changes detected (stub).');
}

main().catch(e => { console.error(e); process.exit(1); });

