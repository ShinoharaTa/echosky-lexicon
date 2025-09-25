import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';

async function main() {
  const src = resolve(process.cwd(), 'lexicons');
  const out = resolve(process.cwd(), 'schema/docs');
  await fs.mkdir(out, { recursive: true });

  const files = (await fs.readdir(src)).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const json = JSON.parse(await fs.readFile(resolve(src, f), 'utf-8'));
    const id = json.id as string;
    const md = `# ${id}\n\n\n\n`;
    await fs.writeFile(resolve(out, f.replace(/\.json$/, '.md')), md, 'utf-8');
  }
  console.log('Generated docs to schema/docs');
}

main().catch(e => { console.error(e); process.exit(1); });

