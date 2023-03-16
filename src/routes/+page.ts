import type { HiScore } from '$lib/HiScoreDisplay.svelte';
import { PUBLIC_CHALLENGE_SOL_URL as CHALLENGE_SOL_URL } from "$env/static/public";


const HI_SCORES: HiScore[] = [
    { name: 'm4r10.eth', score: 1234 },
    { name: 'lu1g1.eth', score: 334 },
    { name: 'b0w53r.eth', score: 91 },
    { name: 'merklejerk.eth', score: 2913112 },
    { name: '0x41b1a0649752af1b28b3dc29a1556eee781e4a4c', score: 31344 },
    { name: '0xba317c594fba9563906fc67faf6f5798c8dc83bd', score: 8394 },
    { name: '0xd84aa0797ba806a955ff1e4beff7b217eaf07f91', score: 712 },
    { name: 'foo.eth', score: 954 },
    { name: 'elitehaxor.eth', score: 419441 },
];

const SOLUTION_CODE = `// SPDX-License-Identifier: UNLICENSED
contract Solution {
    function solve(PuzzleBox puzzle) external {
        // open the box...
    }
}
`;

export interface PageData {
    challengeCode: string;
    solutionCode: string;
    hiScores: HiScore[];
}

export async function load({ fetch }): Promise<PageData> {
    const resp = await fetch(CHALLENGE_SOL_URL);
    return {
        challengeCode: await resp.text(),
        hiScores: HI_SCORES,
        solutionCode: SOLUTION_CODE,
    };
}