import type { SimResults } from "./simulate";

export interface Score {
    name: string;
    score: number;
    profile: string;
    rank: number;
    unlocked: boolean;
    timestamp: number;
    firstUnlocked: number | null;
    isContestant: boolean;
    isWinner: boolean;
}

export interface SimResultsWithScore {
    simResults: SimResults;
    score: number;
}

export interface SubmissionData {
    authType: 'github' | 'twitter';
    solution: string;
    email: string;
    name: string;
    verifier?: string;
}

export interface SubmitData extends SubmissionData {
    authCode: string;
    verifier?: string;
}