import type { Abi, AbiEvent } from 'abitype';
import runnerCode from './sol/Runner.sol?raw';
import challengeCode from './sol/PuzzleBox.sol?raw';

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

export type Compiler = (input: CompilerInput) => Promise<CompilerOutput>;

export async function compile(solutionSource: string, compiler: Compiler): Promise<CompilerArtifacts> {
    const solcOutput = await compiler(createSolcInput({
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

    const fromContractOutput = (filename: string, contractName: string): ContractCompilerArtifact => {
        const output = solcOutput.contracts?.[filename]?.[contractName];
        if (!output) {
            throw new Error(`Missing artifact: ${filename}:${contractName}`);
        }
        return {
            abi: output.abi,
            bytecode: `0x${output.evm.bytecode.object}`,
            deployedBytecode: `0x${output.evm.deployedBytecode.object}`,
        };
    };
    return {
        solution: fromContractOutput('PuzzleBoxSolution.sol', 'PuzzleBoxSolution'),
        runner: fromContractOutput('Runner.sol', 'Runner'),
        puzzle: fromContractOutput('PuzzleBox.sol', 'PuzzleBox'),
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

function mergeEventAbis(...abis: Abi[]): Abi {
    return Object.values(Object.assign(
        {},
        ...abis.map(a => a.filter(e => e.type === 'event'))
            .flat(1)
            .map(e => ({ [(e as AbiEvent).name]: e })),
    ));
}
