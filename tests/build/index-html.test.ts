import { execFile } from 'node:child_process'
import { mkdtemp, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { beforeAll, describe, expect, it } from 'vitest'

import { inlineScripts, styleAttributes } from './html-checks'

// Seam 1's build half (plan §6): the production build is spawned once per file into a directory
// under the scratch dir, never into the worktree (ADR 0008), and its output is checked as text.
// T0's check: the built index.html carries nothing the CSP of ADR 0012 would block.
// The bin is not an exported subpath, so it is located from the package's exported package.json.
const VITE_BIN = join(
  dirname(createRequire(import.meta.url).resolve('vite/package.json')),
  'bin/vite.js',
)

type Build = { code: number; stderr: string; indexHtml: string }

async function runProductionBuild(): Promise<Build> {
  const outDir = await mkdtemp(join(tmpdir(), 'portfolio-build-'))
  let code = 0
  let stderr = ''
  try {
    ;({ stderr } = await promisify(execFile)(
      process.execPath,
      [VITE_BIN, 'build', '--outDir', outDir, '--emptyOutDir'],
      { env: { ...process.env, NO_COLOR: '1' } },
    ))
  } catch (error) {
    const failure = error as { code?: number | string; stderr?: string }
    code = typeof failure.code === 'number' ? failure.code : 1
    stderr = failure.stderr ?? String(error)
  }
  const indexHtml = code === 0 ? await readFile(join(outDir, 'index.html'), 'utf8') : ''
  return { code, stderr, indexHtml }
}

describe('the production build', () => {
  let build: Build

  beforeAll(async () => {
    build = await runProductionBuild()
  })

  it('exits 0', () => {
    expect(build.code, build.stderr).toBe(0)
  })

  it('writes an index.html without an inline script', () => {
    expect(inlineScripts(build.indexHtml)).toEqual([])
  })

  it('writes an index.html without a style attribute', () => {
    expect(styleAttributes(build.indexHtml)).toEqual([])
  })
})
