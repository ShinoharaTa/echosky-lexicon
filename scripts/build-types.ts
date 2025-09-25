import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';

async function main() {
  const src = resolve(process.cwd(), 'lexicons');
  const out = resolve(process.cwd(), 'dist');
  await fs.mkdir(out, { recursive: true });

  const files = (await fs.readdir(src)).filter(f => f.endsWith('.json'));
  const exports: string[] = [];

  for (const f of files) {
    const json = await fs.readFile(resolve(src, f), 'utf-8');
    await fs.writeFile(resolve(out, f), json, 'utf-8');

    const id = JSON.parse(json).id as string;
    const constName = id.replace(/\W+/g, '_');
    exports.push(`export { default as ${constName} } from './${f}' assert { type: 'json' };`);
  }

  await fs.writeFile(resolve(out, 'index.d.ts'), `
  declare module '*.json' { const v: any; export default v; }
  export {};
  `);
  await fs.writeFile(resolve(out, 'index.js'), exports.join('\n'));

  console.log('Built dist/ with JSON exports');
}

main().catch((e) => { console.error(e); process.exit(1); });

