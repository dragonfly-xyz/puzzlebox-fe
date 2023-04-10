<script lang="ts">
    import _ from 'underscore';
    import {
    AmbientLight,
        Camera,
        Color,
        DirectionalLight,
        Group,
        LinearToneMapping,
        OrthographicCamera,
        Scene,
        Vector3,
        WebGLRenderer,
    } from 'three';
    import { degToRad } from 'three/src/math/MathUtils';
    import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
    import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
    import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass';
    import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
    import { createEventDispatcher } from 'svelte';
    import { Animator } from './animator';
    import type { SimResultsWithScore } from './types';
    import { formatScore } from './util';
    import { onMount, onDestroy } from 'svelte';
    import { animateFromResults } from './animator-utils';

    const dispatch = createEventDispatcher();

    export let el: HTMLElement | undefined;
    export let simResultsWithScore: SimResultsWithScore | null = null;
    export let submitName: string = '';
    export let submitPromise: Promise<any> | null = null;

    let isPrompting = false;
    let renderContext: {
        scene: Scene;
        camera: Camera;
        puzzleBox: Group;
        animator: Animator;
        cameraControl: OrbitControls;
        renderer: WebGLRenderer;
        composer: EffectComposer;
    } | undefined;

    onMount(async () => {
        const gltfLoader = new GLTFLoader();
        const model = await gltfLoader.loadAsync('puzzlebox.glb');
        const puzzleBox = model.scene;
        const animations = model.animations;
        const [w, h] = [el!.clientWidth, el!.clientHeight]
        const renderer = new WebGLRenderer({ alpha: true, antialias: false });
        renderer.setSize(w, h);
        renderer.setViewport(0, 0, w, h);
        const aspectRatio = w / h;
        const scene = new Scene();
        scene.add(puzzleBox);
        scene.add(new AmbientLight(new Color(1, 1, 1), 1.5));
        const zoom = 0.45;
        const camera = new OrthographicCamera(
            -aspectRatio / zoom,
            aspectRatio / zoom,
            1 / zoom,
            -1 / zoom,
            0.05,
            10,
        );
        camera.position.set(2, 2, 2);
        scene.add(camera);
        const light = new DirectionalLight(new Color(1, 1, 1), 0.5);
        camera.add(light);
        light.position.set(0, 3, 1);
        light.target = puzzleBox;
        const cameraControl = new OrbitControls(camera, renderer.domElement);
        cameraControl.minPolarAngle = degToRad(25);
        cameraControl.maxPolarAngle = degToRad(75);
        cameraControl.enableZoom = false;
        cameraControl.enablePan = false;
        cameraControl.target = new Vector3(0, 0, 0);
        cameraControl.update();
        const composer = new EffectComposer(renderer);
        renderer.toneMapping = LinearToneMapping;
        renderer.toneMappingExposure = 0.85;
        const pixelPass = new RenderPixelatedPass(2.5, scene, camera, { depthEdgeStrength: 0.5, normalEdgeStrength: 0.001 });
        composer.addPass(pixelPass);
        const animator = new Animator({
            scene,
            cameraControl,
            puzzleBox,
            pixelPass,
            clips: animations,
        });
        animator.reset();
        renderContext = {
            scene,
            camera,
            animator,
            cameraControl,
            puzzleBox,
            renderer,
            composer,
        };
        el?.insertBefore(renderer.domElement, el?.firstChild);
        const render = () => {
            if (renderContext?.renderer) {
                composer.render(animator!.update());
                setTimeout(() => requestAnimationFrame(render), 28);
            }
        }
        render();
        // setTimeout(async () => {
        //     await animator
        //         .animateOperateChallenge()
        //         .animateUnlockTorchChallenge()
        //         .animateTakeFee(0, 102300)
        //         .animateDripChallenge(0, [1,2,3,4,5,6,7,8,9,10])
        //         .animateBurn(10, 0, [3])
        //         .animateSpreadChallenge(999)
        //         .animateBurn(9, 1, [1])
        //         .animateZipChallenge()
        //         .animateBurn(8, 2, [5])
        //         .animateTorchChallenge()
        //         .animateBurn(7, 3, [2,4,6,7,8,9])
        //         .animateBurn(1, 9, [10])
        //         .animateOpenChallenge()
        //         .wait();
        //     // await animator.animateReset().wait();
        //     // await animator
        //     //     .animateOperateChallenge().wait();
        //     }, 500);
    });

    onDestroy(() => {
        if (renderContext) {
            renderContext.renderer.dispose();
            renderContext = undefined;
        }
    });

    $: (async () => {
        isPrompting = false;
        if (!renderContext
            || !simResultsWithScore
            || simResultsWithScore.simResults.error
        ) {
            return;   
        }
        dispatch('animating');
        const { animator } = renderContext;
        await animator.animateReset().wait();
        animator.animateWait(1);
        animateFromResults(animator, simResultsWithScore.simResults);
        if (simResultsWithScore.score > 0) {
            animator.animateWait(2.5);
        }
        await animator.wait();
        console.log('complete');
        if (simResultsWithScore.score > 0) {
            isPrompting = true;
        }
    })();

    $: {
        if (submitPromise) {
            submitPromise.then(() => isPrompting = false);
        }
    }

    $: {
        if (renderContext?.cameraControl) {
            renderContext.cameraControl.addEventListener('change', () => {
                logCameraRay();
            });
        }
    }

    function submitScore(): void {
        if (simResultsWithScore) {
            dispatch('submitScore', {name: submitName, score: simResultsWithScore.score });
        }
    }

    const logCameraRay = _.debounce(() => {
        const cameraControl = renderContext!.cameraControl;
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