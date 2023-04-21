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

    const EMOJIS = ['🎊', '✨', '🎉', '🏆', '🎈', '🎖️'];
    const MAX_COUNT = 500;

    let component: HTMLElement | undefined;
    let scores: Score[] | undefined;
    let submitData: SubmitData | undefined;
    let submitKey: string | null | undefined;
    let submitResult: SubmitResult | undefined;
    let emojifettis: HTMLSpanElement[] = [];
    let emojiTimer: NodeJS.Timer | undefined;

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
    .component {
        display: flex;
        flex-direction: column;
        font-family: 'Silkscreen Bold', monospace;
        font-weight: bold;
    }
    .entry {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        gap: 1em;
    }
    .entry.odd {
        background-color: rgba(255,255,255,0.05);
    }
    .entry.submitter {
        filter: brightness(2.5);
        background-color: #242424;
    }
    .entry > * {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        margin: 0 1ex;
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
    @keyframes blink {
        0% { opacity: 100% };
        50% { opacity: 15%; }
        100% { opacity: 100%; }
    }
</style>

<div class="component" bind:this={component}>
    <div class="header">HI SCORES</div>
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
    {:else if submitData}
    <div class="loading">Uploading score...</div>
    {:else if !scores}
    <div class="loading">Loading scores...</div>
    {/if}
    {#if scores}
    {#each scores as { name, score, profile, rank }, idx}
    <div class="entry"
        class:odd={!!(idx % 2)}
        class:submitter={submitResult && submitResult.rank === rank}
    >
        <div>{ rank }.</div>
        <div>
            <a
                href={profile}
                target="_blank"
            >
                { name }
            </a>
        </div>
        <div>{ formatScore(score) }</div>
    </div>
    {/each}
    {/if}
</div>