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

interface AnimatorOpts {
    scene: Scene;
    puzzleBox: Group;
    cameraControl: OrbitControls;
    clips: AnimationClip[];
    materials: Record<string, Material>;
}

const OPERATE_CELLS = [
    0, 0, 0, 1, 0, 0, 0,
    1, 0, 0, 1, 0, 0, 1,
    0, 1, 0, 1, 0, 1, 0,
    0, 0, 1, 1, 1, 0, 0,
    0, 1, 0, 1, 0, 1, 0,
    1, 0, 0, 1, 0, 0, 1,
    0, 0, 0, 1, 0, 0, 0,
];

// const OPERATE_CELLS = [
//     0, 1, 1, 1, 1, 1, 0,
//     0, 1, 0, 0, 0, 1, 0,
//     0, 1, 1, 1, 1, 1, 0,
//     0, 0, 0, 1, 0, 0, 0,
//     0, 0, 0, 1, 1, 0, 0,
//     0, 0, 0, 1, 0, 0, 0,
//     0, 0, 0, 1, 1, 0, 0,
// ];

enum OrigCacheItem {
    // HandColor,
}

function getMeshMaterial<T extends Material>(mesh: Mesh): T {
    const mats = mesh.material;
    if (Array.isArray(mats)) {
        return mats[0] as T;
    }
    return mats as T;
}

export class Animator {
    private _lastUpdateTime: number = 0;
    private readonly _sequencerByName: { [name: string]: Sequencer } = {};
    private readonly _cameraControl: OrbitControls;
    private readonly _mixer: AnimationMixer;
    private readonly _clipsByName: { [name: string]: AnimationClip };
    private readonly _materialsByName: { [name: string]: Material };
    private readonly _puzzleBox: Group;
    private readonly _origCache: { [key in OrigCacheItem]: any };
    
    public constructor(opts: AnimatorOpts) {
        this._cameraControl = opts.cameraControl;
        this._mixer = new AnimationMixer(opts.scene);
        this._puzzleBox = opts.puzzleBox;
        this._materialsByName = opts.materials;
        this._clipsByName = Object.assign(
            {},
            ...opts.clips.map(a => ({ [a.name]: a })),
        );
        console.log(this._clipsByName);
        this._origCache = {
            // [OrigCacheItem.HandColor]: this._getMeshMaterialByMeshName(HAND_OBJ_NAME).color.clone(),
        };
    }

    private _getMeshByName(name: string): Mesh {
        return this._getObjectByName(name) as Mesh;
    }

    private _getObjectByName(name: string): Object3D {
        return this._puzzleBox.getObjectByName(name) as Object3D;
    }

    private _getOrig<T>(name: OrigCacheItem): T {
        return this._origCache[name] as T;
    }

    public getSequencer(name: string): Sequencer {
        if (!(this._sequencerByName[name])) {
            this._sequencerByName[name] = new Sequencer();
        }
        return this._sequencerByName[name];
    }

    public update(): void {
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
    }

    public animateReset(): SequenceHandler {
        const cells = this._getObjectByName('grid-cells').children.map(c => c as Mesh);
        const inactiveCellMaterial = this._materialsByName['box-basic'];
        return {
            enter: () => {
                for (const cell of cells) {
                    cell.position.y = 0;
                    cell.material = inactiveCellMaterial;
                }
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
        const clip = this._clipsByName['rattle'];
        console.log(clip, this._mixer);
        const action = this._mixer!.existingAction(clip) || (() => {
            const a = this._mixer!.clipAction(clip);
            a.setLoop(0, 1);
            return a;
        })();
        return {
            enter() { action.stop(); action.play(); },
            update() { return !action.isRunning(); },
        };
    }
    
    public animateOperateChallenge(): SequenceHandler {
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
                        if (OPERATE_CELLS[i]) {
                            y = Math.max(y, maxY * 0.33);
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

    public animateDripChallenge(dripId: number): SequenceHandler {
        const clip = this._clipsByName[`drip.00${dripId - 1}`]
        const action = this._mixer!.existingAction(clip) || (() => {
            const a = this._mixer!.clipAction(clip);
            a.setLoop(0, 1);
            return a;
        })();
        action.clampWhenFinished = true;
        return {
            enter() { action.stop(); action.play(); },
            update({runningTime}) { return runningTime >= clip.duration; },
        };
    }

    public animateBurnChallenge(dripId: number): SequenceHandler {
        let burnEffectAction: AnimationAction;
        {
            const clip = this._clipsByName['burn-effect'];
            burnEffectAction = this._mixer!.existingAction(clip) || (() => {
                const a = this._mixer!.clipAction(clip);
                a.setLoop(0, 1);
                return a;
            })();
        }
        let dripTokenAction: AnimationAction;
        {
            const clip = this._clipsByName[`drip.00${dripId - 1}`]
            dripTokenAction = this._mixer!.existingAction(clip) || (() => {
                const a = this._mixer!.clipAction(clip);
                a.setLoop(0, 1);
                return a;
            })();
        }
        let burnTokenAction: AnimationAction;
        {
            const clip = this._clipsByName[`burn.00${dripId - 1}`];
            burnTokenAction = this._mixer!.existingAction(clip) || (() => {
                const a = this._mixer!.clipAction(clip);
                a.setLoop(0, 1);
                return a;
            })();
        }
        let burnTokenActionCompleted = false;
        return {
            enter() {
                dripTokenAction.stop();
                burnTokenAction.stop();
                burnTokenAction.play();
            },
            update({ runningTime}) {
                if (runningTime >= burnTokenAction.getClip().duration) {
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
}

