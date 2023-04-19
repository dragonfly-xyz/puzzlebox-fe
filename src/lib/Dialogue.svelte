<script lang="ts">
    import { onDestroy, onMount } from "svelte";

    enum Actor {
        GoodGuy,
        BadGuy,
        Action,
    }

    interface DialogueLine {
        actor: Actor;
        line: string;
        printedLine: string;
        el: HTMLElement;
    }

    const PRINT_SPEED = 3;

    export let script: string;
    let dialogueLines: DialogueLine[] = [];
    let currentLineIdx = -1;
    let printTimer: NodeJS.Timer | undefined;
    let component: HTMLElement;

    function printDialogue() {
        if (currentLineIdx < 0) {
            currentLineIdx = 0;
        }
        if (currentLineIdx >= 0 && currentLineIdx < dialogueLines.length) {   
            const d = dialogueLines[currentLineIdx];
            d.printedLine = d.line.slice(0, d.printedLine.length + PRINT_SPEED);
            dialogueLines = dialogueLines;
            d.el.scrollIntoView(false);
            if (d.printedLine === d.line) {
                ++currentLineIdx;
            }
        }
    }

    $: {
        dialogueLines = (script || '').split(/\r?\n/).map(raw => {
            raw = raw.trim();
            if (!raw) {
                return;
            }
            let actor = Actor.Action;
            let line: string = '';
            const m = /^(.+?):\s*(.+)\s*$/.exec(raw);
            if (!m) {
                line = raw;
            } else {
                actor = m[1] !== 'You' ? Actor.BadGuy : Actor.GoodGuy;
                line = m[2];
            }
            return { actor, line, printedLine: '' };
        }).filter(d => d !== undefined) as DialogueLine[];
    }

    function onExit() {
        component.parentElement?.dispatchEvent(new CustomEvent('modal-close', { bubbles: true }));
    }

    onMount(() => {
        component.addEventListener('modal-open', () => {
            currentLineIdx = -1;
            if (!printTimer) {
                printTimer = setInterval(printDialogue, 100);
            }
            for (const d of dialogueLines) {
                d.printedLine = '';
            }
        });
        component.addEventListener('modal-close', () => {
            currentLineIdx = -1;
            if (printTimer) {
                clearInterval(printTimer);
                printTimer = undefined;
            }
            localStorage.setItem('intro-viewed', String(Date.now()));
        });
    })

    onDestroy(() => {
        if (printTimer) {
            clearInterval(printTimer);
        }
    })
</script>

<style lang="scss">
    @import "@picocss/pico/scss/pico.scss";
    @import "./common.scss";

    @keyframes fade-in {
        0% {
            opacity: 0;
        }
        100% {
            opacity: 1;
        }
    }
    .component {
        position: relative;
        display: flex;
        justify-content: center;
        font-size: 1.25em;
        margin: auto;
        max-height: 100%;
        width: map-get($breakpoints, "sm");
        @media (min-width: map-get($breakpoints, "md")) {
            width: map-get($breakpoints, "md");
        }
        @media (min-width: map-get($breakpoints, "lg")) {
            width: map-get($breakpoints, "lg");
        }
        
        > .content {
            @extend .pixel-corners;
            background-color: #282c34;
            overflow: hidden;
            max-height: 100%;
            padding: 2em 0.5em 0.5em 0.5em;

            > div {
                overflow: hidden;
                max-height: 100%;
                > div {
                    height: fit-content;
                }
            }
        }
    }
    .action {
        color: #b2a2a0ff;
        text-align: center;
        font-style: italic;
        padding: 1em;
    }
    .speech {
        display: flex;
        gap: 2ex;
        > .profile {
            flex-shrink: 0;
            flex-grow: 0;
            animation: fade-in 1s;
        }
        > .profile > img {
            height: 10em;
            user-select: none;
        }
        > div:nth-child(2) {
            align-self: center;
        }
    }
    .speech.bad{
        color: #75b29aff;
        text-align: left;
    }
    .speech.good {
        color: #f66f55ff;
        flex-direction: row-reverse;
        text-align: right;
        > .profile > img {
            height: 7em;
            margin: 0.75em 0;
        }
    }
    .hidden {
        display: none;
    }
    .exit {
        position: absolute;
        top: -1.5em;
        border-radius: 100%;
        height: fit-content;
        width: fit-content;
    }
    .exit:not(:hover) {
        opacity: 0.5;
        background-color: rgba(0, 0, 0, 0);
    }

</style>

<div class="component" bind:this={component}>
    <div class="content">
        <div>
            <div>
                {#each dialogueLines as d, i}
                {#if d.actor === Actor.Action}
                <div class="action" class:hidden={currentLineIdx < i} bind:this={d.el}>
                    { d.printedLine }
                </div>
                {:else}
                <div
                    class="speech"
                    class:hidden={currentLineIdx < i}
                    class:good={d.actor === Actor.GoodGuy}
                    class:bad={d.actor === Actor.BadGuy}
                    bind:this={d.el}
                >
                    <div class="profile">
                        <img src={d.actor === Actor.GoodGuy ? "/good-guy.png" : "/bad-guy.png"} />
                    </div>
                    <div>{ d.printedLine }</div>
                </div>
                {/if}
                {/each}
            </div>
        </div>
    </div>
    <button class="exit" on:click|preventDefault|stopPropagation={onExit}>🗙</button>
</div>