import type { SequenceHandler } from './sequencer';
import { AnimationClip, AnimationMixer, Group, Material, Matrix4, Mesh, Quaternion, Scene, Vector3, Object3D, MeshPhysicalMaterial, Color } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

interface AnimatorOpts {
    scene: Scene;
    puzzleBox: Group;
    cameraControl: OrbitControls;
    clips: AnimationClip[];
}

const HAND_OBJ_NAME = 'hand-inner';
const HAND_UNLOCK_COLOR = new Color(0.05, 1.0, 0.05);

enum OrigCacheItem {
    HandColor,
}

function getMeshChild(parent: Object3D, name: string): Mesh {
    return parent.getObjectByName(name) as Mesh;
}

function getMeshMaterial<T extends Material>(mesh: Mesh): T {
    const mats = mesh.material;
    if (Array.isArray(mats)) {
        return mats[0] as T;
    }
    return mats as T;
}

export class Animator {
    private readonly _cameraControl: OrbitControls;
    private readonly _mixer: AnimationMixer;
    private readonly _clipsByName: { [name: string]: AnimationClip };
    private readonly _puzzleBox: Group;
    private readonly _origCache: { [key in OrigCacheItem]: any };
    
    public constructor(opts: AnimatorOpts) {
        this._cameraControl = opts.cameraControl;
        this._mixer = new AnimationMixer(opts.scene);
        this._puzzleBox = opts.puzzleBox;
        this._clipsByName = Object.assign(
            {},
            ...opts.clips.map(a => ({ [a.name]: a })),
        );
        this._origCache = {
            [OrigCacheItem.HandColor]: this._getMeshMaterialByMeshName(HAND_OBJ_NAME).color.clone(),
        };
    }

    private _getMeshByName(name: string): Mesh {
        return getMeshChild(this._puzzleBox, name);
    }

    private _getMeshMaterialByMeshName
        <T extends Material = MeshPhysicalMaterial>
        (meshName: string): T
    {
        return getMeshMaterial<T>(getMeshChild(this._puzzleBox, meshName));
    }

    private _getOrig<T>(name: OrigCacheItem): T {
        return this._origCache[name] as T;
    }

    public update(dt: number): void {
        this._mixer.update(dt);
    }

    public animateReset(): SequenceHandler {
        const mat = this._getMeshMaterialByMeshName(HAND_OBJ_NAME); 
        return {
            update: () => {
                mat.color = this._getOrig<Color>(OrigCacheItem.HandColor);
                return true;
            }
        };
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
        const mat = this._getMeshMaterialByMeshName(HAND_OBJ_NAME);
        return {
            enter: () => { mat.color = mat.color.clone(); },
            update: ({ runningTime }) => {
                mat.color.lerp(HAND_UNLOCK_COLOR, Math.min(1, runningTime / 1));
                return runningTime >= 1;
            }
        }
    }
}

