import { PUBLIC_SUBMIT_SCORE_ENDPOINT, PUBLIC_GET_SCORES_ENDPOINT } from '$env/static/public';
import type { Score, SubmitData } from './types';

export interface SubmitResult {
    rank: number;
    profile: string;
}

export async function getScores(start: number = 0, count: number = 100): Promise<Score[]> {
    const r = await fetch(
        (() => {
            const url = new URL(PUBLIC_GET_SCORES_ENDPOINT);
            url.searchParams.append('start', start.toString());
            url.searchParams.append('count', count.toString());
            return url.toString();
        })(),
    );
    if (!r.ok) {
        throw new Error(`fetch scores request failed: <${r.status}> "${await r.text()}"`);
    }
    return await r.json();
}

export async function submitScore(data: SubmitData): Promise<SubmitResult> {
    const r = await fetch(PUBLIC_SUBMIT_SCORE_ENDPOINT, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!r.ok) {
        throw new Error(`submit request failed: <${r.status}> "${await r.text()}"`);
    }
    return await r.json();
}