import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDir = path.resolve(import.meta.dirname);
const importRe = /(?:from|import)\s+['"](\.{1,2}\/[^'"]+)['"]/g;

function listTsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === 'generated' ? [] : listTsFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

function featureOf(file: string): string | undefined {
  const rel = path.relative(path.join(srcDir, 'features'), file);
  return rel.startsWith('..') ? undefined : rel.split(path.sep)[0];
}

const violations: string[] = [];
for (const file of listTsFiles(srcDir)) {
  const source = readFileSync(file, 'utf8');
  const ownFeature = featureOf(file);
  const inCore = path.relative(path.join(srcDir, 'core'), file).startsWith('..') === false;
  for (const match of source.matchAll(importRe)) {
    const target = path.resolve(path.dirname(file), match[1]!.replace(/\.js$/, ''));
    const targetFeature = featureOf(target);
    if (!targetFeature) continue;
    const isPublicApi = path.basename(target) === 'index';
    const rel = path.relative(srcDir, file);
    if (inCore) violations.push(`${rel}: core must not import features (${match[1]})`);
    else if (targetFeature !== ownFeature && !isPublicApi)
      violations.push(`${rel}: import features/${targetFeature} only through its index.ts (${match[1]})`);
  }
}

describe('architecture', () => {
  it('respects app -> features -> core dependency rules', () => {
    expect(violations).toEqual([]);
  });
});
