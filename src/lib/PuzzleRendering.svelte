<script lang="ts">
    import { dev } from '$app/environment';
    import {
    AmbientLight,
        Camera,
        Color,
        DirectionalLight,
        Group,
        LinearToneMapping,
        Matrix4,
        OrthographicCamera,
        Scene,
        Vector2,
        Vector3,
        WebGLRenderer,
        type AnimationClip,
        type Material,
    } from 'three';
    import { degToRad } from 'three/src/math/MathUtils';
    import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
    import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
    import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass';
    import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
    import { createEventDispatcher } from 'svelte';
    import _ from 'underscore';
    import { Animator } from './animator';
    import { TORCH_SELECTOR } from './scoring';
    import type { SimResultsWithScore } from './types';
    import { formatScore } from './util';
    import { onMount, onDestroy } from 'svelte';

    const dispatch = createEventDispatcher();
    const DEFAULT_VIEW_ANGLE = [-0.60, -0.53, -0.6] as [number, number, number];

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
        composer.addPass(new RenderPixelatedPass(3, scene, camera, { depthEdgeStrength: 0.15, normalEdgeStrength: 0.001 }));
        const animator = new Animator({
            scene,
            cameraControl,
            puzzleBox,
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
                requestAnimationFrame(render);
            }
        }
        render();
        animator.animateOperateChallenge();
    });

    onDestroy(() => {
        if (renderContext) {
            renderContext.renderer.dispose();
            renderContext = undefined;
        }
    });

    // $: (async () => {
    //     isPrompting = false;
    //     if (!simResultsWithScore
    //         || simResultsWithScore.simResults.error
    //         || !animator 
    //         || !mainSequencer)
    //     {
    //         return;   
    //     }
    //     dispatch('animating');
    //     const { simResults } = simResultsWithScore;
    //     if (simResults.puzzleEvents.length === 0) {
    //         mainSequencer.play([
    //             animator.animateReset(),
    //             animator.animateCamera(DEFAULT_VIEW_ANGLE),
    //             animator.animateRattleBox(),
    //         ]);
    //     } else {
    //         const seq = [animator.animateReset()];
    //         let lastEventName: string | undefined;
    //         for (let i = 0; i < simResults.puzzleEvents.length; ++i) {
    //             const { eventName, args: eventArgs } = simResults.puzzleEvents[i];
    //             const nextEventName = simResults.puzzleEvents[i + 1]?.eventName;
    //             if (eventName === 'Operate') {
    //                 seq.push(
    //                     animator.animateCamera(DEFAULT_VIEW_ANGLE),
    //                     animator.animateOperateChallenge(),
    //                 );
    //             } else if (eventName === 'Lock') {
    //                 if (eventArgs.selector === TORCH_SELECTOR && !eventArgs.isLocked) {
    //                     seq.push(
    //                         animator.animateCamera([-0.88, -0.26, -0.39]),
    //                         animator.animateLockChallenge(),
    //                     );
    //                 }
    //             } else if (eventName === 'Drip') {
    //                 const dripIds: number[] = [];
    //                 let totalFees = 0n;
    //                 for (; i < simResults.puzzleEvents.length; ++i) {
    //                     const followupEvent = simResults.puzzleEvents[i];
    //                     if (followupEvent.eventName !== 'Drip') {
    //                         i = i - 1;
    //                         break;
    //                     }
    //                     dripIds.push(Number(followupEvent.args.dripId));
    //                     totalFees += followupEvent.args.fee;
    //                 }
    //                 if (totalFees !== 0n && dripIds.length != 0) {
    //                     seq.push(animator.animateCamera([0.89, -0.26, -0.38]));
    //                     seq.push(animator.animateTakeFees(Number(totalFees)));
    //                     seq.push(animator.animateCamera([-0.39, -0.26, -0.88]));
    //                     seq.push(animator.animateDripChallenge(dripIds));
    //                 }
    //             } else if (eventName === 'Torch') {
    //                     seq.push(
    //                         animator.animateCamera([-0.88, -0.26, -0.39]),
    //                         animator.animateTorchChallenge(),
    //                     );
    //             } else if (eventName === 'Burned') {
    //                 if (lastEventName !== 'Burned') {
    //                     seq.push(animator.animateCamera([-0.39, -0.26, -0.88]));
    //                 }
    //                 seq.push(
    //                     animator.animateBurnChallenge(Number(eventArgs.dripId)),
    //                 );
    //             } else if (eventName === 'Zip') {
    //                 seq.push(
    //                     animator.animateCamera([0.29, -0.26, 0.92]),
    //                     animator.animateZipChallenge(),
    //                     animator.animateWait(0.5),
    //                 );
    //             } else if (eventName === 'Spread') {
    //                 seq.push(
    //                     animator.animateCamera([0.95, -0.28, -0.13]),
    //                     animator.animateSpreadChallenge(Number(eventArgs.amount), Number(eventArgs.remaining)),
    //                 );
    //             } else if (eventName === 'Open') {
    //                 seq.push(
    //                     animator.animateCamera(DEFAULT_VIEW_ANGLE),
    //                     animator.animateOpenChallenge(),
    //                 );
    //             }
    //             if (nextEventName !== eventName) {
    //                 seq.push(animator.animateWait(0.5));
    //             }
    //             lastEventName = eventName;
    //         }
    //         seq.push(
    //             animator.animateCamera(DEFAULT_VIEW_ANGLE),
    //             animator.animateWait(1),
    //         );
    //         await mainSequencer.play(seq);
    //         console.log('complete');
    //         if (simResultsWithScore.score > 0) {
    //             isPrompting = true;
    //         }
    //     }
    // })();

    $: {
        if (submitPromise) {
            submitPromise.then(() => isPrompting = false);
        }
    }

    // $: {
    //     if (canvasContext && animations && materials && puzzleBox) {
    //         composer = new EffectComposer(canvasContext.renderer);
    //         {
    //             const bloomEffect = new SelectiveBloomEffect(
    //                 canvasContext.scene,
    //                 cameraControl.object,
    //                 {
    //                     blendFunction: BlendFunction.ADD,
    //                     mipmapBlur: true,
    //                     luminanceThreshold: 0.7,
    //                     luminanceSmoothing: 0.3,
    //                     intensity: 3.0
    //                 },
    //             );
    //             bloomEffect.inverted = true;
    //             const pixelEffect = new PixelationEffect();
    //             composer.addPass(new EffectPass(cameraControl.object, bloomEffect, pixelEffect));
    //         }
    //         animator = new Animator({
    //             scene: canvasContext.scene,
    //             cameraControl,
    //             clips: animations,
    //             puzzleBox,
    //             materials,
    //         });
    //         mainSequencer = animator.getSequencer('main');
    //         animator.reset();
    //         const render = () => {
    //             animator!.update();
                
    //             requestAnimationFrame(render);
    //         }
    //         render();
    //     }
    // }

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