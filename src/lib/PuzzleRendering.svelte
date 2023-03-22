<script lang="ts" context="module">
export interface SimResultsWithScore {
        simResults: SimResults;
        score: number;
    }
</script>

<script lang="ts">
    import { Canvas, OrbitControls, Pass, T } from '@threlte/core';
    import type { Camera, Scene } from 'three';
    import { GLTF } from '@threlte/extras';
    import { degToRad } from 'three/src/math/MathUtils';
    import { createEventDispatcher, onMount } from 'svelte';
    import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass';
    import type { DecodedEvent, SimResults } from './simulate';

    class AnimationAbortedError extends Error {}

    const dispatch = createEventDispatcher();

    export let simResultsWithScore: SimResultsWithScore | null = null;
    export let submitName: string = '';
    export let submitPromise: Promise<any> | null = null;

    let scene : Scene;
    let camera: Camera;
    let isPrompting = false;
    let solveAnimation: Promise<void> | null = null;

    $: (async () => {
        const oldAnimation = solveAnimation;
        try {
            if (oldAnimation) {
                await oldAnimation;
            }
        } catch (err) {
            if (!(err instanceof AnimationAbortedError)) {
                console.error(err);
            }
        } finally {
            if (solveAnimation !== oldAnimation ||
                !simResultsWithScore ||
                simResultsWithScore.simResults.error
            ) {
                return;
            }
        }
        const p = solveAnimation = animateSolution(simResultsWithScore!.simResults.puzzleEvents);
        await solveAnimation;
        if (p === solveAnimation) {
            solveAnimation = null;
            if (simResultsWithScore!.score > 0) {
                isPrompting = true;
            }
        }
    })();
    $: {
        if (submitPromise) {
            submitPromise.then(() => isPrompting = false);
        }
    }

    async function animateSolution(events: DecodedEvent[]): Promise<void> {
        await runAbortableSequence([

        ]);
        await resetCamera();
        await 
        if (events.length === 0) {
            // No progress.
            
            return;
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
    <Canvas>
        <T.Scene bind:ref={scene}>
            <T.AmbientLight intensity={0.75} />
            <T.OrthographicCamera makeDefault position={[0, 5, 10]} fov={24} near={0.1} far={20} zoom={60} bind:ref={camera}>
                <OrbitControls maxPolarAngle={degToRad(60)} enableZoom={false} target={{x: 0, y: 1.5, z: 0}} />
                <T.DirectionalLight position={[10, 8, 2]} intensity={1} />
            </T.OrthographicCamera>
            <GLTF url="/puzzlebox.glb" rotation={{x: 0, y: degToRad(45), z: 0}} />
            {#if scene}
                <Pass pass={new RenderPixelatedPass(3.5, scene, camera, { normalEdgeStrength: 0.001, depthEdgeStrength: 0.001 })} />
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