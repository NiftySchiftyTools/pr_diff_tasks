import { DGStruct } from "./dg-struct";
import { FileMatches, StructMatches } from "./match";
import { PullRequest } from "@octokit/webhooks-types";
import { getOctokit } from "@actions/github";
import * as core from "@actions/core";

interface ReviewCommentStruct {
    path: string;
    position?: number;
    body: string;
    line?: number;
    side?: string;
    start_line?: number;
    start_side?: string;
}

export class MatchProcessor {
    pull_request: PullRequest;
    octokit: ReturnType<typeof getOctokit>;
    collaborators: string[];
    previous_matches: Map<string, DGStruct>;


    constructor(pr_response: PullRequest, octokit: ReturnType<typeof getOctokit>, previous_matches: Map<string, DGStruct>=new Map()) {
        this.pull_request = pr_response;
        this.octokit = octokit;
        this.previous_matches = previous_matches;
    }

    public async handleMatches(matches: Map<string, FileMatches>): Promise<DGStruct[]> {
        const structs: Map<string, StructMatches> = new Map();
        // Deduplicate Matches using StructMatches
        for ( const [filePath, FileMatches] of matches) {
            for ( const dg_struct of FileMatches.getMatches()) {
                if (structs.has(`${dg_struct.dir}/${dg_struct.name}`)) {
                    structs.get(`${dg_struct.dir}/${dg_struct.name}`)?.addFilePath(filePath);
                } else {
                    const structMatch = new StructMatches(dg_struct, filePath);
                    structs.set(`${dg_struct.dir}/${dg_struct.name}`, structMatch);
                }
            }   
        }
        // Prepare review comments and summary
        const review_comments: ReviewCommentStruct[] = [];
        let summary = "Triggered Domain Guard Structures:";
        for ( const [_, structMatch] of structs) {
            if (this.previous_matches.has(`${structMatch.struct.dir}/${structMatch.struct.name}`)) {
                core.info(`Skipping struct ${structMatch.struct.dir}/${structMatch.struct.name} as it was matched in a previous run.`);
                continue;
            }
            for ( const comment of structMatch.struct.actions.comments ?? []) {
                const additionalFilesContext = structMatch.additionalFilePaths.size > 0 ? `\n\n_Also affects files:_\n${Array.from(structMatch.additionalFilePaths).map(f => `- ${f}`).join('\n')}` : '';
                review_comments.push({
                    path: structMatch.anchorFilePath,
                    body: `${comment}${additionalFilesContext}`,
                    position: 1, // Docs show this as optional, but it fails without it. TODO: figure out how to make it a file level comment
                })
            }
            summary += `\n${structMatch.struct.toSummaryString()}`
        }
        if (review_comments.length > 0) {
            await this.postReview(summary, review_comments);
        }
        // Request Reviewers and Teams
        const teams_to_request = Array.from(structs.values()).flatMap(s => s.struct.actions.teams ?? []);
        const users_to_request = Array.from(structs.values()).flatMap(s => s.struct.actions.reviewers ?? []);
        if (users_to_request.length > 0 || teams_to_request.length > 0) {
            await this.requestReviewers(users_to_request, teams_to_request);
        }
        // Assign Users
        const assignees = Array.from(structs.values()).flatMap(s => s.struct.actions.assignees ?? []);
        if (assignees.length > 0) {
            await this.assignUsers(assignees);
        }
        // Add Labels
        const labels = Array.from(structs.values()).flatMap(s => s.struct.actions.labels ?? []);
        if (labels.length > 0) {
            await this.addLabels(labels);
        }
        return Array.from(structs.values()).map(s => s.struct).concat(Array.from(this.previous_matches.values()).map(s => s));
    }
    
    private async postReview(summary: string, comments: ReviewCommentStruct[] ): Promise<void> {
        await this.octokit.rest.pulls.createReview({
            owner: this.pull_request.base.repo.owner.login,
            repo: this.pull_request.base.repo.name,
            pull_number: this.pull_request.number,
            body: summary,
            event: "COMMENT",
            comments: comments
        })
    }
    private async fetchCollaborators(): Promise<void> {
        const collaborators = await this.octokit.paginate(this.octokit.rest.repos.listCollaborators, {
            owner: this.pull_request.base.repo.owner.login,
            repo: this.pull_request.base.repo.name,
            per_page: 100,
        });   
        this.collaborators = collaborators.map(c => c.login);
        core.debug(`Collaborators: [${this.collaborators.join(", ")}]`);
    }

    private async requestReviewers(reviewers: string[], teams: string[]): Promise<void> {
        if (!this.collaborators) {
            await this.fetchCollaborators();
        }
        const valid_users_to_request = reviewers.filter(u => this.collaborators.some(c => c === u));
        const invalid_users = reviewers.filter(u => !this.collaborators.some(c => c === u));
        if (invalid_users.length > 0) {
            core.warning(`The following users could not be requested as reviewers because they are not collaborators on the repository ${this.pull_request.base.repo.name}: [${invalid_users.join(", ")}]`);
        }
        if (valid_users_to_request.length > 0) {
            await this.octokit.rest.pulls.requestReviewers({
                owner: this.pull_request.base.repo.owner.login,
                repo: this.pull_request.base.repo.name,
                pull_number: this.pull_request.number,
                reviewers: valid_users_to_request,
            });
        }
        if( this.pull_request.base.repo.organization) {
            const repo_teams = await this.octokit.paginate(this.octokit.rest.teams.list, {
                org:this.pull_request.base.repo.organization,
                per_page: 100,
            });
        }
        else if (teams.length > 0) {
            core.warning(`Repository ${this.pull_request.base.repo.name} is not part of an organization; skipping team reviewer requests. As Teams are an organization-level feature.`);
            core.warning(`Teams [${teams.join(", ")}] could not be requested as reviewers.`);
        }
    }
    private async assignUsers(assignees: string[]): Promise<void> {
        if (!this.collaborators) {
            await this.fetchCollaborators();
        }
        const assigning_users: string[] = [];
        for ( const user of assignees) {
            if( !this.collaborators.includes(user)) {
                core.warning(`User ${user} could not be assigned because they are not a collaborator on the repository ${this.pull_request.base.repo.name}.`);
            }
            else {
                assigning_users.push(user);
            }
        }
        this.octokit.rest.issues.addAssignees({
            owner: this.pull_request.base.repo.owner.login,
            repo: this.pull_request.base.repo.name,
            issue_number: this.pull_request.number,
            assignees: assigning_users.slice(0, 10), // GitHub API limit is 10 assignees per issue
        });
        if (assigning_users.length > 10) {
            core.warning(`Could not assign [${assigning_users.slice(10).join(", ")}] because GitHub API limits assignees to 10`);
        }
    }

    private async addLabels(labels: string[]): Promise<void> {
        const valid_labels_response = await this.octokit.paginate(this.octokit.rest.issues.listLabelsForRepo, {
            owner: this.pull_request.base.repo.owner.login,
            repo: this.pull_request.base.repo.name,
            per_page: 100,
        });
        core.debug(`Valid labels in repo: [${valid_labels_response.map(l => l.name).join(", ")}]`);
        const valid_labels = valid_labels_response.map(l => l.name);
        const labels_to_add = labels.filter(l => valid_labels.includes(l));
        const invalid_labels = labels.filter(l => !valid_labels.includes(l));
        if (invalid_labels.length > 0) {
            core.warning(`The following labels could not be added because they do not exist in the repository ${this.pull_request.base.repo.name}: [${invalid_labels.join(", ")}]`);
        }
        else if (labels_to_add.length > 0) {
            await this.octokit.rest.issues.addLabels({
                owner: this.pull_request.base.repo.owner.login,
                repo: this.pull_request.base.repo.name,
                issue_number: this.pull_request.number,
                labels: labels_to_add,
            });
        }
    }

}
