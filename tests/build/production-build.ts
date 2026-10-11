// The production build, spawned once per `tests/build` file into a directory under the scratch
// dir, never into the worktree (ADR 0008). Seam 1's build half (plan §6) checks its output as text.
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'

// The bin is not an exported subpath, so it is located from the package's exported package.json.
const VITE_BIN = join(
  dirname(createRequire(import.meta.url).resolve('vite/package.json')),
  'bin/vite.js',
)

export type BuildResult = { outDir: string; code: number; stderr: string; indexHtml: string }

type SpawnFailure = { code?: number | string; stderr?: string }

/** The boundary to the child process: execFile rejects with an Error carrying code and stderr. */
function isSpawnFailure(error: unknown): error is SpawnFailure {
  return typeof error === 'object' && error !== null && 'stderr' in error
}

export async function runProductionBuild(): Promise<BuildResult> {
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
    if (!isSpawnFailure(error)) throw error
    code = typeof error.code === 'number' ? error.code : 1
    stderr = error.stderr ?? ''
  }
  const indexHtml = code === 0 ? await readFile(join(outDir, 'index.html'), 'utf8') : ''
  return { outDir, code, stderr, indexHtml }
}

export async function removeBuild(build: BuildResult): Promise<void> {
  await rm(build.outDir, { recursive: true, force: true })
}
