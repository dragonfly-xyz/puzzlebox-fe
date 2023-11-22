<script lang="ts">
    import { base } from '$app/paths';
    import { onDestroy, onMount } from "svelte";
    import type { Score } from './types';
    import { formatScore } from "$lib/util";
    import { contestSecondsLeft } from "./stores";

    export let hiScores: Score[] = [];
    export let message: string | null = null;
    let sortedHiScores: Score[];
    let showBadges = false;

    $: showBadges = $contestSecondsLeft < 0;
    $: sortedHiScores = hiScores.sort((a: Score, b: Score) => b.score - a.score);
    
    let scoresElem: HTMLElement;
    let scrollTimer: NodeJS.Timer;
    const SCROLL_INTERVAL = 250;
    export let scrollSpeed = 1500;
    export let scrollPause = 1000;
    let scrollPauseTime = 0;
    let direction = 1;

    onMount(() => {
        scrollTimer = setInterval(() => {
            if (Date.now() - scrollPauseTime < scrollPause) {
                return;
            }
            let s = scoresElem.scrollTop;
            const sh = scoresElem.scrollHeight;
            const eh = sh / hiScores.length;
            const ch = scoresElem.clientHeight;
            let dy = scrollSpeed != 0
                ? direction * Math.max(1, eh / (scrollSpeed / SCROLL_INTERVAL))
                : 0;
            if (s + dy + ch >= sh || s + dy <= 0) {
                direction = -direction;
                scrollPauseTime = Date.now();
            }
            scoresElem.scrollTop = s + dy;
        }, SCROLL_INTERVAL);
    });
    onDestroy(() => {
        clearInterval(scrollTimer);
    })
</script>

<style lang="scss">
    @import "./common.scss";

    .component {
        @extend .pixel-corners;
        font-family: 'Silkscreen Bold', monospace;
        font-weight: bold;
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: #282c34;
        padding: 0.5em;
    }

    .clip {
        overflow: hidden scroll;
        -ms-overflow-style: none;
        scrollbar-width: none;
    }

    .clip::-webkit-scrollbar {
        display: none;
    }

    .entry {
        display: flex;
        flex-direction: row;
        gap: 0.75ex;

        > * {
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        > .rank {
            flex: 0 0 6ex;
            padding-right: 1ex;
        }

        > .name {
            flex: 1 1 auto;
            text-align: center;
        }

        >.score {
            width: 16ex;
            text-align: right;
        }
    }
    .entry.unlocked > .score {
        color: #e2c838
    }

    .header {
        margin: 0 auto 0.75em auto;
        letter-spacing: 0.5ex;
        animation: blink 0.85s steps(1, end) infinite;
    }


    .more {
        text-align: right;
        text-decoration: none;
    }

    .message {
        text-align: center;
    }

    @keyframes blink {
        0% { opacity: 100% };
        50% { opacity: 15%; }
        100% { opacity: 100%; }
    }
    .entry a {
        color: inherit !important;
    }
    
    .entry.odd {
        background-color: rgba(255,255,255,0.05);
    }
    .hidden {
        display: none;
    }
</style>

<div class="component">
    <div class="header"><a href={`${base}/scores`}>HI SCORES</a></div>
    <div class="clip" bind:this={scoresElem}>
        {#if message}
        <div class="message">{ message }</div>
        {:else}
        <div>
            {#each sortedHiScores.slice(0,16) as hs, idx}
                <div class="entry" class:unlocked={hs.unlocked} class:odd={!!(idx % 2)}>
                    <div class="rank">{ idx + 1 }.</div>
                    <div class="badge" class:hidden={!showBadges}>
                        {#if hs.isContestant}
                            {#if hs.isWinner}🏆{:else if hs.firstUnlocked}🎖️{:else}🏅{/if}
                        {/if}
                    </div>
                    <div class="name">
                        <a
                            href={hs.profile}
                            target="_blank"
                        >
                            { hs.name }
                        </a>
                    </div>
                    <div class="score">{ formatScore(hs.score) }</div>
                </div>
            {/each}
            {#if sortedHiScores.length > 16}
            <div class="more">
                <a href="scores" target="_blank">...more &gt;&gt;</a>
            </div>
            {/if}
        </div>
        {/if}
    </div>
</div>