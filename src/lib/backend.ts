import { PUBLIC_SUBMIT_SCORE_ENDPOINT, PUBLIC_GET_SCORES_ENDPOINT } from '$env/static/public';
import {
    type WalletClient,
    createWalletClient,
    custom,
    getAccount,
    type Account,
} from 'viem';
import type { Score } from './types';

const EIP712DOMAIN = {
    name: 'PuzzleBoxCtf',
    version: '1.0',
} as const

const EIP712_SCORE_TYPE = {
    SignedScore: [
        { name: 'name', type: 'string' },
        { name: 'score', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
    ],
} as const;


export async function getScores(count: number): Promise<Score[]> {
    const r = await fetch(PUBLIC_GET_SCORES_ENDPOINT);
    if (!r.ok) {
        throw new Error(`submit request failed: <${r.status}> "${await r.text()}"`);
    }
    return JSON.parse(await r.text());
}

async function signScore(
    name: string,
    score: number,
    expiry: number,
): Promise<`0x${string}`> {
    const wallet: WalletClient = createWalletClient({
        // TODO: mobile support
        transport: custom((window as any).ethereum),
    });
    const [address] = await wallet.requestAddresses();
    const account: Account = getAccount(address);
    return await wallet.signTypedData({
        account,
        domain: EIP712DOMAIN,
        types: EIP712_SCORE_TYPE,
        primaryType: 'SignedScore',
        message: {
            name,
            score: BigInt(score),
            expiry: BigInt(expiry),
        },
    });
}

export async function submitScore(
    name: string,
    score: number,
    validDuration: number,
    code: string,
): Promise<void> {
    const expiry = Math.floor(Date.now() / 1e3 + validDuration);
    const sig = await signScore(name, score, expiry);
    const r = await fetch(PUBLIC_SUBMIT_SCORE_ENDPOINT, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: name, score, expiry, signature: sig, solutionCode: code }),
    });
    if (!r.ok) {
        throw new Error(`submit request failed: <${r.status}> "${await r.text()}"`);
    }
    console.info('submitted!');
}