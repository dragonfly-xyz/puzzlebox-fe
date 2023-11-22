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
    import { formatScore } from '$lib/util';
    import { onMount, onDestroy } from 'svelte';
    import { animateFromResults } from './animator-utils';
    import { base } from '$app/paths';

    const dispatch = createEventDispatcher();

    export let el: HTMLElement | undefined;
    export let simResultsWithScore: SimResultsWithScore | null = null;

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
        const model = await gltfLoader.loadAsync(`${base}/puzzlebox.glb`);
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
        const pixelPass = new RenderPixelatedPass(1.25, scene, camera, { depthEdgeStrength: 0.5, normalEdgeStrength: 0.001 });
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
    });

    onDestroy(() => {
        if (renderContext) {
            renderContext.renderer.dispose();
            renderContext = undefined;
        }
    });

    $: (async () => {
        if (!renderContext
            || !simResultsWithScore
            || simResultsWithScore.simResults.error
        ) {
            return;   
        }
        dispatch('animating');
        isPrompting = false;
        const { animator } = renderContext;
        await animator.animateReset().wait();
        animator.animateWait(1);
        try {
            animateFromResults(animator, simResultsWithScore.simResults);
            if (simResultsWithScore.score > 0) {
                animator.animateWait(2.5);
            }
            await animator.wait();
        } catch (err) {
            console.error(err);
        }
        console.log('complete');
        if (simResultsWithScore.score > 0) {
            isPrompting = true;
        }
    })();

    $: {
        if (renderContext?.cameraControl) {
            renderContext.cameraControl.addEventListener('change', () => {
                logCameraRay();
            });
        }
    }

    function onSubmitScore(): void {
        isPrompting = false;
        if (simResultsWithScore) {
            dispatch('submitScore');
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
        gap: 0.75em;
        text-align: center;
    }
    .box button {
        align-self: center;
        margin-bottom: 0;
        display: flex;
    }
    .box .score {
        font-family: 'Silkscreen', monospace;
        font-weight: bold;
    }
    .box > *:nth-child(2) {
        display: flex;
        flex-direction: row;
        gap: 2ex;
        justify-content: center;

    }
    @keyframes popup {
        from { transform: scale(0.01); }
        to { }
    }
</style>

<div class="component" bind:this={el}>
    <div class="cover" class:active={isPrompting} on:click|stopPropagation={() => {isPrompting = false}}>
        <div class="box" on:click|stopPropagation>
            <div>
                Your score: <span class="score">{ formatScore(simResultsWithScore?.score || 0) }</span>
            </div>
            <div>
                <button
                    class="pixel-button"
                    on:click|stopPropagation={onSubmitScore}>
                        Submit
                </button>
                <button class="pixel-button" on:click|stopPropagation={() => isPrompting = false}>
                    Nah
                </button>
            </div>
        </div>
    </div>
</div>