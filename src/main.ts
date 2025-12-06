import * as core from "@actions/core";
import * as github from "@actions/github";
import * as fs from "fs/promises";
import * as path from "path";
import * as yaml from "js-yaml";
import { PRDiff } from "./diff-analysis";
import { DGStruct } from "./dg-struct";
import { FileMatches } from "./match";
import { handleMatches } from "./helpers";
import { PullRequest } from "@octokit/webhooks-types";

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const github_token: string = core.getInput("github_token");
    const pr_number: number = parseInt(core.getInput("pr_number"));

    const octokit = github.getOctokit(github_token);
    const { data: pr } = await octokit.rest.pulls.get({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: pr_number,
    });
    const { data: raw_diff } = await octokit.rest.repos.compareCommits({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      base: pr.base.sha,
      head: pr.head.sha,
      mediaType: {
        format: "diff",
      },
    });

    // The raw_diff when using mediaType.format: 'diff' returns the diff as a string
    // Cast it to string since the API returns raw text
    const diffText =
      typeof raw_diff === "string" ? raw_diff : JSON.stringify(raw_diff);

    // Parse the diff into a PRDiff object
    const prDiff = new PRDiff(diffText);
    core.info("PR Diff Analysis:");
    core.info(JSON.stringify(prDiff.getSummary(), null, 2));

    // Parse all .dg files from the repo
    const configs = await getDomainGuardStructs(
      github.context.payload.repository?.clone_url ? "." : process.cwd(),
    );
    core.info("Parsed Domain Guard Configs:");
    core.info(JSON.stringify(configs, null, 2));

    // Collect matching structures for the PR diff
    core.info("Starting to collect matching structures...");
    const matches = collectMatchingStructures(configs, prDiff);
    core.info("Domain Guard Matches:");
    handleMatches(matches, pr as PullRequest, octokit);
    core.info(JSON.stringify(Array.from(matches.entries()), null, 2));

  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.error(`Error: ${error.message}`);
      core.error(`Stack: ${error.stack}`);
      core.setFailed(error.message);
    } else {
      core.setFailed(String(error));
    }
  }
}

function collectMatchingStructures(all_structs: Map<string, Map<string, DGStruct>>, prDiff: PRDiff): Map<string, FileMatches> {
  const matches: Map<string, FileMatches> = new Map();

  for (const [filePath, fileDiff] of prDiff.fileDiffs) {
    const matchesForFile: FileMatches = new FileMatches(filePath);

    for (const [configPath, structs] of all_structs) {
      if (filePath.startsWith(configPath) || configPath === ".") {
        for (const [_, struct] of structs) {
          if (struct.matchesFileDiff(fileDiff)) {
            switch (struct.filters.quirk) {
              case "all":
                matchesForFile.addDirectMatch(struct);
                break;
              case "last_match":
                matchesForFile.updateLastMatch(struct, configPath.split(path.sep).length);
                break;
            }
          }
        }
      }
    }

    // Only add to matches if there are any matches for this file
    if (matchesForFile.hasMatches()) {
      matches.set(filePath, matchesForFile);
    }
  }

  return matches;
}

/**
 * Search the repository for all `.dg` files, parse them as YAML, and return
 * a mapping keyed by the parent folder filepath (relative to rootDir).
 *
 * - rootDir: the directory to start searching from (defaults to process.cwd())
 * - Returns: Record<parentFolderRelativePath, Record<structName, DGStruct>>
 */
export async function getDomainGuardStructs(
  rootDir: string = process.cwd(),
): Promise<Map<string, Map<string, DGStruct>>> {
  const results: Map<string, Map<string, DGStruct>> = new Map();

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".dg")) {
        try {
          const content = await fs.readFile(full, "utf8");
          const docs: any[] = [];
          // loadAll will push each document into docs
          yaml.loadAll(content, (doc: any) => {
            if (doc !== undefined) docs.push(doc);
          });
          const merged = Object.assign({}, ...docs);
          const parent = path.dirname(full);
          const key = path.relative(rootDir, parent) || ".";

          // Parse the merged YAML into DGStruct instances
          const structs = DGStruct.fromParsedYaml(merged, parent);

          if (!results.has(key)) {
            results.set(key, new Map());
          }

          // Store each struct by its name
          const structsMap = results.get(key)!;
          for (const struct of structs) {
            structsMap.set(struct.name, struct);
          }
        } catch (err) {
          // Don't throw; log a warning and continue
          const msg = err instanceof Error ? err.message : String(err);
          core.warning(`Failed to read/parse .dg file at ${full}: ${msg}`);
        }
      }
    }
  }

  await walk(rootDir);
  return results;
}
