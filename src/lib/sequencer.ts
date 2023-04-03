export type UpdateCallback = (tick: { dt: number; runningTime: number; }) => boolean;

export interface SequenceHandler {
    enter?(): void;
    update?: UpdateCallback;
    exit?(): void;
}

interface SequenceStep {
    started: boolean;
    runningTime: number;
    handler: SequenceHandler;
}

export class AnimationAbortedError extends Error {
    constructor() {
        super('animation aborted');
    }
}

export class Sequencer {
    private _currentStepIdx: number = 0;
    private _currentSequencePromise: Promise<void> | null = null;
    private _currentSequenceOnComplete: (() => void) | null = null;
    private _currentSequenceOnAbort: (() => void) | null = null;
    private _currentSequence: SequenceStep[] | null = null;
    private _isPaused: boolean = false;
    public loop: boolean = false;

    public update(dt: number): number {
        if (this._isPaused) {
            return 0;
        }
        const step = this._currentStep;
        if (step) {
            const { handler } = step;
            if (!step.started) {
                step.started = true;
                if (handler.enter) {
                    handler.enter();
                }
            }
            step.runningTime += dt;
            let completed = true;
            if (handler.update) {
                completed = handler.update({ dt, runningTime: step.runningTime });
            }
            if (completed) {
                ++this._currentStepIdx;
                if (handler.exit) {
                    handler.exit();
                }
            }
        }
        if (!this._currentStep) {
            if (!this.loop) {
                this._stop(true);
            } else {
                this.reset();
            }
        }
        return dt;
    }

    public pause(): void {
        this._isPaused = true;
    }

    public resume(): void {
        this._isPaused = false;
    }
    
    public stop(): void {
        this._stop(true);
    }

    public reset(): void {
        this._currentStepIdx = 0;
        for (const step of this._currentSequence || []) {
            step.started = false;
            step.runningTime = 0;
        }
    }

    private _stop(completed: boolean): void {
        const step = this._currentStep;
        const onComplete = this._currentSequenceOnComplete;
        const onAbort = this._currentSequenceOnAbort;
        this._currentStepIdx = 0;
        this._currentSequence = null;
        this._currentSequenceOnComplete = null;
        this._currentSequenceOnAbort = null;
        this._currentSequencePromise = null;
        if (step) {
            const { handler } = step;
            if (step.started) {
                if (handler.exit) {
                    handler.exit();
                }
            }
        }
        if (completed) {
            if (onComplete) {
                onComplete();
            }
        } else {
            if (onAbort) {
                onAbort();
            }
        }
    }

    public play(items: SequenceHandler[]): Promise<void> {
        this._stop(false);
        this._currentSequencePromise = new Promise<void>((accept, reject) => {
            this._currentSequenceOnComplete = () => accept();
            this._currentSequenceOnAbort = () => reject(new AnimationAbortedError());
        });
        this._currentSequence = items.map(h => ({
            handler: h,
            started: false,
            runningTime: 0,
        }));
        this.update(0);
        return this._currentSequencePromise;
    }

    public extend(items: SequenceHandler[]): Promise<void> {
        if (!this.isPlaying) {
            return this.play(items);
        }
        this._currentSequence?.push(...items.map(h => ({
            handler: h,
            started: false,
            runningTime: 0,
        })));
        return this._currentSequencePromise!;
    }

    public get isPlaying(): boolean {
        return !!this._currentStep;
    }

    private get _currentStep(): SequenceStep | null {
        return this._currentSequence?.[this._currentStepIdx] || null;
    }
}

export class MultiSequencer {
    private readonly _channels: Record<string, Sequencer> = {};
    private _loop: boolean = false;

    private _getChannel(name: string): Sequencer {
        return this._channels[name] = this._channels[name] || new Sequencer();
    }

    public getChannel(name: string): Sequencer {
        return this._channels[name];
    }

    public play(channel: string | null, items: SequenceHandler[]): Promise<void> {
        return this._getChannel(channel || '<default>').play(items);
    }

    public extend(channel: string | null, items: SequenceHandler[]): Promise<void> {
        return this._getChannel(channel || '<default>').extend(items);
    }

    public stop(): void {
        for (const k in this._channels) {
            this._channels[k].stop();
        }
    }

    public pause(): void {
        for (const k in this._channels) {
            this._channels[k].pause();
        }
    }

    public resume(): void {
        for (const k in this._channels) {
            this._channels[k].resume();
        }
    }

    public reset(): void {
        for (const k in this._channels) {
            this._channels[k].reset();
        }
    }

    public update(dt: number): void {
        for (const k in this._channels) {
            this._channels[k].update(dt);
        }
    }

    public get loop(): boolean {
        return this._loop;
    }

    public set loop(v: boolean) {
        this._loop = v;
        for (const k in this._channels) {
            this._channels[k].loop = v;
        }
    }

    public get isPlaying(): boolean {
        return Object.values(this._channels).some(c => c.isPlaying);
    }
}

export function wrapSequencer(seq: Sequencer): SequenceHandler {
    return {
        enter() {
            seq.update(0);
        },
        update(args) {
            seq.update(args.dt);
            return !seq.isPlaying;
        },
        exit() {
            seq.stop();
        }
    };
}