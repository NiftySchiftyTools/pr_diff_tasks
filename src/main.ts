import * as core from '@actions/core'
import * as github from '@actions/github'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as yaml from 'js-yaml'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const github_token: string = core.getInput('github_token')
    const pr_number: number = parseInt(core.getInput('pr_number'))

    const octokit = github.getOctokit(github_token)
    const { data: pr } = await octokit.rest.pulls.get({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: pr_number,
    })
    
    // Parse all .dg files from the repo
    const configs = await getDomainGuardConfigs(github.context.payload.repository?.clone_url ? '.' : process.cwd())
    core.info('Parsed Domain Guard Configs:')
    core.info(JSON.stringify(configs, null, 2))
    
    doTheThing();
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

function doTheThing() {}

/**
 * Search the repository for all `.dg` files, parse them as YAML, and return
 * a mapping keyed by the parent folder filepath (relative to rootDir).
 *
 * - rootDir: the directory to start searching from (defaults to process.cwd())
 * - Returns: Record<parentFolderRelativePath, mergedYamlObject>
 */
export async function getDomainGuardConfigs(rootDir: string = process.cwd()): Promise<Record<string, any>> {
  const results: Record<string, any> = {}

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile() && entry.name.endsWith('.dg')) {
        try {
          const content = await fs.readFile(full, 'utf8')
          const docs: any[] = []
          // loadAll will push each document into docs
          yaml.loadAll(content, (doc: any) => { if (doc !== undefined) docs.push(doc) })
          const merged = Object.assign({}, ...docs)
          const parent = path.dirname(full)
          const key = path.relative(rootDir, parent) || '.'
          if (!results[key]) results[key] = {}
          Object.assign(results[key], merged)
        } catch (err) {
          // Don't throw; log a warning and continue
          const msg = err instanceof Error ? err.message : String(err)
          core.warning(`Failed to read/parse .dg file at ${full}: ${msg}`)
        }
      }
    }
  }

  await walk(rootDir)
  return results
}
