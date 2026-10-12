// The production build, spawned once per `tests/build` file into a directory under the scratch
// dir, never into the worktree (ADR 0008). Seam 1's build half (plan §6) checks its output as text.
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

// The orchestrator of ADR 0010, the command `make build` and vercel.json run.
const BUILD_SCRIPT = fileURLToPath(new URL('../../build/build.ts', import.meta.url))

export type BuildResult = {
  outDir: string
  code: number
  stdout: string
  stderr: string
  /** dist/index.html, the pre-rendered Title Screen; '' when the build failed. */
  indexHtml: string
  /** dist/exhibits/index.html, the pre-rendered Fallback Page; '' when the build failed. */
  exhibitsHtml: string
}

/** Extra environment for the spawned build, e.g. CONTENT_DIR for a content fixture (plan §6). */
export type BuildOptions = { env?: Record<string, string> }

type SpawnFailure = { code?: number | string; stdout?: string; stderr?: string }

/** The boundary to the child process: execFile rejects with an Error carrying code and stderr. */
function isSpawnFailure(error: unknown): error is SpawnFailure {
  return typeof error === 'object' && error !== null && 'stderr' in error
}

export async function runProductionBuild(options: BuildOptions = {}): Promise<BuildResult> {
  const outDir = await mkdtemp(join(tmpdir(), 'portfolio-build-'))
  let code = 0
  let stdout = ''
  let stderr = ''
  try {
    ;({ stdout, stderr } = await promisify(execFile)(
      process.execPath,
      [BUILD_SCRIPT, '--outDir', outDir, '--emptyOutDir'],
      { env: { ...process.env, NO_COLOR: '1', ...options.env } },
    ))
  } catch (error) {
    if (!isSpawnFailure(error)) throw error
    code = typeof error.code === 'number' ? error.code : 1
    stdout = error.stdout ?? ''
    stderr = error.stderr ?? ''
  }
  const read = (file: string): Promise<string> =>
    code === 0 ? readFile(join(outDir, file), 'utf8') : Promise.resolve('')
  const [indexHtml, exhibitsHtml] = await Promise.all([
    read('index.html'),
    read('exhibits/index.html'),
  ])
  return { outDir, code, stdout, stderr, indexHtml, exhibitsHtml }
}

export async function removeBuild(build: BuildResult): Promise<void> {
  await rm(build.outDir, { recursive: true, force: true })
}
