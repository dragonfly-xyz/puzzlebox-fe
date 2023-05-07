<script lang="ts" context="module">
    const GRAVITY = [0, 5];
    function animateEmojifettis(emojifettis: HTMLSpanElement[] ): NodeJS.Timer {
        for (const e of emojifettis) {
            e.style.display = 'inline';
            e.style.position = 'auto';
        }
        const rects = emojifettis.map(e => e.getBoundingClientRect());
        for (let i = 0; i < rects.length; ++i) {
            const e = emojifettis[i];
            const { x, y } = rects[i];
            e.style.position = 'fixed';
            e.style.left = `${x}px`;
            e.style.top = `${y}px`;
        }
        const endTime = Date.now() + 5000;
        const vels = emojifettis.map(e => [(Math.random() - 0.5) * 25, Math.random() * -40]);
        const offs = emojifettis.map(e => [0,0]);
        const emojiTimer = setInterval(() => {
            for (let idx = 0; idx < emojifettis.length; ++idx) {
                for (let i = 0; i < 2; ++i) {
                    vels[idx][i] = vels[idx][i] + GRAVITY[i];
                    offs[idx][i] = offs[idx][i] + vels[idx][i];
                }
                emojifettis[idx].style.transform = `translate3d(${offs[idx][0]}px, ${offs[idx][1]}px, 0)`;
            }
            if (Date.now() >= endTime) {
                for (const e of emojifettis) {
                    e.style.display = 'none';
                }
                clearInterval(emojiTimer);
            }
        }, 60);
        return emojiTimer;
    }

</script>

<script lang="ts">
    import { getScores, submitScore, type SubmitResult } from "$lib/backend";
    import type { Score, SubmitData } from "$lib/types";
    import { clearStoredSubmission, formatScore, getStoredSubmission } from "$lib/util";
    import { onMount } from "svelte";
    import { page } from '$app/stores';
    import { browser } from "$app/environment";
    import { scrollIntoView } from "seamless-scroll-polyfill";
    import Modal from "$lib/Modal.svelte";
    import { contestSecondsLeft } from '$lib/stores';

    const EMOJIS = ['🎊', '✨', '🎉', '🏆', '🎈', '🎖️'];
    const MAX_COUNT = 500;

    let component: HTMLElement | undefined;
    let scores: Score[] | undefined;
    let submitData: SubmitData | undefined;
    let submitKey: string | null | undefined;
    let submitResult: SubmitResult | undefined;
    let emojifettis: HTMLSpanElement[] = [];
    let emojiTimer: NodeJS.Timer | undefined;
    let showBadges = false;

    $: showBadges = $contestSecondsLeft < 0;

    $: (async () => {
        if (browser) {
            if (submitData) {
                submitResult = await submitScore(submitData);
                clearStoredSubmission(submitKey!);
                submitData = undefined;
            }
        }
    })();

    $: (async () => {
        if (!submitData) {
            let start = 0;
            if (submitResult) {
                start = Math.max(Math.floor(submitResult.rank - 1 - MAX_COUNT / 2), 0);
            }
            scores = await getScores(start, MAX_COUNT);
        }
    })();

    $: {
        if (emojifettis.length) {
            if (emojiTimer) {
                clearInterval(emojiTimer);
            }
            emojiTimer = animateEmojifettis(emojifettis);
        }
    }

    $: {
        if (scores && submitResult) {
            setTimeout(() => scrollIntoView(
                    component!.querySelector('.entry.submitter')!,
                    { behavior: 'smooth', block: 'start', inline: 'center' },
                    { duration: 500 },
                ), 100);
        }
    }

    onMount(() => {
        const pageUrl = $page.url;
        const authCode = pageUrl.searchParams.get('code');
        submitKey = $page.url.searchParams.get('state');
        const submission = submitKey ? getStoredSubmission(submitKey) : null;
        if (authCode && submitKey && submission) {
            submitData = {
                authCode,
                ...submission,
            };
        }
    });
</script>

<style lang="scss">
    @import "@picocss/pico/scss/pico.scss";
    @import "$lib/common.scss";

    .component {
        display: flex;
        flex-direction: column;
        font-family: 'Silkscreen Bold', monospace;
        font-weight: bold;
    }
    .entry {
        font-size: 0.85em;
        @media (min-width: map-get($breakpoints, "sm")) {
            font-size: 1em;
        }

        display: flex;
        flex-direction: row;
        justify-content: space-between;
        gap: 1em;

        > .score {
            text-align: right;
        }
        > .badge {
            text-align: right;
        }
        > .rank {
            flex: 0 0 6ex;
        }
        > .name {
            flex: 1 1 auto;
            text-align: center;
        }
    }
    .entry.odd {
        background-color: rgba(255,255,255,0.05);
    }
    .entry.submitter {
        filter: brightness(2.5);
        background-color: #242424;
    }
    .entry.unlocked > .score {
        color: #e2c838;
    }
    .entry > * {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        gap: 0.75ex;
    }
    .hidden {
        display: none;
    }
    .header {
        align-self: center;
        font-size: 1.5em;
        animation: blink 0.85s steps(1, end) infinite;
        margin-bottom: 1em;
    }
    .loading {
        align-self: center;
    }
    .thanks {
        align-self: center;
        margin: 1em 0;
        text-align: center;
    }
    .emojifettis {
        text-align: center;
        position: relative;
        top: -1em;
        height: 0;
        font-family: auto;
    }
    .submit-popup {
        @extend .pixel-corners;
        
        background-color: var(--background-color);
        padding: 2em 2em;
        width: 42ex;
        display: flex;
        flex-direction: column;
        height: fit-content;
        margin: auto;
        justify-content: center;
        align-items: center;

        @media (min-width: map-get($breakpoints, "md")) {
            width: 52ex;
        }

        .spinner,
        .spinner:before,
        .spinner:after {
            width: 2.5em;
            height: 2.5em;
            -webkit-animation-fill-mode: both;
            animation-fill-mode: both;
            -webkit-animation: load7 1.8s infinite ease-in-out;
            animation: load7 1.8s infinite ease-in-out;
        }
        .spinner {
            color: var(--primary);
            font-size: 0.5em;
            margin: 1em auto;
            position: relative;
            text-indent: -9999em;
            -webkit-transform: translateZ(0);
            -ms-transform: translateZ(0);
            transform: translateZ(0);
            -webkit-animation-delay: -0.16s;
            animation-delay: -0.16s;
        }
        .spinner:before,
        .spinner:after {
            content: '';
            position: absolute;
            top: 0;
        }
        .spinner:before {
            left: -3.5em;
            -webkit-animation-delay: -0.32s;
            animation-delay: -0.32s;
        }
        .spinner:after {
            left: 3.5em;
        }
        @-webkit-keyframes load7 {
            0%,
            80%,
            100% {
                box-shadow: 0 2.5em 0 -1.3em;
            }
            40% {
                box-shadow: 0 2.5em 0 0;
            }
        }
        @keyframes load7 {
            0%,
            80%,
            100% {
                box-shadow: 0 2.5em 0 -1.3em;
            }
            40% {
                box-shadow: 0 2.5em 0 0;
            }
        }
    }
    @keyframes blink {
        0% { opacity: 100% };
        50% { opacity: 15%; }
        100% { opacity: 100%; }
    }
</style>

<div class="component" bind:this={component}>
    <div class="header">HI SCORES</div>
    <Modal show={!!submitData} captive={true}>
        <div class="submit-popup">
            <div class="message">submitting your score...</div>
            <div class="spinner">.</div>
        </div>
    </Modal>
    {#if submitResult}
    <div class="thanks">
        <div class="emojifettis">
        {#each [...new Array(18)] as _, idx}
        <span bind:this={emojifettis[idx]}>{ EMOJIS[Math.floor(Math.random() * EMOJIS.length)] }</span>
        {/each}
        </div>
        <!-- TODO: show user rank -->
        <div>Thanks for playing! Wanna <a href="/">try again</a>?</div>
    </div>
    {:else if !scores}
    <div class="loading">Loading scores...</div>
    {/if}
    {#if scores}
    {#each scores as hs, idx}
    <div class="entry"
        class:odd={!!(idx % 2)}
        class:unlocked={hs.unlocked}
        class:submitter={submitResult && submitResult.rank === hs.rank}
    >
        <div class="rank">{ hs.rank }.</div>
        <div class="badge" class:hidden={!showBadges}>
            {#if hs.isContestant}
                {#if hs.isWinner}🏆{:else if hs.firstUnlocked}🎖️{:else}🏅{/if}
            {/if}
        </div>
        <div class="name"><a href={hs.profile} target="_blank">{ hs.name }</a></div>
        <div class="score">{ formatScore(hs.score) }</div>
    </div>
    {/each}
    {/if}
</div>