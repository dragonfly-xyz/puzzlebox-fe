<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import CodeMirror from 'svelte-codemirror-editor';
    import { parser as solidityParser } from '@replit/codemirror-lang-solidity';
    import { oneDarkTheme, oneDarkHighlightStyle } from '@codemirror/theme-one-dark';
    import { LanguageSupport, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
    import { keymap } from '@codemirror/view';
    import { vscodeKeymap } from '@replit/codemirror-vscode-keymap';
    import { debounce, throttle } from 'underscore';
    import { browser } from '$app/environment';
    import Modal from './Modal.svelte';

    const dispatch = createEventDispatcher();

    export let readOnly = false;
    export let error: string | null = null;
    export let contents: string = '';
    export let originalContents: string | null = null;
    export let actionText: string = '';
    export let busy: boolean = false;
    export let expanded = false;
    export let saveId: string | undefined;
    let isDirty = false;
    let savedContents: string | undefined;
    let showConfirmReset = false;
    let confirmPopup: HTMLElement | undefined;

    const editorLang = new LanguageSupport(StreamLanguage.define(solidityParser), syntaxHighlighting(oneDarkHighlightStyle));
    const editorStyles = {
        '*': { 'font-family': `'Comic Mono', monospace` },
        '&': {
            'font-family': `'Comic Mono', monospace`,
            'font-size': `0.75em`,
        }
    };


    const save = throttle(() => {
        if (!browser || !saveId || contents === savedContents) {
            return;
        }
        savedContents = contents;
        localStorage.setItem(saveId, savedContents);
    }, 250);

    function act() {
        if (error) {
            error = null;
            return;
        }
        dispatch('action', contents);
    }

    function expand() {
        expanded = !expanded;
    }

    function promptToResetContents() {
        if (originalContents !== null && contents !== originalContents) {
            showConfirmReset = true;
        }
    }

    function resetContents() {
        if (originalContents !== null && contents !== originalContents) {
            contents = originalContents;
            closeResetContentsPopup();
        }
    }

    function closeResetContentsPopup() {
        confirmPopup!.dispatchEvent(new CustomEvent('modal-close', { bubbles: true }));
    }

    onMount(() => {
        if (saveId) {
            contents = localStorage.getItem(saveId) || contents;
        }
    });

    $: {
        isDirty = originalContents !== null && contents !== originalContents;
        setTimeout(() => save(), 1e3);
    }

</script>

<style lang="scss">
    @import "./common.scss";

    .component {
        @extend .pixel-corners;
        position: relative;
        cursor: text;
        display: flex;
        min-height: 24em;
    }

    .component:not(.expanded) {
        max-height: 24em;
    }

    .component > :global(.pz-code-editor) {
        box-sizing: border-box;
        color: #000;
        width: 100%;
    }

    .component > :global(.codemirror-wrapper > .cm-editor) {
        height: 100%;
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
        position: absolute;
        right: 2.5ex;
        bottom: 0.3em;
    }

    .corner-button {
        position: absolute;
        right: 2.5ex;
        top: 0.5em;
        font-weight: bold;
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
    
    .confirm-popup {
        @extend .pixel-corners;
        background-color: var(--background-color);
        margin: auto;
        padding: 1em 2em;
        width: max-content;
        text-align: center;
        > .buttons {
            display: flex;
            justify-content: center;
            margin-top: 1em;
            gap: 2.5ex;
            
            > button {
                @extend .pixel-corners;
                flex: 0;
            }
        }
    }
</style>

<div class="component" class:expanded={expanded}>
    <CodeMirror
        class="pz-code-editor"
        readonly={readOnly}
        lang={editorLang}
        styles={editorStyles}
        bind:value={contents}
        theme={oneDarkTheme}
        extensions={[keymap.of(vscodeKeymap)]}
        tabSize={4}
        />
    <div class="cover">
        {#if readOnly}
        <button
            class="corner-button pixel-button"
            on:click={expand}
        >
            {expanded ? '🡵' : '⛶'}
        </button>
        {:else}
        <button
            class="corner-button pixel-button"
            on:click={promptToResetContents}
            class:hidden={!isDirty || error}
        >
            ↺
        </button>
        {/if}
        <button class="action pixel-button" on:click={act} disabled={busy} aria-busy={busy}>
            {error ? 'Got it' : actionText}
        </button>
        <textarea class="error" class:hidden={!error} readonly bind:value={error}></textarea>
    </div>
    <Modal bind:show={showConfirmReset}>
        <div class="confirm-popup" bind:this={confirmPopup}>
            Reset editor contents to original?
            <div class="buttons">
                <button on:click|preventDefault|stopPropagation={resetContents}>Yah</button>
                <button on:click|preventDefault|stopPropagation={closeResetContentsPopup}>Nah</button>
            </div>
        </div>
    </Modal>
</div>