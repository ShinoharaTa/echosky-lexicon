import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { Lexicons } from '@atproto/lexicon';

async function main() {
  const dir = resolve(process.cwd(), 'lexicons');
  const files = (await fs.readdir(dir)).filter(f => f.endsWith('.json'));

  const lex = new Lexicons();
  for (const f of files) {
    const json = JSON.parse(await fs.readFile(resolve(dir, f), 'utf-8'));
    lex.add(json);
    console.log(`[ok] added ${f}`);
  }

  console.log('All lexicons loaded successfully');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

