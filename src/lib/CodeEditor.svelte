<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';

    const dispatch = createEventDispatcher();

    export let readOnly = false;
    export let error: string | null = null;
    export let contents: string = '';
    export let actionText: string = '';
    export let busy: boolean = false;

    function act() {
        if (error) {
            error = null;
            return;
        }
        dispatch('action', contents);
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

    .content[readonly] {
        background-color: #bbbbdd;
    }

    .cover {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        right: 0;
        display: flex;
        flex-direction: column;
        pointer-events: none;
    }

    .cover > * {
        pointer-events: all;
    }

    .action {
        float: right;
        position: absolute;
        right: 3ex;
        bottom: 0em;
    }

    .hidden {
        display: none;
    }
    
    .error {
        flex: 1;
        background-color: #ddaeae;
        border: 0;
        margin: 0;
        padding: 1ex;
        font-size: 0.8em;
        color: #333;
        font-family: 'ComicMono', monospace;
    }
</style>

<div class="component">
    <textarea class="content" readonly={readOnly} bind:value={contents}></textarea>
    <div class="cover">
        <button class="action pixel-button" on:click={act} disabled={busy} aria-busy={busy}>
            {error ? 'Got it' : actionText}
        </button>
        <textarea class="error" class:hidden={!error} readonly bind:value={error}></textarea>
    </div>
</div>