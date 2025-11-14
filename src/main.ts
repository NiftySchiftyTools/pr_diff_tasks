import * as core from '@actions/core'
import * as github from '@actions/github'

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
    doTheThing();
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

function doTheThing() {}