import { Sequencer, type SequenceHandler } from './sequencer';
import {
    AnimationClip,
    AnimationMixer,
    Group,
    Material,
    Matrix4,
    Mesh,
    Quaternion,
    Scene,
    Vector3,
    Object3D,
    Plane,
    type AnimationAction,
} from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { clamp, lerp } from 'three/src/math/MathUtils';
import type { Selection } from 'postprocessing';

interface AnimatorOpts {
    scene: Scene;
    puzzleBox: Group;
    cameraControl: OrbitControls;
    clips: AnimationClip[];
    materials: Record<string, Material>;
}

const TORCH_FIRE_ANIMATIONS = [
    'torch-flame-inner',
    'torch-flame-outer',
    'torch-light',
];

const MAX_DRIP_TOKENS = 10;
const MAX_FEES = 100 * [...new Array(10)].map((_, i) => 2**i).reduce((acc, v) => acc + v);
const MAX_SPREAD = 1000;

const OPERATE_CELLS = invertCellDesign([
    0, 1, 1, 1, 1, 1, 0,
    0, 1, 0, 0, 0, 1, 0,
    0, 1, 1, 1, 1, 1, 0,
    0, 0, 0, 1, 0, 0, 0,
    0, 0, 0, 1, 1, 0, 0,
    0, 0, 0, 1, 0, 0, 0,
    0, 0, 0, 1, 1, 0, 0,
]);
const OPEN_CELLS = [
    0, 0, 0, 1, 0, 0, 0,
    1, 0, 0, 1, 0, 0, 1,
    0, 1, 0, 1, 0, 1, 0,
    0, 0, 1, 1, 1, 0, 0,
    0, 1, 0, 1, 0, 1, 0,
    1, 0, 0, 1, 0, 0, 1,
    0, 0, 0, 1, 0, 0, 0,
];

function invertCellDesign(design: number[]): number[] {
    return design.map(v => v == 0 ? 1 : 0);
}

export class Animator {
    private _lastUpdateTime: number = 0;
    private readonly _sequencerByName: { [name: string]: Sequencer } = {};
    private readonly _cameraControl: OrbitControls;
    private readonly _mixer: AnimationMixer;
    private readonly _clipsByName: { [name: string]: AnimationClip };
    private readonly _materialsByName: { [name: string]: Material };
    private readonly _puzzleBox: Group;
    
    public constructor(opts: AnimatorOpts) {
        this._cameraControl = opts.cameraControl;
        this._mixer = new AnimationMixer(opts.scene);
        this._puzzleBox = opts.puzzleBox;
        this._materialsByName = opts.materials;
        this._clipsByName = Object.assign(
            {},
            ...opts.clips.map(a => {
                if (/^\./.test(a.name)) {
                    for (const t of a.tracks) {
                        const m = /^[^.]+(.+)$/.exec(t.name);
                        if (m) {
                            t.name = m[1];
                        }
                    }
                }
                return { [a.name]: a };
            }),
        );
    }

    private _getMeshByName(name: string): Mesh {
        return this._getObjectByName<Mesh>(name);
    }

    private _getObjectByName<T extends Object3D = Object3D>(name: string): T {
        return this._puzzleBox.getObjectByName(name) as T;
    }

    private _findObjects<T extends Object3D = Object3D>(filter: (o: Object3D) => boolean): T[] {
        const items = [] as T[];
        for (const o of this._allObjects()) {
            if (filter(o)) {
                items.push(o as T);
            }
        }
        return items;
    }

    public getSequencer(name: string): Sequencer {
        if (!(this._sequencerByName[name])) {
            this._sequencerByName[name] = new Sequencer();
        }
        return this._sequencerByName[name];
    }

    public update(): number {
        let dt = Date.now() / 1e3;
        if (this._lastUpdateTime == 0) {
            this._lastUpdateTime = dt;
            dt = 0;
        } else {
            dt -= this._lastUpdateTime;
            this._lastUpdateTime += dt;
        }
        this._mixer.update(dt);
        for (const k in this._sequencerByName) {
            this._sequencerByName[k].update(dt);
        }
        return dt;
    }

    public reset() {
        // for (const o of this._allObjects()) {
        //     this._bloomSelection.add(o);
        //     // if (o.userData['bloom']) {
        //     // } else {
        //     //     this._bloomSelection.delete(o);
        //     // }
        // }
        // {
        //     const cells = this._getObjectByName('grid-cells').children.map(c => c as Mesh);
        //     const inactiveCellMaterial = this._materialsByName['box-basic'];
        //     for (const cell of cells) {
        //         cell.position.y = 0;
        //         cell.material = inactiveCellMaterial;
        //     }
        //     for (const o of this._allObjects()) {
        //         o.visible = o.userData['hide'] === undefined ? true : !o.userData['hide'];
        //     }
        // }
        // this._getSharedAnimationAction('torch-unlock').stop();
        // for (let i = 0; i < MAX_DRIP_TOKENS; ++i) {
        //     this._getSharedAnimationAction(`drip.00${i}`).stop();
        //     this._getSharedAnimationAction(`burn.00${i}`).stop();
        // }
        // {
        //     const coins = this._findObjects((o) => /^coin\d{3}$/.test(o.name));
        //     for (const c of coins) {
        //         this._getSharedAnimationAction('.coin-flip-in', c).stop();
        //         this._getSharedAnimationAction('.coin-flip-out', c).stop();
        //     }
        // }
        // this._getSharedAnimationAction('zip').stop();
    }

    private *_allObjects(root?: Object3D): IterableIterator<Object3D> {
        root = root || this._puzzleBox;
        if (root === this._puzzleBox) {
            yield root;
        }
        for (const c of root.children) {
            yield c;
            for (const o of this._allObjects(c)) {
                yield o;
            }
        }
    }

    public animateReset(): SequenceHandler {
        return {
            enter: () => {
                this.reset();
            },
        };
    }

    public animateWait(seconds: number): SequenceHandler {
        return {
            update({ runningTime }) {
                return runningTime >= seconds;
            }
        }
    }

    public animateCamera(
        endLookDir_: [number, number, number],
        duration: number = 0.5,
    ): SequenceHandler {
        const camera = this._cameraControl.object;
        const origin = this._cameraControl.target.clone();
        const dist = this._cameraControl.getDistance();
        const endLookDir = new Vector3(...endLookDir_).normalize();
        return {
            update: ({ runningTime }) => {
                const toOrigin = origin.clone().sub(camera.position);
                const lookDir = toOrigin.clone().divideScalar(dist);
                if (1 - Math.abs(lookDir.dot(endLookDir)) < 1e-7) {
                    return true;
                }
                const t = runningTime == 0 ? 0 : Math.min(1, runningTime / duration);
                const r = new Quaternion().slerp(
                    new Quaternion().setFromUnitVectors(lookDir, endLookDir),
                    t,
                );
                const newLookDir = lookDir.clone().applyQuaternion(r);
                const newToOrigin = newLookDir.clone().multiplyScalar(dist);
                camera.applyMatrix4(
                    new Matrix4().makeTranslation(...(toOrigin.clone().sub(newToOrigin).toArray()))
                );
                this._cameraControl.update();
                return runningTime >= duration;
            },
        };
    }
    
    public animateRattleBox(): SequenceHandler {
        const action = this._getSharedAnimationAction('rattle', null, { timeScale: 1.25 });
        return {
            enter() { action.stop(); action.play(); },
            update() { return !action.isRunning(); },
        };
    }
    
    public animateOperateChallenge(): SequenceHandler {
        return this._animateTopRipple(OPERATE_CELLS);
    }

    public animateOpenChallenge(): SequenceHandler {
        return this._animateTopRipple(OPEN_CELLS);
    }

    private _animateTopRipple(design: number[]): SequenceHandler {
        const cellsRoot = this._getObjectByName('grid-cells');
        cellsRoot.updateMatrix();
        const cells = cellsRoot.children.map(c => c as Mesh);
        const cellsRootInverse = cellsRoot.matrix.clone().invert();
        const rippleStartObj = this._getObjectByName('grid-ripple-start');
        rippleStartObj.updateMatrix();
        const rippleEndObj = this._getObjectByName('grid-ripple-end');
        rippleEndObj.updateMatrix();
        const rippleStart = new Vector3().applyMatrix4(
            cellsRootInverse.clone().multiply(rippleStartObj.matrix)
        );
        const rippleEnd = new Vector3().applyMatrix4(
            cellsRootInverse.clone().multiply(rippleEndObj.matrix)
        );
        const inactiveMat = this._materialsByName['box-basic'];
        const activeMat = this._materialsByName['grid-activated'];
        const rippleDuration = 1.5;
        const rippleDir = new Vector3().subVectors(rippleEnd, rippleStart).normalize();
        const up = new Vector3(0, 1, 0);
        const rippleSurfacePlane = new Plane().setFromNormalAndCoplanarPoint(
            new Vector3().crossVectors(rippleDir, up).normalize().cross(rippleDir),
            rippleStart,
        );
        return {
            update: ({ runningTime }) => {
                const ripplePos = rippleStart
                    .clone()
                    .lerp(rippleEnd, Math.min(1, runningTime / rippleDuration));
                const ripplePlane = new Plane().setFromNormalAndCoplanarPoint(
                    rippleDir,
                    ripplePos,
                );
                const p = new Vector3();
                for (const [i, cell] of cells.entries()) {
                    const maxY = rippleSurfacePlane.projectPoint(cell.position, p).y;
                    const d = ripplePlane.distanceToPoint(p);
                    let y = lerp(0, maxY, clamp(1 - Math.abs(d), 0, 1) ** 2);
                    if (d <= 0) {
                        if (design[i]) {
                            y = Math.max(y, maxY * 0.15);
                            cell.material = activeMat;
                        } else {
                            cell.material = inactiveMat;
                        }
                    }
                    cell.translateY(y - cell.position.y);
                }
                return runningTime >= rippleDuration;
            }
        }
    }

    private _getSharedAnimationAction(
        clipName: string,
        root?: Object3D | null,
        opts?: Partial<{ loop: boolean; clamp: boolean; timeScale: number; }>,
    ): AnimationAction {
        const clip = this._clipsByName[clipName];
        let action = this._mixer!.existingAction(clip, root || undefined);
        if (!action) {
            action = this._mixer!.clipAction(clip, root || undefined);
            opts = {
                loop: false,
                clamp: false,
                timeScale: 1.0,
                ...opts,
            };
        }
        if (opts) {
            action.setLoop(opts.loop ? 1 : 0, opts.loop ? 10000 : 1);
            action.clampWhenFinished = !!opts.clamp;
            action.timeScale = opts.timeScale === undefined ? 1.0 : opts.timeScale;
        }
        return action;
    }

    public animateDripChallenge(dripIds: number[]): SequenceHandler {
        const actions = dripIds.map(id => this._getSharedAnimationAction(
            `drip.00${id - 1}`,
            null,
            { clamp: true, timeScale: 0.5 },
        ));
        return {
            enter() {
                for (const a of actions) {
                    a.stop();
                    a.play();
                }
            },
            update() { return actions.every(a => !a.isRunning()); },
        };
    }

    public animateBurnChallenge(dripId: number): SequenceHandler {
        const burnEffectAction = this._getSharedAnimationAction('burn-effect', null, { timeScale: 1.5 });
        const dripTokenAction = this._getSharedAnimationAction(`drip.00${dripId - 1}`);
        const burnTokenAction = this._getSharedAnimationAction(`burn.00${dripId - 1}`, null, { timeScale: 1.5 });
        let burnTokenActionCompleted = false;
        return {
            enter() {
                dripTokenAction.stop();
                burnTokenAction.stop();
                burnTokenAction.play();
            },
            update() {
                if (!burnTokenAction.isRunning()) {
                    if (!burnTokenActionCompleted) {
                        burnTokenActionCompleted = true;
                        burnEffectAction.stop();
                        burnEffectAction.play();
                    }
                    return !burnEffectAction.isRunning();
                }
                return false;
            },
        };
    }

    public animateLockChallenge(): SequenceHandler {
        const torchUnlockAction = this._getSharedAnimationAction(
            'torch-unlock',
            null,
            { clamp: true },
        );
        return {
            enter() {
                torchUnlockAction.stop();
                torchUnlockAction.play();
            },
            update() {
                return !torchUnlockAction.isRunning();
            },
        };
    }

    public animateTorchChallenge(duration=2.0): SequenceHandler {
        const fire = this._getMeshByName('torch-fire');
        const glow = this._getMeshByName('torch-glow');
        const actions = TORCH_FIRE_ANIMATIONS.map(n => this._getSharedAnimationAction(n, null, { loop: true }));
        return {
            enter() {
                fire.visible = true;
                glow.visible = true;
                for (const a of actions) {
                    a.stop();
                    a.play();
                }
            },
            update({ runningTime }) {
                return runningTime >= duration;
            }
        };
    }

    public animateTakeFees(fees: number): SequenceHandler {
        const coins = this._findObjects((o) => /^coin\d{3}$/.test(o.name));
        let maxCoinIdx = 0;
        {
            let x = fees;
            for (let d = 100; d < MAX_FEES && fees / d >= 1; d *= 2, ++maxCoinIdx) ;
            maxCoinIdx = Math.floor(Math.min(1, maxCoinIdx / MAX_DRIP_TOKENS) * coins.length);
        }
        const animatedCoins = coins.slice(0, maxCoinIdx);
        const actions = animatedCoins.map(c => this._getSharedAnimationAction('.coin-flip-in', c, { clamp: true }));
        return {
            update({ runningTime }) {
                let i = Math.floor(runningTime / COIN_FLIP_DELAY);
                if (i < actions.length && !actions[i].isRunning()) {
                    actions[i].stop().play();
                }
                return i >= actions.length && actions.every(a => !a.isRunning());
            },
        };
    }

    public animateSpreadChallenge(spreadAmount: number, remaining: number): SequenceHandler {
        const coins = this._findObjects((o) => /^coin\d{3}$/.test(o.name));
        const maxCoinIdx = Math.ceil(Math.min(1, (spreadAmount + remaining) / MAX_SPREAD) * coins.length);
        const minCoinIdx = Math.floor((remaining / MAX_SPREAD) * coins.length);
        const animatedCoins = coins.slice(minCoinIdx, maxCoinIdx).reverse();
        const inActions = animatedCoins.map(c => this._getSharedAnimationAction('.coin-flip-in', c));
        const outActions = animatedCoins.map(c => this._getSharedAnimationAction('.coin-flip-out', c, { clamp: true }));
        return {
            update({ runningTime }) {
                let i = Math.floor(runningTime / COIN_FLIP_DELAY);
                if (i < outActions.length && !outActions[i].isRunning()) {
                    inActions[i].stop();
                    outActions[i].stop().play();
                }
                return i >= outActions.length && outActions.every(a => !a.isRunning());
            },
        };
    }

    public animateZipChallenge(duration: number = 1.5): SequenceHandler {
        const action = this._getSharedAnimationAction('zip', null, { loop: true });
        return {
            enter() { action.stop().play(); },
            update({runningTime}) {
                return runningTime >= duration;
            }
        };
    }
}

const COIN_FLIP_DELAY = 0.1;