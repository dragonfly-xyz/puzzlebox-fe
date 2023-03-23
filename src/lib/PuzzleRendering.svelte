<script lang="ts" context="module">
export interface SimResultsWithScore {
        simResults: SimResults;
        score: number;
    }
</script>

<script lang="ts">
    import { dev } from '$app/environment';
    import { Canvas, Pass, T, type ThrelteContext, OrbitControls } from '@threlte/core';
    import { Matrix4, Quaternion, type OrthographicCamera, type Scene, Vector3, Camera } from 'three';
    import { GLTF } from '@threlte/extras';
    import { degToRad } from 'three/src/math/MathUtils';
    import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass';
    import type { OrbitControls as OrbitControlsType } from 'three/examples/jsm/controls/OrbitControls';
    import { createEventDispatcher } from 'svelte';
    import type { DecodedEvent, SimResults } from './simulate';
    import { AnimationAbortedError, Sequencer, type SequenceHandler } from './sequencer';

    const dispatch = createEventDispatcher();

    class BrowserSequencer extends Sequencer {
        public update() {
            super.update();
            if (this.isPlaying) {
                requestAnimationFrame(() => this.update());
            }
        }
    }

    export let simResultsWithScore: SimResultsWithScore | null = null;
    export let submitName: string = '';
    export let submitPromise: Promise<any> | null = null;

    let scene : Scene;
    let cameraControl: OrbitControlsType;
    let isPrompting = false;
    let sequencer = new BrowserSequencer();
    let threlteCtx: ThrelteContext | undefined;

    $: (async () => {
        isPrompting = false;
        if (!simResultsWithScore || simResultsWithScore.simResults.error) {
            return;   
        }
        const { simResults } = simResultsWithScore;
        if (simResults.puzzleEvents.length === 0) {
            sequencer.play([
                animateCamera([0.6, -0.53, -0.6]),
                rattleBox(),
            ]);
        } else {
            await sequencer.play([
                animateCamera([0.29, -0.86, -0.43]),
                // animateChallenge(0),
                animateCamera([0.78, -0.43, 0.45])
            ]);
            if (simResultsWithScore.score > 0) {
                isPrompting = true;
            }
        }
    })();

    $: {
        if (submitPromise) {
            submitPromise.then(() => isPrompting = false);
        }
    }

    $: {
        if (dev && cameraControl) {
            cameraControl.addEventListener('change', () => {
                console.log(`Camera ray:`,
                    cameraControl.target.clone().sub(cameraControl.object.position)
                        .normalize()
                        .toArray()
                        .join(','),
                );
            });
        }
    }

    function animateCamera(endLookDir_: [number, number, number], duration: number = 0.5e3): SequenceHandler {
        const camera = cameraControl.object;
        const origin = cameraControl.target.clone();
        const dist = cameraControl.getDistance();
        const endLookDir = new Vector3(...endLookDir_).normalize();
        return {
            update({ runningTime }): boolean {
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
                cameraControl.update();
                return duration <= runningTime;
            },
        };
    }

    function rattleBox(): SequenceHandler {
        return {};
    }

    function submitScore(): void {
        if (simResultsWithScore) {
            dispatch('submitScore', {name: submitName, score: simResultsWithScore.score });
        }
    }

    function formatScore(score: number) {
        return score.toLocaleString('en', {useGrouping: true});
    }
</script>

<style lang="scss">
    @import "./common.scss";

    .component {
        height: 100%;
        position: relative;
    }
    .cover {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        right: 0;
        pointer-events: none;
        display: none;
    }
    .cover.active {
        pointer-events: all;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .cover .box {
        @extend .pixel-corners;
        animation: popup 0.25s 1 cubic-bezier(.47,1.64,.41,.8);
        background-color: #333;
        border: 4px solid #777;
        padding: 0.75em 2ex;
        display: flex;
        flex-direction: column;
        gap: 0.5em;
        text-align: center;
    }
    .box button {
        align-self: center;
        margin-bottom: 0;
    }
    .box .score {
        font-family: 'Silkscreen', monospace;
        font-weight: bold;
    }
    .box input {
        font-family: 'Silkscreen', monospace;
        @extend .pixel-corners;
        text-align: center;
        margin-bottom: 0;
    }
    @keyframes popup {
        from { transform: scale(0.01); }
        to { }
    }
</style>

<div class="component">
    <Canvas bind:ctx={threlteCtx}>
        <T.Scene bind:ref={scene}>
            <T.AmbientLight intensity={0.75} />
            <T.OrthographicCamera
                makeDefault
                position={[-2,3,2]}
                near={0.1}
                far={20}
                zoom={60}
            >
                <OrbitControls
                    minPolarAngle={degToRad(25)}
                    maxPolarAngle={degToRad(75)}
                    enableZoom={false}
                    target={{x: 0, y: 1.25, z: 0}}
                    bind:controls={cameraControl}
                    enablePan={false}
                    enabled={!sequencer.isPlaying} />
                <T.DirectionalLight position={[10, 8, 2]} intensity={1} />
            </T.OrthographicCamera>
            <GLTF url="/puzzlebox.glb" />
            {#if scene && cameraControl}
                <Pass pass={new RenderPixelatedPass(3.5, scene, cameraControl.object, { normalEdgeStrength: 0.001, depthEdgeStrength: 0.001 })} />
            {/if}
        </T.Scene>
    </Canvas>
    <div class="cover" class:active={isPrompting} on:click|stopPropagation={() => {isPrompting = false}}>
        <div class="box" class:busy={submitPromise} on:click|stopPropagation>
            <div>
                Your score: <span class="score">{ formatScore(simResultsWithScore?.score || 0) }</span>
            </div>
            <div>
                <input
                    type="text"
                    placeholder="whats_your_name"
                    maxlength="24"
                    bind:value={submitName}
                    disabled={!!submitPromise}
                />
            </div>
            <button
                class="pixel-button"
                aria-busy={!!submitPromise}
                disabled={!submitName || !!submitPromise}
                on:click|preventDefault={submitScore}>
                    Submit
                </button>
        </div>
    </div>
</div>