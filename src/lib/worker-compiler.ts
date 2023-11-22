import { base } from '$app/paths';
import type { CompilerInput, CompilerOutput } from './compile';

const SOLJSON_URL = 'soljson-v0.8.19+commit.7dd6d404.js';

let worker: Worker | undefined;

export function getWorker(): Worker {
    if (!worker) {
        worker = new Worker(`${base}/compile.worker.js`);
    }
    return worker;
}

export async function solcCompile(input: CompilerInput): Promise<CompilerOutput> {
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