import { MultiSequencer, Sequence, SequenceAction, type ISequence, type SequenceHandler } from './sequencer';
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
const MAX_SPREAD = 1000;
const BLACK = new Color(0,0,0);

function getTrueFeeAmount(scaled: number): number {
    let fee = 100;
    if (scaled < fee) {
        return 0;
    }
    let acc = 0;
    for (let i = 0; i < 10; ++i, fee *= 2) {
        acc += fee;
        if (scaled <= acc) {
            return (i + 1) * 100;
        }
    }
    return 1000;
}

const DRAGONFLY_PATTERN = [
    0, 0, 0, 1, 0, 0, 0,
    1, 0, 0, 1, 0, 0, 1,
    0, 1, 0, 1, 0, 1, 0,
    0, 0, 1, 1, 1, 0, 0,
    0, 1, 0, 1, 0, 1, 0,
    1, 0, 0, 1, 0, 0, 1,
    0, 0, 0, 1, 0, 0, 0,
];

const COLORS = {
    INITIAL_DARK: new Color('#100000'),
    INITIAL_LIGHT: new Color('#990000'),
    OPERATE_DARK: new Color('#001700'),
    OPERATE_LIGHT: new Color('#11ff88'),
    SPREAD_BAR_START_COLOR: new Color('#222'),
};

function isMesh(o: Object3D): o is Mesh {
    return o.type === 'Mesh';
}

function parseTags(raw: string | undefined | Record<string, boolean>): Record<string, boolean> {
    if (!raw) {
        return {};
    }
    if (typeof(raw) === 'string') {
        return Object.assign(
            {},
            ...raw.split(/\s+/).map(v => ({ [v]: true }) ),
        );
    }
    return raw;
}

interface CachedMixer {
    mixer: AnimationMixer;
    requestUpdate: boolean;
    ambient: boolean;
}

export class Animator {
    private _lastUpdateTime: number = 0;
    private readonly _cameraControl: OrbitControls;
    private readonly _cachedMixerByRootName: Record<string, CachedMixer> = {};
    private readonly _clipsByName: Record<string, AnimationClip>;
    private readonly _puzzleBox: Group;
    private readonly _sequencer: MultiSequencer = new MultiSequencer();
    private readonly _originalMaterials: Record<string, MeshStandardMaterial> = {};
    private _lastInteractTime = 0;
    
    public constructor(opts: AnimatorOpts) {
        this._cameraControl = opts.cameraControl;
        this._puzzleBox = opts.puzzleBox;
        this._originalMaterials = Object.assign(
            {},
            ...(() => {
                const mats: Record<string, Material>[] = [];
                for (const o of this._allObjects()) {
                    if (isMesh(o)) {
                        const mat = o.material as MeshStandardMaterial;
                        mat.userData.tags = parseTags(mat.userData.tags);
                        mats.push({[mat.name]: mat.clone() });
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
        for (const o of this._allObjects()) {
            const data = o.userData || {};
            data.tags = parseTags(data.tags || {});
            if (isMesh(o)) {
                if (data.tags['unique-mat']) {
                    o.material = (o.material as Material).clone();
                }
            }
            o.userData = data;
        }
        this._cameraControl.addEventListener('start', () => {
            this._lastInteractTime = Infinity;
        });
        this._cameraControl.addEventListener('end', () => {
            this._lastInteractTime = Date.now() / 1e3;
        });
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

    private _getMixer(root: Object3D = this._puzzleBox): AnimationMixer {
        if (!(root.name in this._cachedMixerByRootName)) {
            this._cachedMixerByRootName[root.name] = {
                mixer: new AnimationMixer(root),
                requestUpdate: false,
                ambient: false,
            };
        }
        return this._cachedMixerByRootName[root.name].mixer;
    }

    private _touchMixer(mixer: AnimationMixer, ambient: boolean = false): void {
        const c = this._cachedMixerByRootName[(mixer.getRoot() as Object3D).name];
        c.requestUpdate = true;
        if (ambient) {
            c.ambient = true;
        }
    }

    private _createAnimationAction(
        mixer: AnimationMixer,
        clipName: string,
        opts?: Partial<{
            loop: 'loop' | 'bounce' | false;
            clamp: boolean;
            timeScale: number;
            root: Object3D;
            repeat: number;
            blendMode: 'normal' | 'additive';
        }>,
    ): AnimationAction {
        const clip = this._clipsByName[clipName];
        opts = {
            loop: false,
            clamp: false,
            timeScale: 1.0,
            blendMode: 'normal',
            repeat: Infinity,
            ...opts,
        };
        let action = mixer.existingAction(clip, opts.root);
        if (!action) {
            action = mixer.clipAction(clip, opts.root);
        }
        if (!opts.loop) {
            action.setLoop(2200, 0);
        } else if (opts.loop === 'bounce') {
            action.setLoop(2202, opts.repeat!);
        } else {
            action.setLoop(2201, opts.repeat!);
        }
        action.clampWhenFinished = !!opts.clamp;
        action.timeScale = opts.timeScale === undefined ? 1.0 : opts.timeScale;
        action.blendMode = opts.blendMode === 'normal' ? 2500 : 2501;
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
        // for (const k in this._cachedMixerByRootName) {
        //     this._cachedMixerByRootName[k].update(dt);
        // }
        this._sequencer.update(dt);
        for (const k in this._cachedMixerByRootName) {
            const mixer = this._cachedMixerByRootName[k];
            if (mixer.requestUpdate || mixer.ambient) {
                mixer.requestUpdate = false;
                mixer.mixer.update(dt);
            }
        }
        return dt;
    }

    public reset() {
        this._sequencer.abort();
        this._setCoreColor(COLORS.INITIAL_DARK, COLORS.INITIAL_LIGHT);
        this._animateAutoRotate();
        this._animateIdleBoxGlow();
        
        for (const o of this._allObjects()) {
            if (o.userData.tags?.['hidden']) {
                o.visible = false;
            }
            if (isMesh(o)) {
                if (o.name.startsWith('spread-progress-glow')) {
                    (o.material as MeshStandardMaterial).opacity = 0;
                } else if (o.name.startsWith('spread-progress')) {
                    (o.material as MeshStandardMaterial).emissive.copy(COLORS.SPREAD_BAR_START_COLOR);
                }
            }
        }
    }

    public wait(): Promise<boolean> {
        return this._sequencer.getChannel().wait();
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

    private _animateAutoRotate(cooldown: number = 3, speed: number = 18): void {
        const cameraControl = this._cameraControl;
        const camera = cameraControl.object;
        this._sequencer.getChannel('auto-rotate').then(
            new SequenceAction({
                update: ({ dt }) => {
                    const timeSinceInteract = Date.now() / 1e3 - this._lastInteractTime;
                    if (timeSinceInteract >= cooldown) {
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
                    return false;
                },
            }),
        ).play();
    }

    private _setCoreColor(darkColor: Color, lightColor: Color) {
        const updateMaterial = (mat: MeshStandardMaterial) => {
            if (mat.userData.tags?.['core']) {
                const c = mat.userData.tags?.['dark'] ? darkColor : lightColor;
                if (mat.emissive.equals(BLACK)) {
                    mat.color.set(c);
                } else {
                    mat.emissive.set(c);
                }
            }
        };
        for (const o of this._allObjects()) {
            if (isMesh(o)) {
                updateMaterial(o.material as MeshStandardMaterial);
            }
        }
        for (const k in this._originalMaterials) {
            updateMaterial(this._originalMaterials[k]);
        }
    }

    private _animateIdleBoxGlow(): void {
        const mixer = this._getMixer(this._getObjectByName('light-leak'));
        const action = this._createAnimationAction(
            mixer,
            'light-leak-idle',
            { loop: 'bounce', blendMode: 'additive' },
        );
        action.weight = 0.35;
        action.timeScale = 0.75;
        const glowMat = this._getMeshByName('light-leak').material as MeshStandardMaterial;
        let initialOpacity = 1;
        this._sequencer.getChannel('box-glow').then(
            new SequenceAction({
                enter() {
                    action.play();
                    initialOpacity = glowMat.opacity = 0.75;
                },
                update: ({ dt, runningTime }) => {
                    this._touchMixer(mixer);
                    glowMat.opacity = initialOpacity -
                        (Math.sin(runningTime * Math.PI / 1.75) / 2 + 0.5) * 0.33;
                    return false;
                },
                exit() {
                    mixer.stopAllAction();
                    glowMat.opacity = initialOpacity;
                }
            }),
        ).play();
    }

    public animateOperateChallenge(): this {
        this._sequencer
            .then(
                this._createCameraSequence([0.55, -0.58, -0.60]),
            ).then(
                this._createTopRippleSequence(DRAGONFLY_PATTERN),
            ).then(
                new SequenceAction({
                    update: ({ runningTime }) => {
                        const t = Math.min(1, runningTime / 0.25);
                        this._setCoreColor(
                            COLORS.INITIAL_DARK.clone().lerp(COLORS.OPERATE_DARK, t),
                            COLORS.INITIAL_LIGHT.clone().lerp(COLORS.OPERATE_LIGHT, t),
                        );
                        return t >= 1;
                    },
                }),
                this._createFlashSequence(),
        ).play();
        return this;
    }

    private _createFlashSequence(): ISequence {
        const light = this._getMeshByName('light-leak');
        const mixer = this._getMixer(light);
        const action = this._createAnimationAction(
            mixer,
            'light-leak-expand', {blendMode: 'additive'},
        );
        action.weight = 0.5;
        action.timeScale = 1.25;
        return new SequenceAction({
                enter() {
                    action.stop(); action.play();
                },
                update: () => {
                    this._touchMixer(mixer);
                    return !action.isRunning();
                },
            },
        );
    }

    public animateCamera(
        endLookDir_: [number, number, number],
        duration: number = 0.5,
    ): this {
        this._sequencer
            .then(this._createCameraSequence(endLookDir_, duration))
            .play();
        return this;
    }

    public animateUnlockTorchChallenge(): this {
        const glow = this._getMeshByName('torch-glow');
        const mixer = this._getMixer(this._getObjectByName('torch-panel'));
        const action = this._createAnimationAction(
            mixer,
            'torch-unlock',
            {  clamp: true },
        );
        const duration = action.timeScale * action.getClip().duration;
        this._sequencer
            .then(this._createCameraSequence([-0.60, -0.33, -0.73]))
            .then(new SequenceAction({
                enter() {
                    glow.visible = true;
                    (glow.material as MeshStandardMaterial).opacity = 0;
                    action.stop(); action.play();
                },
                update: ({dt, runningTime}) => {
                    this._touchMixer(mixer, true);
                    (glow.material as MeshStandardMaterial).opacity =
                        Math.min(1, runningTime / duration);
                    return !action.isRunning();
                },
            }),
            this._createFlashSequence(),
        ).play();
        return this;
    }

    private _createCameraSequence(
        endLookDir_: [number, number, number],
        duration: number = 0.5,
    ): ISequence {
        const camera = this._cameraControl.object;
        const origin = this._cameraControl.target.clone();
        const dist = this._cameraControl.getDistance();
        const endLookDir = new Vector3(...endLookDir_).normalize();
        const xz = new Vector3(1,1,0).normalize();
        return new SequenceAction(
            {
                update: ({ runningTime }) => {
                    this._lastInteractTime = Date.now() / 1e3;
                    const toOrigin = origin.clone().sub(camera.position);
                    const lookDir = toOrigin.clone().divideScalar(dist);
                    if (1 - Math.abs(lookDir.dot(endLookDir)) < 1e-7) {
                        return true;
                    }
                    const t = runningTime == 0 ? 0 : Math.min(1, runningTime / duration);
                    // TODO: restrict to y then xz rotation.
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
            },
        );
    }
    
    // public animateRattleBox(): SequenceHandler {
    //     const action = this._getSharedAnimationAction('rattle', null, { timeScale: 1.25 });
    //     return {
    //         enter() { action.stop(); action.play(); },
    //         update() { return !action.isRunning(); },
    //     };
    // }

    // public animateOpenChallenge(): Promise<boolean> {
    //     return this._createTopRippleSequence(DRAGONFLY_PATTERN);
    // }

    private _createTopRippleSequence(design: number[]): ISequence {
        const root = this._getObjectByName('top-panel');
        const cells = root.children.map(c => c as Group);
        const rippleDuration = 1.25;
        const inactiveMat = this._originalMaterials['panel'] as Material;
        const activeMat = this._originalMaterials['cube-active'] as Material;
        const mixers = cells.map(c => this._getMixer(c));
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
                    a.stop(); a.play();
                    (cells[i].children[1] as Mesh).material = design[i] ? activeMat : inactiveMat;
                }
            }
        }
        return new SequenceAction(
            {
                update: ({ runningTime }) => {
                    for (const m of mixers) {
                        this._touchMixer(m);
                    }
                    const t = Math.min(1, runningTime / rippleDuration);
                    const i = Math.floor(t * 14);
                    for (let j = 0; j <= i; ++j) {
                        playCellAction(i - j, j);
                    }
                    return t >= 1 && actions.every(a => !a.isRunning());
                },
            },
        );
    }

    private _getMeshMaterialByMeshName(meshName: string): MeshStandardMaterial {
        return this._getMeshByName(meshName).material as MeshStandardMaterial;
    }

    public animateDripChallenge(numOldDripIds: number, newDripIds: number[], duration: number = 1.0): this {
        const dripIdMaterials = newDripIds.map(id => [
                this._getMeshMaterialByMeshName(`drip-path00${id - 1}`),
                this._getMeshMaterialByMeshName(`drip-point00${id - 1}`),
        ]);
        const dripGlowAction = this._createAnimationAction(
            this._getMixer(this._getMeshByName('drip-path-glow')),
            'drip-path-glow',
            { blendMode: 'additive' },
        );
        const glowMaterial = this._getMeshMaterialByMeshName('drip-path-glow');
        const f1 = numOldDripIds / 10;
        const f2 = (numOldDripIds + newDripIds.length) / 10
        const initialGlowEmmisive: Color = new Color().lerpColors(
            this._originalMaterials[glowMaterial.name].emissive,
            this._originalMaterials[glowMaterial.name].emissive.clone().multiplyScalar(2),
            f1,
        );
        const targetGlowEmissive: Color = new Color().lerpColors(
            this._originalMaterials[glowMaterial.name].emissive,
            this._originalMaterials[glowMaterial.name].emissive.clone().multiplyScalar(2),
            f2,
        );
        this._sequencer
            .then(this._createCameraSequence([-0.82, -0.39, -0.42]))
            .then(new SequenceAction({
                enter() {
                    if (numOldDripIds === 0) {
                        dripGlowAction.weight = f2;
                        dripGlowAction.play();
                    }
                },
                update: ({ runningTime }) => {
                    this._touchMixer(dripGlowAction.getMixer());
                    const t = Math.min(1, runningTime / duration);
                    for (const mats of dripIdMaterials) {
                        for (const mat of mats) {
                            mat.opacity = t;
                        }
                    }
                    if (numOldDripIds !== 0) {
                        dripGlowAction.weight = lerp(f1, f2, t);
                    }
                    glowMaterial.emissive.lerpColors(initialGlowEmmisive, targetGlowEmissive, t);
                    return t >= 1;
                },
            })).play();
        return this;
    }

    public animateBurn(
        numOldDripIds: number,
        oldTotalBurned: number,
        burnDripIds: number[],
        duration: number = 1.0,
    ): this {
        const dripIdMaterials = burnDripIds.map(id => [
                this._getMeshMaterialByMeshName(`drip-path00${id - 1}`),
                this._getMeshMaterialByMeshName(`drip-point00${id - 1}`),
        ]);
        const dripCenterMaterial = this._getMeshMaterialByMeshName('drip-center');
        const dripGlowAction = this._createAnimationAction(
            this._getMixer(this._getMeshByName('drip-path-glow')),
            'drip-path-glow',
            { blendMode: 'additive' },
            );
        const dripCenterGlowAction = this._createAnimationAction(
            dripGlowAction.getMixer(),
            'drip-path-center-glow',
            { blendMode: 'additive' },
        );
        const glowMaterial = this._getMeshMaterialByMeshName('drip-path-glow');
        const f1 = numOldDripIds / 10;
        const f2 = (numOldDripIds - burnDripIds.length) / 10
        const ff1 = oldTotalBurned / 10;
        const ff2 = (oldTotalBurned + burnDripIds.length) / 10;
        const initialGlowEmmisive: Color = new Color().lerpColors(
            this._originalMaterials[glowMaterial.name].emissive,
            this._originalMaterials[glowMaterial.name].emissive.clone().multiplyScalar(2),
            f1,
        );
        const targetGlowEmissive: Color = new Color().lerpColors(
            this._originalMaterials[glowMaterial.name].emissive,
            this._originalMaterials[glowMaterial.name].emissive.clone().multiplyScalar(2),
            ff2,
        );
        this._sequencer
            .then(this._createCameraSequence([-0.82, -0.39, -0.42]))
            .then(new SequenceAction({
                enter() {
                    if (oldTotalBurned === 0) {
                        dripCenterGlowAction.weight = ff2;
                        dripCenterGlowAction.stop(); dripCenterGlowAction.play();
                    }
                },
                update: ({ runningTime }) => {
                    this._touchMixer(dripCenterGlowAction.getMixer());
                    const t = Math.min(1, runningTime / duration);
                    glowMaterial.emissive.lerpColors(initialGlowEmmisive, targetGlowEmissive, t);
                    dripCenterMaterial.opacity = lerp(ff1, ff2, t);
                    dripGlowAction.weight = lerp(f1, f2, t);
                    if (oldTotalBurned !== 0) {
                        dripCenterGlowAction.weight = lerp(ff1, ff2, t);
                    }
                    for (const mats of dripIdMaterials) {
                        for (const mat of mats) {
                            mat.opacity = 1 - t;
                        }
                    }
                    return t >= 1;
                },
            })).play();
        return this;
    }

    public animateTakeFee(prevFees: number, fees: number, duration: number = 0.5): this {
        const oldRatio = Math.min(1, getTrueFeeAmount(prevFees) / 999);
        const newRatio = Math.min(1, getTrueFeeAmount(prevFees + fees) / 999);
        const newBarsStart = Math.round(oldRatio * 12);
        const newBarsEnd = Math.round(newRatio * 12);
        const targetEmissive = this._originalMaterials['spread-glow'].emissive;
        const newBarMaterials: MeshStandardMaterial[] = [];
        const newBarGlowMaterials: MeshStandardMaterial[] = [];
        for (let i = newBarsStart; i < newBarsEnd; ++i) {
            const suffix = String(i).padStart(3, '0');
            newBarMaterials.push(this._getMeshMaterialByMeshName(`spread-progress${suffix}`));
            newBarGlowMaterials.push(this._getMeshMaterialByMeshName(`spread-progress-glow${suffix}`));
        }
        const durationPerBar = duration / (newBarsEnd - newBarsStart);
        this._sequencer
            .then(this._createCameraSequence([0.90, -0.28, -0.35]))
            .then(new SequenceAction({
                update({ runningTime }) {
                    for (let i = 0; i < newBarGlowMaterials.length; ++i) {
                        const t = clamp(
                            (runningTime - durationPerBar * i) / durationPerBar,
                            0,
                            1,
                        );
                        newBarGlowMaterials[i].opacity = t;
                        newBarMaterials[i].emissive
                            .lerpColors(COLORS.SPREAD_BAR_START_COLOR, targetEmissive, t);
                    }
                    return runningTime >= duration;
                }
            })).play();
        return this;
    }

    public animateSpreadChallenge(amount: number): this {
        const lastBarIdx = Math.round(12 * amount / 1000);
        const barActions: AnimationAction[] = [];
        const glowActions: AnimationAction[] = [];
        for (let i = 0; i < lastBarIdx; ++i) {
            const suffix = String(i).padStart(3, '0');
            const bar = this._getMeshByName(`spread-progress${suffix}`);
            const glow = this._getMeshByName(`spread-progress-glow${suffix}`);
            barActions.push(this._createAnimationAction(
                this._getMixer(bar),
                '.spread-spread',
                { timeScale: 2, clamp: true }
            ));
            glowActions.push(this._createAnimationAction(
                this._getMixer(glow),
                '.spread-spread',
                { timeScale: 2, clamp: true }
            ));
        }
        let numBarsPlayed = 0;
        const delayPerBar = 0.2;
        this._sequencer
            .then(this._createCameraSequence([0.90, -0.28, -0.35]))
            .then(new SequenceAction({
                update: ({ runningTime }) => {
                    const maxPlayBar = Math.min(lastBarIdx, Math.round(runningTime / delayPerBar));
                    for (let i = 0; i < maxPlayBar; ++i) {
                        this._touchMixer(barActions[i].getMixer());
                        this._touchMixer(glowActions[i].getMixer());
                        if (numBarsPlayed <= i) {
                            numBarsPlayed++;
                            barActions[i].stop(); barActions[i].play();
                            glowActions[i].stop(); glowActions[i].play();
                        }
                    }
                    return numBarsPlayed >= lastBarIdx && !barActions[lastBarIdx - 1].isRunning();
                }
            }),
        ).then(this._createFlashSequence())
        .play();
        return this;
    }

    public animateZipChallenge(): this {
        const action = this._createAnimationAction(
            this._getMixer(this._getObjectByName('zip-panel')),
            'zip',
            { loop: false, clamp: false },
        );
        this._sequencer
            .then(this._createCameraSequence([-0.44, -0.26, 0.86]))
            .then(new SequenceAction({
                enter() {
                    action.stop(); action.play();
                },
                update: () => {
                    this._touchMixer(action.getMixer());
                    return !action.isRunning();
                },
            }))
            .then(this._createFlashSequence())
            .play();
        return this;
    }

    public animateTorchChallenge(): this {
        const glow = this._getMeshByName('torch-glow');
        const mixer = this._getMixer(this._getObjectByName('torch-panel'));
        const startAction = this._createAnimationAction(
            mixer,
            'torch-run',
            { loop: false, clamp: true },
        );
        const humAction = this._createAnimationAction(
            mixer,
            'torch-hum',
            { loop: 'loop', clamp: false },
        );
        this._sequencer
            .then(this._createCameraSequence([-0.50, -0.26, -0.82]))
            .then(new SequenceAction({
                enter() {
                    glow.visible = true;
                    startAction.stop();
                    humAction.stop();
                    startAction.play();
                },
                update: () => {
                    this._touchMixer(mixer);
                    if (!startAction.isRunning()) {
                        humAction.play();
                        return true;
                    }
                    return false;
                },
            }))
            .then(this._createFlashSequence())
            .play();
        return this;
    }

    // public animateBurnChallenge(dripId: number): SequenceHandler {
    //     const burnEffectAction = this._getSharedAnimationAction('burn-effect', null, { timeScale: 1.5 });
    //     const dripTokenAction = this._getSharedAnimationAction(`drip.00${dripId - 1}`);
    //     const burnTokenAction = this._getSharedAnimationAction(`burn.00${dripId - 1}`, null, { timeScale: 1.5 });
    //     let burnTokenActionCompleted = false;
    //     return {
    //         enter() {
    //             dripTokenAction.stop();
    //             burnTokenAction.stop();
    //             burnTokenAction.play();
    //         },
    //         update() {
    //             if (!burnTokenAction.isRunning()) {
    //                 if (!burnTokenActionCompleted) {
    //                     burnTokenActionCompleted = true;
    //                     burnEffectAction.stop();
    //                     burnEffectAction.play();
    //                 }
    //                 return !burnEffectAction.isRunning();
    //             }
    //             return false;
    //         },
    //     };
    // }

    // public animateLockChallenge(): SequenceHandler {
    //     const torchUnlockAction = this._getSharedAnimationAction(
    //         'torch-unlock',
    //         null,
    //         { clamp: true },
    //     );
    //     return {
    //         enter() {
    //             torchUnlockAction.stop();
    //             torchUnlockAction.play();
    //         },
    //         update() {
    //             return !torchUnlockAction.isRunning();
    //         },
    //     };
    // }

    // public animateTorchChallenge(duration=2.0): SequenceHandler {
    //     const fire = this._getMeshByName('torch-fire');
    //     const glow = this._getMeshByName('torch-glow');
    //     const actions = TORCH_FIRE_ANIMATIONS.map(n => this._getSharedAnimationAction(n, null, { loop: true }));
    //     return {
    //         enter() {
    //             fire.visible = true;
    //             glow.visible = true;
    //             for (const a of actions) {
    //                 a.stop();
    //                 a.play();
    //             }
    //         },
    //         update({ runningTime }) {
    //             return runningTime >= duration;
    //         }
    //     };
    // }

    // public animateTakeFees(fees: number): SequenceHandler {
    //     const coins = this._findObjects((o) => /^coin\d{3}$/.test(o.name));
    //     let maxCoinIdx = 0;
    //     {
    //         let x = fees;
    //         for (let d = 100; d < MAX_FEES && fees / d >= 1; d *= 2, ++maxCoinIdx) ;
    //         maxCoinIdx = Math.floor(Math.min(1, maxCoinIdx / MAX_DRIP_TOKENS) * coins.length);
    //     }
    //     const animatedCoins = coins.slice(0, maxCoinIdx);
    //     const actions = animatedCoins.map(c => this._getSharedAnimationAction('.coin-flip-in', c, { clamp: true }));
    //     return {
    //         update({ runningTime }) {
    //             let i = Math.floor(runningTime / COIN_FLIP_DELAY);
    //             if (i < actions.length && !actions[i].isRunning()) {
    //                 actions[i].stop().play();
    //             }
    //             return i >= actions.length && actions.every(a => !a.isRunning());
    //         },
    //     };
    // }

    // public animateSpreadChallenge(spreadAmount: number, remaining: number): SequenceHandler {
    //     const coins = this._findObjects((o) => /^coin\d{3}$/.test(o.name));
    //     const maxCoinIdx = Math.ceil(Math.min(1, (spreadAmount + remaining) / MAX_SPREAD) * coins.length);
    //     const minCoinIdx = Math.floor((remaining / MAX_SPREAD) * coins.length);
    //     const animatedCoins = coins.slice(minCoinIdx, maxCoinIdx).reverse();
    //     const inActions = animatedCoins.map(c => this._getSharedAnimationAction('.coin-flip-in', c));
    //     const outActions = animatedCoins.map(c => this._getSharedAnimationAction('.coin-flip-out', c, { clamp: true }));
    //     return {
    //         update({ runningTime }) {
    //             let i = Math.floor(runningTime / COIN_FLIP_DELAY);
    //             if (i < outActions.length && !outActions[i].isRunning()) {
    //                 inActions[i].stop();
    //                 outActions[i].stop().play();
    //             }
    //             return i >= outActions.length && outActions.every(a => !a.isRunning());
    //         },
    //     };
    // }

    // public animateZipChallenge(duration: number = 1.5): SequenceHandler {
    //     const action = this._getSharedAnimationAction('zip', null, { loop: true });
    //     return {
    //         enter() { action.stop().play(); },
    //         update({runningTime}) {
    //             return runningTime >= duration;
    //         }
    //     };
    // }
}