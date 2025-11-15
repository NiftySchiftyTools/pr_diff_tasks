import * as path from 'path'
import * as core from '@actions/core'

export type Quirk = 'all' | 'last_match'
export type DiffType = 'all' | 'additions' | 'removals' | 'raw'

export interface DGFilters {
    contains?: string
    quirk?: Quirk
    diff_type?: DiffType
    exclude_paths?: string[]
}

export interface DGActions {
    comments?: string[]
    reviewers?: string[]
    assignees?: string[]
    teams?: string[]
    labels?: string[]
}

export class DGStruct {
    name: string
    paths: string[]
    filters: DGFilters
    actions: DGActions
    // directory where the .dg file lives (used to resolve relative paths)
    dir: string

    constructor(name: string, obj: any, dir: string) {
        this.name = name
        this.dir = dir

        // normalize paths
        this.paths = Array.isArray(obj?.paths) ? obj.paths.map(String) : []

        // filters with defaults
        const f = obj?.filters ?? {}
        this.filters = {
            contains: typeof f.contains === 'string' ? f.contains : '.*',
            quirk: f.quirk === 'last_match' ? 'last_match' : 'all',
            diff_type: ['all', 'additions', 'removals', 'raw'].includes(f.diff_type)
                ? f.diff_type
                : 'all',
            exclude_paths: Array.isArray(f.exclude_paths) ? f.exclude_paths.map(String) : [],
        }

        // actions
        const a = obj?.actions ?? {}
        this.actions = {
            comments: Array.isArray(a.comments) ? a.comments.map(String) : [],
            reviewers: Array.isArray(a.reviewers) ? a.reviewers.map(String) : [],
            assignees: Array.isArray(a.assignees) ? a.assignees.map(String) : [],
            teams: Array.isArray(a.teams) ? a.teams.map(String) : [],
            labels: Array.isArray(a.labels) ? a.labels.map(String) : [],
        }
    }

    /**
     * Parse a full YAML-parsed object from a .dg file (may contain multiple top-level keys)
     * and return an array of DGStruct instances. `fileDir` should be the directory containing
     * the .dg file so relative paths can be evaluated later.
     */
    static fromParsedYaml(parsed: any, fileDir: string): DGStruct[] {
        const results: DGStruct[] = []
        if (!parsed || typeof parsed !== 'object') return results

        for (const key of Object.keys(parsed)) {
            try {
                results.push(new DGStruct(key, parsed[key], fileDir))
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                core.warning(`Failed to parse struct ${key} in ${fileDir}: ${msg}`)
            }
        }

        return results
    }

    // Helper: convert relative patterns to a regex (very small subset: supports * wildcard)
    private patternToRegex(pat: string): RegExp {
        // make path posix-style for matching
        const rel = pat.replace(/\\/g, '/')
        // escape regex special chars, then replace '*' with '.*'
        const esc = rel.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\\\*/g, '.*')
        return new RegExp('^' + esc + '$')
    }

    private normalizeRelative(target: string): string {
        // produce a path relative to the DG file dir and in posix style
        const rel = path.relative(this.dir, target)
        return rel.replace(/\\/g, '/')
    }

    /**
     * Check whether this struct's path globs match the given file path.
     * `fileFullPath` should be an absolute or repo-root relative path.
     */
    matchesFile(fileFullPath: string): boolean {
        if (!this.paths || this.paths.length === 0) return false

        const rel = this.normalizeRelative(fileFullPath)

        // check exclude_paths first
        for (const ex of this.filters.exclude_paths ?? []) {
            const rex = this.patternToRegex(ex)
            if (rex.test(rel)) return false
        }

        for (const pat of this.paths) {
            const r = this.patternToRegex(pat)
            if (r.test(rel)) return true
        }

        return false
    }

    /**
     * Check whether the diff text matches the `contains` regex based on diff_type.
     */
    matchesDiff(diffText: string): boolean {
        if (!diffText) return false
        const regex = new RegExp(this.filters.contains ?? '.*', 's')

        let subject = diffText
        switch (this.filters.diff_type) {
            case 'additions':
                subject = diffText.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).join('\n')
                break
            case 'removals':
                subject = diffText.split('\n').filter(l => l.startsWith('-') && !l.startsWith('---')).join('\n')
                break
            case 'raw':
                subject = diffText
                break
            default:
                subject = diffText
        }

        return regex.test(subject)
    }

    toJSON() {
        return {
            name: this.name,
            paths: this.paths,
            filters: this.filters,
            actions: this.actions,
            dir: this.dir,
        }
    }
}


