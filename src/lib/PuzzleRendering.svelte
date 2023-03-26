<script lang="ts" context="module">
export interface SimResultsWithScore {
        simResults: SimResults;
        score: number;
    }
</script>

<script lang="ts">
    import { dev } from '$app/environment';
    import { Canvas, Pass, T, OrbitControls } from '@threlte/core';
    import { type Scene, AnimationClip, Group } from 'three';
    import { GLTF } from '@threlte/extras';
    import { degToRad } from 'three/src/math/MathUtils';
    import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass';
    import type { OrbitControls as OrbitControlsType } from 'three/examples/jsm/controls/OrbitControls';
    import { createEventDispatcher } from 'svelte';
    import type { DecodedEvent, SimResults } from './simulate';
    import type { Sequencer } from './sequencer';
    import _ from 'underscore';
    import { Animator } from './animator';
    import { TORCH_SELECTOR } from './scoring';
    import { sequence } from '@sveltejs/kit/hooks';

    const dispatch = createEventDispatcher();

    export let el: HTMLElement | undefined;
    export let simResultsWithScore: SimResultsWithScore | null = null;
    export let submitName: string = '';
    export let submitPromise: Promise<any> | null = null;

    let scene : Scene;
    let cameraControl: OrbitControlsType;
    let isPrompting = false;
    let mainSequencer: Sequencer | undefined;
    let puzzleBox: Group | undefined;
    let animations: AnimationClip[] | undefined; 
    let animator: Animator | undefined;

    $: (async () => {
        isPrompting = false;
        if (!simResultsWithScore
            || simResultsWithScore.simResults.error
            || !animator 
            || !mainSequencer)
        {
            return;   
        }
        dispatch('animating');
        const { simResults } = simResultsWithScore;
        if (simResults.puzzleEvents.length === 0) {
            mainSequencer.play([
                animator.animateReset(),
                animator.animateCamera([0.6, -0.53, -0.6]),
                animator.animateRattleBox(),
            ]);
        } else {
            const seq = [animator.animateReset()];
            let lastEventName: string | undefined;
            for (const [i, e] of simResults.puzzleEvents.entries()) {
                const { eventName } = e;
                const nextEventName = simResults.puzzleEvents[i + 1]?.eventName;
                if (eventName === 'Operate') {
                    seq.push(
                        animator.animateCamera([0.19, -0.91, -0.38]),
                        animator.animateOperateChallenge(),
                    );
                } else if (eventName === 'Lock') {
                    if (e.args.selector === TORCH_SELECTOR && !e.args.isLocked) {
                        seq.push(
                            animator.animateCamera([0.073, -0.26, 0.96]),
                            // animator.animateLockChallenge(),
                        );
                    }
                } else if (eventName === 'Drip') {
                    if (lastEventName !== 'Drip') {
                        seq.push(animator.animateCamera([0.050, -0.26, -0.96]));
                    }
                    seq.push(
                        // animator.animateDripChallenge(e.args.dripId),
                    );
                } else if (eventName === 'Torch') {
                        seq.push(
                            animator.animateCamera([0.073, -0.26, 0.96]),
                            // animator.animateTorchChallenge(e.args.dripIds),
                        );
                } else if (eventName === 'Burned') {
                    if (lastEventName !== 'Burned') {
                        seq.push(animator.animateCamera([0.050, -0.26, -0.96]));
                    }
                    seq.push(
                        // animator.animateBurn(e.args.dripId),
                    );
                } else if (eventName === 'Zip') {
                    seq.push(
                        animator.animateCamera([-0.92, -0.29, -0.25]),
                        // animator.animateZipChallenge(),
                        animator.animateWait(0.5),
                    );
                } else if (eventName === 'Spread') {
                    seq.push(
                        animator.animateCamera([0.95, -0.28, -0.13]),
                        // animator.animateSpreadChallenge(e.args.amount, e.args.remaining),
                    );
                } else if (eventName === 'Open') {
                    seq.push(
                        animator.animateCamera([0.6, -0.53, -0.6]),
                        // animator.animateOpenChallenge(),
                    );
                }
                if (nextEventName !== eventName) {
                    seq.push(animator.animateWait(0.5));
                }
                lastEventName = eventName;
            }
            await mainSequencer.play(seq);
            console.log('complete');
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
        if (scene && animations && puzzleBox) {
            animator = new Animator({
                scene,
                cameraControl,
                clips: animations,
                puzzleBox,
            });
            mainSequencer = animator.getSequencer('main');
            const render = () => {
                animator!.update();
                requestAnimationFrame(render);
            }
            render();
        }
    }

    $: {
        if (dev && cameraControl) {
            cameraControl.addEventListener('change', () => {
                logCameraRay();
            });
        }
    }

    function submitScore(): void {
        if (simResultsWithScore) {
            dispatch('submitScore', {name: submitName, score: simResultsWithScore.score });
        }
    }

    function formatScore(score: number) {
        return score.toLocaleString('en', {useGrouping: true});
    }

    const logCameraRay = _.debounce(() => {
        console.log(`Camera ray:`,
            '<' + cameraControl.target.clone().sub(cameraControl.object.position)
                .normalize()
                .toArray()
                .map(v => v.toPrecision(2))
                .join(', ') + '>',
        );
    }, 500);

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

<div class="component" bind:this={el}>
    <Canvas>
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
                    enabled={!mainSequencer?.isPlaying} />
                <T.DirectionalLight position={[10, 8, 2]} intensity={1} />
            </T.OrthographicCamera>
            <GLTF url="/puzzlebox.glb" bind:animations={animations} bind:scene={puzzleBox}/>
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