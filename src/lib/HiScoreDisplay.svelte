<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import type { Score } from './types';
    import { formatScore } from "./util";

    export let hiScores: Score[] = [];
    export let message: string | null = null;
    let sortedHiScores: Score[];
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
    }

    .header {
        margin: 0 auto 0.75em auto;
        letter-spacing: 0.5ex;
        animation: blink 0.85s steps(1, end) infinite;
    }

    .entry > * {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .entry >:nth-child(1) {
        width: 5ex;
        padding-right: 1ex;
    }

    .entry >:nth-child(2) {
        width: 24ex;
        text-align: center;
        flex: 1;
    }

    .entry >:nth-child(3) {
        width: 16ex;
        text-align: right;
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
</style>

<div class="component">
    <div class="header">HI SCORES</div>
    <div class="clip" bind:this={scoresElem}>
        {#if message}
        <div class="message">{ message }</div>
        {:else}
        <div>
            {#each sortedHiScores.slice(0,16) as hs, idx}
                <div class="entry">
                    <div>{ idx + 1 }.</div>
                    <div><a href={`https://etherscan.io/address/${hs.address.toLowerCase()}`} target="_blank">{ hs.name }</a></div>
                    <div>{ formatScore(hs.score) }</div>
                </div>
            {/each}
            {#if sortedHiScores.length > 1}
            <div class="more">
                <a href="/scores" target="_blank">...more &gt;&gt;</a>
            </div>
            {/if}
        </div>
        {/if}
    </div>
</div>