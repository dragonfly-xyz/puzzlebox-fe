import { Buffer } from 'buffer/';
import type { SubmissionData } from "./types";

export function getStoredSubmission(key: string): SubmissionData | null {
    const raw = window.sessionStorage.getItem(`__submit-${key}`);
    if (!raw) {
        return null;
    }
    return JSON.parse(raw);
}

export function storeSubmission(data: SubmissionData): string {
    const key = Buffer.from(crypto.getRandomValues(new Uint8Array(8))).toString('hex');
    window.sessionStorage.setItem(`__submit-${key}`, JSON.stringify(data));
    return key;
}

export function clearStoredSubmission(key: string): void {
    window.sessionStorage.removeItem(`__submit-${key}`);
}

export function formatScore(score: number) {
    return score.toLocaleString('en', {useGrouping: true});
}