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
    Euler,
    MeshStandardMaterial,
    MeshPhysicalMaterial,
    Color,
    type ColorRepresentation,
} from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { clamp, degToRad, lerp } from 'three/src/math/MathUtils';

interface AnimatorOpts {
    scene: Scene;
    puzzleBox: Group;
    cameraControl: OrbitControls;
    clips: AnimationClip[];
}

const TORCH_FIRE_ANIMATIONS = [
    'torch-flame-inner',
    'torch-flame-outer',
    'torch-light',
];

const MAX_DRIP_TOKENS = 10;
const MAX_FEES = 100 * [...new Array(10)].map((_, i) => 2**i).reduce((acc, v) => acc + v);
const MAX_SPREAD = 1000;

const DRAGONFLY_PATTERN = [
    0, 0, 0, 1, 0, 0, 0,
    1, 0, 0, 1, 0, 0, 1,
    0, 1, 0, 1, 0, 1, 0,
    0, 0, 1, 1, 1, 0, 0,
    0, 1, 0, 1, 0, 1, 0,
    1, 0, 0, 1, 0, 0, 1,
    0, 0, 0, 1, 0, 0, 0,
];

function isMesh(o: Object3D): o is Mesh {
    return o.type === 'Mesh';
}

export class Animator {
    private _lastUpdateTime: number = 0;
    private readonly _sequencerByName: { [name: string]: Sequencer } = {};
    private readonly _cameraControl: OrbitControls;
    private readonly _mixerByRootName: Record<string, AnimationMixer> = {};
    private readonly _clipsByName: Record<string, AnimationClip>;
    private readonly _materialsByName: Record<string, MeshStandardMaterial>;
    private readonly _puzzleBox: Group;
    
    public constructor(opts: AnimatorOpts) {
        this._cameraControl = opts.cameraControl;
        this._puzzleBox = opts.puzzleBox;
        this._materialsByName = Object.assign(
            {},
            ...(() => {
                const mats: Record<string, Material>[] = [];
                for (const o of this._allObjects()) {
                    if (isMesh(o)) {
                        const mat = o.material as MeshStandardMaterial;
                        mats.push({[mat.name]: mat });
                    }
                }
                return mats;
            })(),
        );
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

    private _getMixer(root: Object3D = this._puzzleBox): AnimationMixer {
        if (!(root.name in this._mixerByRootName)) {
            this._mixerByRootName[root.name] = new AnimationMixer(root);
        }
        return this._mixerByRootName[root.name];
    }

    private _createAnimationAction(
        mixer: AnimationMixer,
        clipName: string,
        opts?: Partial<{ loop: 'loop' | 'bounce' | false; clamp: boolean; timeScale: number; root: Object3D }>,
    ): AnimationAction {
        const clip = this._clipsByName[clipName];
        opts = {
            loop: false,
            clamp: false,
            timeScale: 1.0,
            ...opts,
        };
        let action = mixer.existingAction(clip, opts.root);
        if (!action) {
            action = mixer.clipAction(clip, opts.root);
        }
        if (!opts.loop) {
            action.setLoop(2200, 0);
        } else if (opts.loop === 'bounce') {
            action.setLoop(2202, Infinity);
        } else {
            action.setLoop(2201, Infinity);
        }
        action.clampWhenFinished = !!opts.clamp;
        action.timeScale = opts.timeScale === undefined ? 1.0 : opts.timeScale;
        return action;
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
        // for (const k in this._mixerByRootName) {
        //     this._mixerByRootName[k].update(dt);
        // }
        for (const k in this._sequencerByName) {
            this._sequencerByName[k].update(dt);
        }
        return dt;
    }

    public reset() {
        this.getSequencer('auto-rotate-camera').play([this._animateAutoRotate()]);
        this.getSequencer('idle-box-glow').play([this._animateIdleBoxGlow()]);
        
        for (const o of this._allObjects()) {
            const data = o.userData;
            if (data?.tags) {
                if (typeof(data.tags) === 'string') {
                    data.tags = data.tags.split(/\s+/);
                }
            }
            if (data?.tags?.includes('hidden')) {
                o.visible = false;
            }
        }
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

    private _animateAutoRotate(cooldown: number = 5, speed: number = 18): SequenceHandler {
        const cameraControl = this._cameraControl;
        const camera = cameraControl.object;
        let autoRotateCooldown = 0;
        this._cameraControl.addEventListener('start', () => {
            autoRotateCooldown = Infinity;
        });
        this._cameraControl.addEventListener('end', () => {
            autoRotateCooldown = cooldown;
        });
        return {
            update({ dt }) {
                if (autoRotateCooldown <= 0) {
                    const r = degToRad(speed * dt);
                    camera.applyMatrix4(
                        new Matrix4().makeTranslation(
                            ...cameraControl.target.clone().negate().toArray(),
                        ).multiply(
                            new Matrix4().makeRotationFromEuler(new Euler(0, r, 0)),
                        ).multiply(
                            new Matrix4().makeTranslation(
                                ...cameraControl.target.toArray(),
                            ),
                        ),
                    );
                }
                autoRotateCooldown -= dt;
                return false;
            }
        };
    }

    private _setCoreColor(color: ColorRepresentation) {
        this._materialsByName['glow'].emissive.set(color);
        this._materialsByName['core'].color.set(color);
    }

    private _animateIdleBoxGlow(): SequenceHandler {
        const mixer = this._getMixer(this._getObjectByName('light-leak'));
        const action = this._createAnimationAction(
            mixer,
            'light-leak-idle',
            { loop: 'bounce' },
        );
        action.weight = 0.35;
        action.timeScale = 0.75;
        const glowMat = this._materialsByName['glow'] as MeshPhysicalMaterial;
        this._materialsByName['panel'].color.set('#1a0707');
        this._setCoreColor('#550000');
        let initialOpacity = 1;
        return {
            enter() {
                action.play();
                initialOpacity = glowMat.opacity = 0.75;
                // glowMat.emissive.set('#ff0000');
            },
            update({ dt, runningTime }) {
                mixer.update(dt);
                glowMat.opacity = initialOpacity -
                    (Math.sin(runningTime * Math.PI / 1.75) / 2 + 0.5) * 0.33;
                return false;
            },
            exit() {
                mixer.stopAllAction();
                glowMat.opacity = initialOpacity;
            }
        }

    }

    public animateOperateChallenge(): SequenceHandler {
        return this._animateTopRipple(DRAGONFLY_PATTERN);
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

    public animateOpenChallenge(): SequenceHandler {
        return this._animateTopRipple(DRAGONFLY_PATTERN);
    }

    private _animateTopRipple(design: number[]): SequenceHandler {
        const root = this._getObjectByName('top-panel');
        const cells = root.children.map(c => c as Group);
        const rippleDuration = 1.25;
        const inactiveMat = this._materialsByName['panel'];
        const activeMat = this._materialsByName['cube-active'];
        const mixers = cells.map(c => new AnimationMixer(c));
        const actions = cells.map((v, i) => this._createAnimationAction(
            mixers[i],
            design[i] ? '.cube-ripple-hold' : '.cube-ripple',
            { clamp: true, root: v },
        ));
        const playCellAction = (x: number, y: number) => {
            if (x >= 0 && x <= 6 && y >= 0 && y <= 6) {
                const i = y * 7 + x;
                const a = actions[i];
                if (!a.isRunning()) {
                    a.play();
                    (cells[i].children[1] as Mesh).material = design[i] ? activeMat : inactiveMat;
                }
            }
        }
        return {
            update: ({ dt, runningTime }) => {
                for (const m of mixers) {
                    m.update(dt);
                }
                const t = Math.min(1, runningTime / rippleDuration);
                const i = Math.floor(t * 14);
                for (let j = 0; j <= i; ++j) {
                    playCellAction(i - j, j);
                }
                return t >= 1 && actions.every(a => !a.isRunning());
            },
        }
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