<script lang="ts">
    import { compile, simulate } from "$lib/puzzle";
    import { createEventDispatcher, onMount } from "svelte";
    import { readonly } from "svelte/store";

    enum BusyStep {
        None = '',
        Compiling = 'Compiling (1/2)...',
        Simulating = 'Executing (2/2)...',
    }

    export let readOnly = false;
    export let error: string | null = null;
    export let contents: string = '';
    let busyStep: BusyStep = BusyStep.None;
    let actionText: string = '';
    $: actionText = (() => {
        if (error) {
            return 'Got it';
        } else if (busyStep != BusyStep.None) {
            return busyStep;
        }
        return readOnly ? 'Copy' : 'Solve';
    })();

    const dispatch = createEventDispatcher();

    function copy() {
        navigator.clipboard.writeText(contents);
    }

    function act() {
        if (error) {
            error = null;
            return;
        }
        (async () => {
            busyStep = BusyStep.Compiling;
            const artifacts = await compile(contents);
            console.log(artifacts);
            busyStep = BusyStep.Simulating;
            const simResults = await simulate(artifacts);
            if (simResults.error) {
                throw new Error(`Solution reverted with "${simResults.error}"`);
            }
        })().then(() => {
            error = null;
        }).catch((err) => {
            error = err.toString();
        }).then(() => {
            busyStep = BusyStep.None;
        });
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

    .content[contenteditable]:focus {
        outline: 0px solid transparent;
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
        width: fit-content;
        float: right;
        position: absolute;
        right: 3ex;
        bottom: 0em;
        padding: 0.1em 0.5em;
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
        <button class="action" on:click={readOnly ? copy : act} disabled={busyStep != BusyStep.None}>
            {actionText}
        </button>
        <textarea class="error" class:hidden={!error} readonly bind:value={error}></textarea>
    </div>
</div>