/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export declare function run(): Promise<void>;
/**
 * Search the repository for all `.dg` files, parse them as YAML, and return
 * a mapping keyed by the parent folder filepath (relative to rootDir).
 *
 * - rootDir: the directory to start searching from (defaults to process.cwd())
 * - Returns: Record<parentFolderRelativePath, mergedYamlObject>
 */
export declare function getDomainGuardConfigs(rootDir?: string): Promise<Record<string, any>>;
//# sourceMappingURL=main.d.ts.map