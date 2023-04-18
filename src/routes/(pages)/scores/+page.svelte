<script lang="ts">
    import { getScores, submitScore } from "$lib/backend";
    import type { Score, SubmitData } from "$lib/types";
    import { clearStoredSubmission, formatScore, getStoredSubmission } from "$lib/util";
    import { onMount } from "svelte";
    import { page } from '$app/stores';
    import { browser } from "$app/environment";

    let scores: Score[] | undefined;
    let submitData: SubmitData | undefined;
    let submitKey: string | null | undefined;

    $: (async () => {
        if (browser) {
            if (!submitData) {
                scores = await getScores(500);
            } else {
                await submitScore(submitData);
                clearStoredSubmission(submitKey!);
                submitData = undefined;
            }
        }
    })();

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
    @keyframes blink {
        0% { opacity: 100% };
        50% { opacity: 15%; }
        100% { opacity: 100%; }
    }
</style>

<div class="component">
    <div class="header">HI SCORES</div>
    {#if submitData}
    <div class="loading">Submitting Score...</div>
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