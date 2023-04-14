import { provider as createGanacheProvider } from 'ganache';
import { parseAbiParameters, type Abi, type AbiEvent } from 'abitype';
import {
    createPublicClient,
    createWalletClient,
    custom,
    decodeAbiParameters,
    decodeEventLog,
    type TransactionReceipt,
} from 'viem';
import { mainnet, localhost } from 'viem/chains';
import type { CompilerArtifacts } from './compile';

const SIM_VALUE = 1337;

export interface DecodedEvent {
    eventName: string,
    args: any | undefined;
}

export interface SimResults {
    gasUsed: number;
    puzzleEvents: DecodedEvent[];
    error?: string;
}

export async function simulate(artifacts: CompilerArtifacts): Promise<SimResults> {
    const provider = createGanacheProvider({
        defaultTransactionGasLimit: 32e6,
        chain: { allowUnlimitedContractSize: true },
        miner: { blockGasLimit: 32e6 },
        wallet: {
            accounts: [{
                balance: '0x3635c9adc5dea00000',
                secretKey: '0xcc7ec7a48ef9945cd647aa5c01a0dc8967612dd70c0a24f7bfb53e29a04f04fe'
            }],
        },
    });
    const pc = createPublicClient({ chain: localhost, transport: custom(provider) });
    const wallet = createWalletClient({ chain: localhost, transport: custom(provider) });
    let txId = await wallet.deployContract({
        abi: artifacts.runner.abi,
        bytecode: artifacts.runner.bytecode,
        account: '0x9BE7E7eA695D8e1a9D12f12EA002713F350Cdd41',
        args: [artifacts.solution.deployedBytecode, BigInt(Math.floor(Math.random() * 2**32))],
        value: BigInt(SIM_VALUE),
        gas: 32e6,
    } as any); // HACK: deployContract param type doesn't define `value`.
    let receipt = await pc.waitForTransactionReceipt({ hash: txId });
    await provider.disconnect();
    return simResultsFromReceipt(artifacts, receipt.contractAddress!, receipt);
}

function simResultsFromReceipt(artifacts: CompilerArtifacts, runnerAddress: string, receipt: TransactionReceipt): SimResults {
    let puzzleEvents: DecodedEvent[] = [];
    let puzzle: string | undefined;
    let gasUsed: number | undefined;
    let error: string | undefined;

    if (receipt.status !== 'success') {
        throw new Error(`Transaction failed.`);
    }

    for (const log of receipt.logs) {
        let decoded;
        try {
            decoded = decodeEventLog({
                abi: artifacts.eventsAbi,
                data: log.data,
                topics: log.topics,
            });
        } catch (err: any) {
            console.error(err);
            continue;
        }
        if (isSameAddress(log.address, runnerAddress)) {
            if (!puzzle) {
                if (decoded.eventName === 'Start') {
                    puzzle = (decoded.args as any).puzzle as string;
                    continue;
                }
            }
            if (decoded.eventName === 'Complete') {
                gasUsed = Number((decoded.args as any).gasUsed as BigInt);
            } else {
                error = tryParseError((decoded.args as any).error);
            }
            continue;
        }
        if (isSameAddress(log.address, puzzle || '')) {
            puzzleEvents.push(decoded as DecodedEvent);
        }
    }
    return {
        gasUsed: gasUsed!,
        puzzleEvents,
        error,
    };
}

function tryParseError(rawError: string): string {
    if (rawError.startsWith('0x08c379a0')) {
        return (decodeAbiParameters(
            parseAbiParameters('string err'),
            `0x${rawError.slice(10)}`,
        ) as any)[0];
    } else if (rawError.startsWith('0x4e487b71')) {
        return 'panic';
    }
    return rawError;
}

function isSameAddress(a: string, b: string): boolean {
    return a.toLowerCase() === b.toLowerCase();
}