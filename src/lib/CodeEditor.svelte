<script lang="ts" context="module">
    export enum ExpandAction {
        None,
        Expand,
        Inpand,
    }
</script>

<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import CodeMirror from 'svelte-codemirror-editor';
    import { parser as solidityParser } from '@replit/codemirror-lang-solidity';
    import { oneDarkTheme, oneDarkHighlightStyle } from '@codemirror/theme-one-dark';
    import { LanguageSupport, StreamLanguage, syntaxHighlighting } from '@codemirror/language';

    const dispatch = createEventDispatcher();

    export let readOnly = false;
    export let error: string | null = null;
    export let contents: string = '';
    export let actionText: string = '';
    export let busy: boolean = false;
    export let expandAction = ExpandAction.None;
    const editorLang = new LanguageSupport(StreamLanguage.define(solidityParser), syntaxHighlighting(oneDarkHighlightStyle));
    const editorStyles = {
        '*': { 'font-family': `'Comic Mono', monospace` },
        '&': {
            'font-family': `'Comic Mono', monospace`,
            'font-size': `0.75em`,
        }
    };

    function act() {
        if (error) {
            error = null;
            return;
        }
        dispatch('action', contents);
    }

    function expand() {
        dispatch('expand');
    }

</script>

<style lang="scss">
    @import "./common.scss";

    .component {
        @extend .pixel-corners;
        height: 100%;
        position: relative;
    }

    .component > :global(.pz-code-editor) {
        box-sizing: border-box;
        height: 100%;
        color: #000;
        min-height: 10em;
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

    .expand {
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
</style>

<div class="component">
    <CodeMirror
        class="pz-code-editor"
        readonly={readOnly}
        lang={editorLang}
        styles={editorStyles}
        bind:value={contents}
        theme={oneDarkTheme}
        tabSize={4}
        />
    <div class="cover">
        <button class="expand pixel-button" on:click={expand} class:hidden={expandAction === ExpandAction.None}>
            {expandAction === ExpandAction.Expand ? '⛶' : '🡵'}
        </button>
        <button class="action pixel-button" on:click={act} disabled={busy} aria-busy={busy}>
            {error ? 'Got it' : actionText}
        </button>
        <textarea class="error" class:hidden={!error} readonly bind:value={error}></textarea>
    </div>
</div>