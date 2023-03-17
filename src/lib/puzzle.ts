import { provider as createGanacheProvider } from 'ganache';
import type { Abi, AbiEvent } from 'abitype';
import { createPublicClient, createWalletClient, custom, decodeEventLog, getAccount, type Log, type WalletClient } from 'viem';
import runnerCode from '$lib/sol/Runner.sol?raw';
import challengeCode from '$lib/sol/PuzzleBox.sol?raw';

const SIM_VALUE = 1337;
const SOLJSON_URL = 'https://binaries.soliditylang.org/bin/soljson-v0.8.19+commit.7dd6d404.js';

export interface CompilerInput {
    language: string,
    sources: {
        [name: string]: {
            content: string;
        };
    };
    settings: {
        optimizer: {
            enabled: boolean;
            runs: number;
        };
        viaIR?: boolean;
        outputSelection: {
            [file: string]: {
                [contract: string]: string[];
            };
        };
    };
}

export interface ContractCompilerOutput {
    abi: Abi;
    evm: {
        bytecode: { object: string; };
        deployedBytecode: { object: string; };
    };
}

export interface CompilerOutput {
    errors?: Array<
        {
            sourceLocation: {
                file: string;
                start: number;
                end: number;
            };
            type: string;
            severity: 'error' | 'warning' | 'info';
            errorCode: number;
            message: string;
            formattedMessage: string;
        }
    >;
    contracts: {
        [file: string]: {
            [contract: string]: ContractCompilerOutput;
        };
    };
}

export interface DecodedEvent {
    eventName: string,
    args: any | undefined;
}

export interface SimResults {
    gasUsed: number;
    puzzleEvents: DecodedEvent[];
}

export interface ContractCompilerArtifact {
    abi: Abi;
    bytecode: `0x${string}`;
    deployedBytecode: `0x${string}`;
}

export interface CompilerArtifacts {
    puzzle: ContractCompilerArtifact;
    runner: ContractCompilerArtifact;
    solution: ContractCompilerArtifact;
    eventsAbi: Abi;
}

let worker: Worker | undefined;

export function getWorker(): Worker {
    if (!worker) {
        worker = new Worker('/compile.worker.js');
    }
    return worker;
}

export async function compile(solutionSource: string): Promise<CompilerArtifacts> {
    const solcOutput = await solcCompile(createSolcInput({
        'PuzzleBoxSolution.sol': solutionSource,
        'PuzzleBox.sol': challengeCode,
        'Runner.sol': runnerCode,
    }));

    if (solcOutput.errors) {
        const errors = solcOutput.errors.filter(e => e.severity === 'error');
        if (errors.length) {
            throw new Error(`Compilation errors encountered: ${
                errors.map(e => e.formattedMessage).join('\n')
            }`);
        }
    }

    const fromContractOutput = (o: ContractCompilerOutput) => ({
        abi: o.abi,
        bytecode: '0x' + o.evm.bytecode.object,
        deployedBytecode: '0x' + o.evm.deployedBytecode.object,
    });
    return {
        solution: fromContractOutput(solcOutput.contracts['PuzzleBoxSolution.sol']['PuzzleBoxSolution']),
        runner: fromContractOutput(solcOutput.contracts['Runner.sol']['Runner']),
        puzzle: fromContractOutput(solcOutput.contracts['PuzzleBox.sol']['PuzzleBox']),
        eventsAbi: mergeEventAbis(...[
            solcOutput.contracts['PuzzleBox.sol'],
            solcOutput.contracts['Runner.sol'],
        ].map(f => Object.values(f).map(c => c.abi)).flat(1)),
    };
}

function createSolcInput(files: { [file: string]: string }): CompilerInput {
    return {
        language: 'Solidity',
        sources: Object.assign(
            {}, ...Object.entries(files).map(([k, v]) => ({[k]: { content: v }}))
        ),
        settings: {
            optimizer: { enabled: false, runs: 0 },
            outputSelection: {
                '*': { '*': ['evm.deployedBytecode.object', 'evm.bytecode.object', 'abi']},
            },
        },
    };
}

async function solcCompile(input: CompilerInput): Promise<CompilerOutput> {
    const worker = getWorker();
    const jobId = crypto.randomUUID();
    return new Promise((accept, reject) => {
        function handler(this: Worker, event: MessageEvent) {
            if (event.data.jobId == jobId) {
                this.removeEventListener('message', handler);
                accept(event.data.output);
            }
        }
        worker.addEventListener('message', handler);
        worker.postMessage({
            jobId,
            soljson: SOLJSON_URL,
            input,
        });
    });
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
    const pc = createPublicClient({ transport: custom(provider) });
    const wallet = createWalletClient({ transport: custom(provider) });
    let txId = await wallet.deployContract({
        abi: artifacts.runner.abi,
        bytecode: artifacts.runner.bytecode,
        account: getAccount('0x9BE7E7eA695D8e1a9D12f12EA002713F350Cdd41'),
        args: [artifacts.solution.deployedBytecode, BigInt(Math.floor(Math.random() * 2**32))],
        value: BigInt(SIM_VALUE),
        gas: 32e6,
    } as any); // HACK: deployContract param type doesn't define `value`.
    let receipt = await pc.waitForTransactionReceipt({ hash: txId });
    await provider.disconnect();
    return decodeSimResultsFromEvents(artifacts, receipt.contractAddress!, receipt.logs);
}

function mergeEventAbis(...abis: Abi[]): Abi {
    return Object.values(Object.assign(
        {},
        ...abis.map(a => a.filter(e => e.type === 'event'))
            .flat(1)
            .map(e => ({ [(e as AbiEvent).name]: e })),
    ));
}

function decodeSimResultsFromEvents(artifacts: CompilerArtifacts, runnerAddress: string, logs: Log[]): SimResults {
    let puzzleEvents: DecodedEvent[] = [];
    let puzzle: string | undefined;
    let gasUsed: number | undefined;

    for (const log of logs) {
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
                continue;
            }
        }
        if (isSameAddress(log.address, puzzle || '')) {
            puzzleEvents.push(decoded as DecodedEvent);
        }
    }
    return {
        gasUsed: gasUsed!,
        puzzleEvents,
    };
}

function isSameAddress(a: string, b: string): boolean {
    return a.toLowerCase() === b.toLowerCase();
}