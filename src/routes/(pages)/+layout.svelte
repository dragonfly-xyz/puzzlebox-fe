<script lang="ts">
    import ModalBed from "$lib/ModalBed.svelte";
    import '@picocss/pico';
    import Dialogue from '$lib/Dialogue.svelte';
    import introScript from '$lib/assets/intro-script.txt?raw';
    import Modal from '$lib/Modal.svelte';
    import { onDestroy, onMount } from "svelte";
    import { PUBLIC_CONTEST_END_TIMESTAMP } from '$env/static/public';

    let isShowingIntro = false;
    let countdownTimer: NodeJS.Timer | undefined;
    let secondsLeft = 0;

    function formatCountdown(seconds: number): string {
        const s = seconds % 60;
        seconds /= 60;
        const m = Math.floor(seconds % 60);
        seconds /= 60;
        const h = Math.floor(seconds % 24);
        seconds /= 24;
        const d = Math.floor(seconds);
        return [
            `${d.toString().padStart(2, '0')}`,
            `${h.toString().padStart(2, '0')}`,
            `${m.toString().padStart(2, '0')}`,
            `${s.toString().padStart(2, '0')}`,
        ].join(':');
    }

    onMount(() => {
        setTimeout(() => {
            if (!isShowingIntro) {
                const whenIntroViewed = localStorage.getItem('intro-viewed');
                isShowingIntro = !whenIntroViewed;
            }
        }, 1000);
        const updateSecondsLeft = () => {
            secondsLeft = Math.max(0,
                Math.floor(Number(PUBLIC_CONTEST_END_TIMESTAMP || 0) - Date.now() / 1e3)
            );
        };
        countdownTimer = setInterval(updateSecondsLeft, 1e3);
        updateSecondsLeft();
    });

    onDestroy(() => {
        clearInterval(countdownTimer!);
    });

</script>

<style lang="scss">
    @font-face {
        font-family: 'Superscript';
        src: url('/SUPERSCR.TTF') format('truetype');
    }
    @font-face {
        font-family: 'Silkscreen';
        src: url('/Silkscreen-Regular.ttf') format('truetype');
    }
    @font-face {
        font-family: 'Silkscreen Bold';
        src: url('/Silkscreen-Bold.ttf') format('truetype');
    }
    @font-face {
        font-family: 'VT323';
        src: url('/VT323-Regular.ttf') format('truetype');
    }
    @font-face {
        font-family: 'Comic Mono';
        src: url('/ComicMono.ttf') format('truetype');
    }
    @font-face {
        font-family: 'Mondwest';
        src: url('/Mondwest-Regular.ttf') format('truetype'); 
    }

    :root {
        --background: white;
        --primary: rgb(250,76,20);
        --primary-hover: rgb(228, 178, 165);
        --text-primary: black;
        --text-secondary: rgb(242,242,242);
        --accent: purple;
        font-family: 'Silkscreen', monospace;
    }
    :global(button:focus) {
        background-color: var(--primary);
    }

    /* Copied from picocss body > ... */
    header, main, footer {
        width: 100%;
        margin-right: auto;
        margin-left: auto;
        padding: var(--block-spacing-vertical) 0;
    }
    header {
        display: flex;
        flex-direction: column;
    }
    main {
        font-family: 'Silkscreen', monospace;
        padding-top: 0;
    }
    .banner {
        font-size: 3em;
        align-self: center;
    }
    .banner .text {
        font-family: 'Superscript', monospace;
        -webkit-font-smoothing: none;
        text-shadow: 0.15em 0.15em rgba(146, 146, 146, 0.3);
    }
    .banner .text .ext {
        font-size: 0.66em;
    }
    .banner a {
        color: rbg(250,76,20) !important;
        text-decoration: none !important;
    }
    .subbanner {
        font-size: 1em;
        font-family: 'Silkscreen', monospace;
        text-shadow: none;
        align-self: center;
    }
    .subbanner > a {
        color: inherit !important;
    }
    .quick-links {
        display: flex;
        flex-direction: row;
        align-self: center;
        font-size: 0.9em;
    }
    .quick-links > * + *::before {
        content: ' • ';
        white-space: pre;
    }
    footer {
        display: flex;
        justify-content: space-between;
        padding: 0 2em 1em 2em;
        > .terms {
            a {
                font-size: 0.75em;
            }
            > *:not(:last-child)::after {
                content: ' • ';
            }
        }
        > .company >.logo {
            letter-spacing: -0.25ex;
            outline: 0;
        }
        > .countdown {
            font-family: 'Silkscreen Bold', monospace;
        }
    }
    main {
        margin: auto;
        width: 100%;
    }
</style>

<ModalBed>
    <header>
        <div class="banner"><a class="text" href="/">Puzzlebox<span class="ext">.sol</span></a></div>
        <div class="subbanner">
            <a href="https://www.dragonfly.xyz/">
                A CTF from Dragonfly
            </a>
        </div>
        <div class="quick-links">
            <div><a on:click|stopPropagation|preventDefault={() => isShowingIntro = true}>intro</a></div>
            <div><a href="https://github.com/dragonfly-xyz/puzzlebox-ctf">github</a></div>
            <div><a href="https://t.me/+L09goZAIgYkzMmYx">support</a></div>
            <div><a href="https://jobs.dragonfly.xyz/jobs">jobs</a></div>
        </div>
    </header>
    <main class="container">
        <slot></slot>
    </main>
    <footer>
        <div class="terms">
            <span><a href="/privacy" target="_blank">Privacy</a></span>
            <span><a href="/rules" target="_blank">Rules</a></span>
        </div>
        <div class="countdown">
            {#if secondsLeft > 0}
            {formatCountdown(secondsLeft)}
            {:else}
            Contest is over!
            {/if}
        </div>
        <div class="company">
            <a class="logo" href="https://dragonfly.xyz" target="_blank">&gt;|&lt;</a>
        </div>
    </footer>
    <Modal bind:show={isShowingIntro}>
        <Dialogue script={introScript} />
    </Modal>
</ModalBed>