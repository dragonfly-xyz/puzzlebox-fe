import type { SimResults } from "./simulate";

export interface Score {
    name: string;
    score: number;
    address: string;
}

export interface SimResultsWithScore {
    simResults: SimResults;
    score: number;
}