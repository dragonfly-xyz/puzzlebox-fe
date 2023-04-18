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
    import { getScores, submitScore } from "$lib/backend";
    import type { Score, SubmitData } from "$lib/types";
    import { clearStoredSubmission, formatScore, getStoredSubmission } from "$lib/util";
    import { onMount } from "svelte";
    import { page } from '$app/stores';
    import { browser } from "$app/environment";

    const EMOJIS = ['🎊', '✨', '🎉', '🏆', '🎈', '🎖️'];

    let scores: Score[] | undefined;
    let submitData: SubmitData | undefined;
    let submitKey: string | null | undefined;
    let submitted = false;
    let emojifettis: HTMLSpanElement[] = [];
    let emojiTimer: Timer | undefined;

    $: (async () => {
        if (browser) {
            if (!submitData) {
                scores = await getScores(500);
            } else {
                await submitScore(submitData);
                clearStoredSubmission(submitKey!);
                submitData = undefined;
                submitted = true;
            }
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
    }
    @keyframes blink {
        0% { opacity: 100% };
        50% { opacity: 15%; }
        100% { opacity: 100%; }
    }
</style>

<div class="component">
    <div class="header">HI SCORES</div>
    {#if submitted}
    <div class="thanks">
        <div class="emojifettis">
        {#each [...new Array(18)] as _, idx}
        <span bind:this={emojifettis[idx]}>{ EMOJIS[Math.floor(Math.random() * EMOJIS.length)] }</span>
        {/each}
        </div>
        <!-- TODO: show user rank -->
        <div>Thanks for playing! <a href="/">Try again</a> if you like!</div>
    </div>
    {/if}
    {#if submitData}
    <div class="loading">Hang tight! We're submitting your score...</div>
    {:else if !scores}
    <div class="loading">Loading...</div>
    {:else}
    {#each scores as { name, score, profile }, idx}
    <div class="entry" class:odd={!!(idx % 2)}>
        <div>{ idx + 1 }.</div>
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