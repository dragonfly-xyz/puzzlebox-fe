import { PUBLIC_SUBMIT_SCORE_ENDPOINT, PUBLIC_GET_SCORES_ENDPOINT } from '$env/static/public';
import type { Score, SubmitData } from './types';

export async function getScores(count: number): Promise<Score[]> {
    const r = await fetch(PUBLIC_GET_SCORES_ENDPOINT);
    if (!r.ok) {
        throw new Error(`submit request failed: <${r.status}> "${await r.text()}"`);
    }
    return JSON.parse(await r.text());
}

export async function submitScore(data: SubmitData): Promise<void> {
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
    console.info('submitted!');
}