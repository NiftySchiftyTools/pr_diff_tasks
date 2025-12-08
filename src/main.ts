import * as core from "@actions/core";
import * as github from "@actions/github";
import * as fs from "fs/promises";
import * as path from "path";
import * as yaml from "js-yaml";
import { PRDiff } from "./diff-analysis";
import { DGStruct } from "./dg-struct";
import { FileMatches } from "./match";
import { MatchProcessor } from "./helpers";
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

    const pr_artifacts = await octokit.rest.actions.listArtifactsForRepo({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      name: `${pr_number}-domain-guards-matches`,
    });
    let prev_matches_path: string | null = null;
    if( pr_artifacts.data.artifacts.length > 0 ) {
      core.info(`Found artifact for previous matches: ${pr_artifacts.data.artifacts[0].name}`);
      const artifact_data = await octokit.rest.actions.downloadArtifact({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        artifact_id: pr_artifacts.data.artifacts[0].id,
        archive_format: "zip",
      });
      
      // Save the zip file
      const tmpDir = process.env.RUNNER_TEMP || "/tmp";
      const zipPath = path.join(tmpDir, `${pr_number}-domain-guards-matches.zip`);
      await fs.writeFile(zipPath, Buffer.from(artifact_data.data as ArrayBuffer));
      core.info(`Downloaded artifact to: ${zipPath}`);
      
      // Extract the zip file
      const extractPath = path.join(tmpDir, `${pr_number}-domain-guards-matches`);
      await fs.mkdir(extractPath, { recursive: true });
      
      // Use unzip command to extract
      const { execSync } = require('child_process');
      execSync(`unzip -o "${zipPath}" -d "${extractPath}"`);
      
      // Set the path to the extracted matches.json
      prev_matches_path = path.join(extractPath, "matches.json");
      core.info(`Extracted artifact to: ${prev_matches_path}`);
    }
    const prev_matched_structs: Map<string, DGStruct> = new Map();
    if (prev_matches_path) {
      core.info(`Loading previous matches from: ${prev_matches_path}`);
      try {
        const prevMatchesContent = await fs.readFile(prev_matches_path, "utf8");
        const prevMatchesData = JSON.parse(prevMatchesContent);
        for (const struct_item of prevMatchesData) {
          prev_matched_structs.set(`${struct_item.dir}/${struct_item.name}`, DGStruct.fromJSON(struct_item));
        }
        core.info(`Loaded ${prev_matched_structs.size} previous matches from ${prev_matches_path}`);
      } 
      catch (err) {
        core.warning(`Failed to read previous matches from ${prev_matches_path}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    core.info(`Loaded ${prev_matched_structs.size} previous matched structs.`);
    for( const [_key, _struct ] of prev_matched_structs ) {
      core.info(`Previously matched struct: ${_key}: ${_struct.toSummaryString()}`);
    }

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
    core.info("Analysing PR Diff...");
    const prDiff = new PRDiff(diffText);
    core.info(`PR Diff contains changes to ${prDiff.fileDiffs.size} files.`);

    // Parse all .dg files from the repo
    core.info("Parsing Domain Guard Configs...");
    const configs = await getDomainGuardStructs(
      github.context.payload.repository?.clone_url ? "." : process.cwd(),
    );

    // Collect matching structures for the PR diff
    core.info("Collecting matching structures...");
    const matches = collectMatchingStructures(configs, prDiff);
    core.info(`Found ${matches.size} files with matching structures.`);
    // Process matches: post comments, request reviewers, etc.
    core.info("Processing matches...")
    const matchProcessor = new MatchProcessor(pr as PullRequest, octokit, prev_matched_structs);
    const matches_to_cache = await matchProcessor.handleMatches(matches);
    // Write matches to a temporary JSON file
    const tmpDir = process.env.RUNNER_TEMP || "/tmp";
    const tmpFilePath = path.join(tmpDir, `matches.json`);
    const matchesData = matches_to_cache.map((dg_struct) => ({
      name: dg_struct.name,
      dir: dg_struct.dir,
      paths: dg_struct.paths,
      filters: dg_struct.filters,
      actions: dg_struct.actions,
    }));
    await fs.writeFile(tmpFilePath, JSON.stringify(matchesData, null, 2), "utf8");
    core.info(`Matches written to: ${tmpFilePath}`);
    core.setOutput("matches_path", tmpFilePath);
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
