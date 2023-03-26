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
        const p = new Promise<void>((accept, reject) => {
            this._currentSequenceOnComplete = () => accept();
            this._currentSequenceOnAbort = () => reject(new AnimationAbortedError());
        });
        this._currentSequence = items.map(h => ({
            handler: h,
            started: false,
            runningTime: 0,
        }));
        this.update(0);
        return p;
    }

    public get isPlaying(): boolean {
        return !!this._currentStep;
    }

    private get _currentStep(): SequenceStep | null {
        return this._currentSequence?.[this._currentStepIdx] || null;
    }
}