export type UpdateCallback = (tick: { dt: number; runningTime: number; }) => boolean;

export interface SequenceHandler {
    enter?(): void;
    update?: UpdateCallback;
    exit?(): void;
}

export class AnimationAbortedError extends Error {
    constructor() {
        super('animation aborted');
    }
}

export interface ISequence {
    update(dt: number): boolean;
    abort(): void;
    isPlaying(): boolean;
}

enum ActionState {
    Idle,
    Started,
    Stopped,
}

export class SequenceAction implements ISequence {
    public static create(items: SequenceHandler | SequenceHandler[]): SequenceAction[] {
        items = Array.isArray(items) ? items : [items];
        return items.map(i => new SequenceAction(i));
    }

    private _state: ActionState = ActionState.Idle;
    private _runningTime: number = 0;
    private _resolve!: (err: any, completed: boolean) => void;
    private _p: Promise<boolean>;

    public constructor(private readonly _handler: SequenceHandler) {
        this._p = new Promise<boolean>((a, r) => {
            this._resolve = (err: any, completed: boolean) => {
                if (err) {
                    return r(err);
                }
                a(completed);
            }
        });
    }

    public wait(): Promise<boolean> {
        return this._p;
    }

    public abort(): void {
        try {
            if (this._state !== ActionState.Stopped) {
                if (this._state === ActionState.Started) {
                    this._state = ActionState.Stopped;
                    if (this._handler.exit) {
                        this._handler.exit();
                    }
                }
                this._resolve(null, false);
            }
        } catch (err) {
            this._resolve(err, false);
            throw err;
        }
    }

    public update(dt: number): boolean {
        if (this._state === ActionState.Stopped) {
            return true;
        }
        try {
            if (this._state === ActionState.Idle) {
                this._state = ActionState.Started;
                if (this._handler.enter) {
                    this._handler.enter();
                }
            }
            let completed = true;
            if (this._handler.update) {
                this._runningTime += dt;
                completed = this._handler.update({ dt, runningTime: this._runningTime });
            }
            if (completed) {
                this._state = ActionState.Stopped;
                if (this._handler.exit) {
                    this._handler.exit();
                }
                this._resolve(null, true);
            }
            return completed;
        } catch (err) {
            this._resolve(err, false);
            throw err;
        }
    }

    public isPlaying(): boolean {
        return this._state === ActionState.Started;
    }
}

export class Sequence implements ISequence {
    private _graph:  ISequence[][] = [];
    private _hasStarted: boolean = false;
    private _resolve: ((err: any, completed: boolean) => void) | undefined;
    private _paused: boolean = false;
    private _playPromise: Promise<boolean> | undefined;

    public then(...seqs: ISequence[]): this {
        this._graph.push(seqs);
        return this;
    }

    public thenPlay(...seqs: ISequence[]): this {
        this.then(...seqs);
        return this.play();
    }

    public pause(): void {
        this._paused = true;
    }

    public resume(): void {
        this._paused = false;
    }

    public wait(): Promise<boolean> {
        if (!this._playPromise) {
            return Promise.resolve(true);
        }
        return this._playPromise;
    }

    public play(): this {
        if (this._hasStarted) {
            this.abort();
        }
        if (this._graph.length === 0) {
            return this;
        }
        this._hasStarted = true;
        this._playPromise = new Promise<boolean>((a, r) => {
            this._resolve = (err, completed) => {
                if (err) {
                    return r(err);
                }
                a(completed);
            };
        });
        return this;
    }

    public update(dt: number): boolean {
        if (!this._hasStarted) {
            return true;
        }
        if (this._paused) {
            return false;
        }
        if (this._graph.length) {
            let completed = true;
            const top = this._graph[0];
            for (const s of top) {
                if (!s.update(dt)) {
                    completed = false;
                }
            }
            if (completed) {
                this._graph.shift();
            }
        }
        if (this._graph.length === 0 && this._hasStarted) {
            this._hasStarted = false;
            const resolve = this._resolve!;
            this._resolve = undefined;
            this._playPromise = undefined;
            resolve!(null, true);
            return true;
        }
        return false;
    }

    public abort(): void {
        if (this._hasStarted) {
            this._hasStarted = false;
            const resolve = this._resolve!;
            this._resolve = undefined;
            this._playPromise = undefined;
            const graph = this._graph.splice(0, this._graph.length);
            for (const n of graph) {
                for (const seq of n) {
                    seq.abort();
                }
            }
            resolve!(null, false);
        }
    }

    public isEmpty(): boolean {
        return this._graph.length === 0;
    }

    public isPlaying(): boolean {
        return this._hasStarted && this._graph.length !== 0;
    }
}

export class MultiSequencer {
    private readonly _channels: Record<string, Sequence> = {};

    public getChannel(name?: string): Sequence {
        name = name || '<default>';
        return this._channels[name] = this._channels[name] || new Sequence();
    }

    public play(): Promise<boolean> {
        const promises = [];
        for (const k in this._channels) {
            const ch = this._channels[k];
            if (!ch.isPlaying()) {
                this._channels[k].play();
            }
            promises.push(this._channels[k].wait());
        }
        return Promise.all(promises).then(r => r.every(s => s));
    }

    public then(...seqs: ISequence[]): this {
        this.getChannel().then(...seqs);
        return this;
    }

    public abort(): this {
        for (const k in this._channels) {
            this._channels[k].abort();
        }
        return this;
    }

    public pause(): this {
        for (const k in this._channels) {
            this._channels[k].pause();
        }
        return this;
    }

    public resume(): this {
        for (const k in this._channels) {
            this._channels[k].resume();
        }
        return this;
    }

    public update(dt: number): this {
        for (const k in this._channels) {
            this._channels[k].update(dt);
        }
        return this;
    }
}
