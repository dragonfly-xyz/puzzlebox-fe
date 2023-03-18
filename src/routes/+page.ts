import type { HiScore } from '$lib/HiScoreDisplay.svelte';


const HI_SCORES: HiScore[] = [
    { name: 'm4r10.eth', score: 1234 },
    { name: 'lu1g1.eth', score: 334 },
    { name: 'b0w53r.eth', score: 91 },
    { name: 'merklejerk.eth', score: 2913112 },
    { name: '0x41b1a0649752af1b28b3dc29a1556eee781e4a4c', score: 31344 },
    { name: '0xba317c594fba9563906fc67faf6f5798c8dc83bd', score: 8394 },
    { name: '0xd84aa0797ba806a955ff1e4beff7b217eaf07f91', score: 712 },
    { name: '7768c317aa6a7270a7e0ef4ee02bf55083296ba7', score: 403 },
    { name: '55af5e2a3210f3d341aa5c91ab546416ccfe098b', score: 103 },
    { name: 'f322941b84ab57a10d8afa465e666846d883423f', score: 599348 },
    { name: 'foo.eth', score: 954 },
    { name: 'elitehaxor.eth', score: 419441 },
];

export interface PageData {
    hiScores: HiScore[];
}

export async function load({ fetch }): Promise<PageData> {
    return {
        hiScores: HI_SCORES,
    };
}