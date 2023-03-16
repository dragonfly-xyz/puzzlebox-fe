<script lang="ts">
    import { Canvas, OrbitControls, Pass, T, useThrelte } from '@threlte/core';
    import { AmbientLight, Group, OrthographicCamera } from 'three';
    import { GLTF } from '@threlte/extras';
    import { damp, degToRad } from 'three/src/math/MathUtils';
    import { onMount } from 'svelte';
    import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass';

    let scene;
    let camera;
</script>

<style lang="scss">
    .component {
        height: 100%;
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
            <GLTF url="/puzzlebox.glb" position={[0,10,0]} rotation={{x: 0, y: degToRad(45), z: 0}} />
            {#if scene}
                <Pass pass={new RenderPixelatedPass(2, scene, camera, { normalEdgeStrength: 0.001, depthEdgeStrength: 0.001 })} />
            {/if}
        </T.Scene>
    </Canvas>
</div>