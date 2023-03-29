<script lang="ts">
    import { getScores } from "$lib/backend";
    import type { Score } from "$lib/types";
    import { formatScore } from "$lib/util";
    import { onMount } from "svelte";

    let scores: Score[] = [];
    let isLoading = false;
    
    onMount(async () => {
        isLoading = true;
        scores = await getScores(1000);
        isLoading = false;
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
    @keyframes blink {
        0% { opacity: 100% };
        50% { opacity: 15%; }
        100% { opacity: 100%; }
    }
</style>

<div class="component">
    <div class="header">HI SCORES</div>
    {#if isLoading}
    <div class="loading">loading...</div>
    {:else}
    {#each scores as { name, score, address}, idx}
    <div class="entry" class:odd={!!(idx % 2)}>
        <div>{ idx + 1 }.</div>
        <div><a href={`https://etherscan.io/address/${address.toLowerCase()}`} target="_blank">{ name }</a></div>
        <div>{ formatScore(score) }</div>
    </div>
    {/each}
    {/if}
</div>