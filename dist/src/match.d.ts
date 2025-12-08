import { DGStruct } from "./dg-struct";
export declare class FileMatches {
    filePath: string;
    directMatches: DGStruct[];
    lastMatchMatches: DGStruct[];
    lastMatchDepth: number;
    constructor(filePath: string);
    addDirectMatch(match: DGStruct): void;
    updateLastMatch(match: DGStruct, depth: number): void;
    getDirectMatchNames(): string[];
    getLastMatchNames(): string[];
    hasMatches(): boolean;
    getMatches(): DGStruct[];
    toJSON(): {
        filePath: string;
        directMatches: {
            name: string;
            paths: string[];
            filters: import("./dg-struct").DGFilters;
            actions: import("./dg-struct").DGActions;
            dir: string;
        }[];
        lastMatchMatches: {
            name: string;
            paths: string[];
            filters: import("./dg-struct").DGFilters;
            actions: import("./dg-struct").DGActions;
            dir: string;
        }[];
    };
}
export declare class StructMatches {
    struct: DGStruct;
    additionalFilePaths: Set<string>;
    anchorFilePath: string;
    constructor(struct: DGStruct, anchorfilePath: string);
    addFilePath(filePath: string): void;
}
//# sourceMappingURL=match.d.ts.map