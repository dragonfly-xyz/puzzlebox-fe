<script lang="ts">
    import { createEventDispatcher } from "svelte";

    export let readOnly = false;
    export let error: string | null = null;
    export let contents: string = '';

    const dispatch = createEventDispatcher();

    function copy() {
        navigator.clipboard.writeText(contents);
    }

    function solve() {
        dispatch('solved', contents);
    }
</script>

<style lang="scss">
    @import "./common.scss";

    .component {
        @extend .pixel-corners;
        height: 100%;
        position: relative;
    }

    .content {
        box-sizing: border-box;
        background-color: #ccc;
        height: 100%;
        color: #000;
        padding: 1ex 1ex 1em 1ex;
        font-family: 'Comic Mono', monospace;
        min-height: 3em;
        cursor: text;
        white-space: pre-wrap;
        font-size: 0.85em;
        overflow-x: auto;
    }

    .content[contenteditable]:focus {
        outline: 0px solid transparent;
    }

    .action {
        width: fit-content;
        float: right;
        position: absolute;
        right: 3ex;
        bottom: 0em;
        padding: 0.1em 0.5em;
    }

    @font-face {
        font-family: 'ComicMono';
        src: url('/ComicMono.ttf') format('truetype');
    }
</style>

<div class="component">
    <textarea class="content" readonly={readOnly} bind:value={contents}></textarea>
    <button class="action" on:click={readOnly ? copy : solve}>
        {#if readOnly}
        Copy
        {:else}
        Solve
        {/if}
    </button>
</div>