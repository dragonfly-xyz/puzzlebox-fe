<script lang="ts">
    import PuzzleRendering from '$lib/PuzzleRendering.svelte';
    import { onDestroy, onMount } from 'svelte';

    const LAUNCH_DATE = new Date('2023-05-06T00:00:00.000Z');
    let countdownDays = 0;
    let countdownHours = 0;
    let countdownMinutes = 0;
    let countdownSeconds = 0;
    let tickInterval: NodeJS.Timer | undefined;

    function formatDigits(n): string {
        return n.toString().padStart(2, '0');
    }
    
    function tick() {
        let dt = Math.floor(Math.max(0, LAUNCH_DATE.getTime() - Date.now()) / 1e3);
        countdownSeconds = dt % 60;
        dt = Math.floor(dt / 60);
        countdownMinutes = dt % 60;
        dt = Math.floor(dt / 60);
        countdownHours = dt % 24;
        dt = Math.floor(dt / 24);
        countdownDays = Math.floor(dt);
    }
    tick();

    onMount(() => {
        tickInterval = setInterval(tick,1000);
    });

    onDestroy(() => {
        if (tickInterval) {
            clearInterval(tickInterval);
            tickInterval = undefined;
        }
    });
</script>

<style lang="scss">
    @import "@picocss/pico/scss/pico.scss";

    .page {
        display: flex;
        flex-direction: column;
        gap: 1em 1em;
        justify-content: center;
    }
    .rendering {
        width: 21.33em;
        height: 16em;
        margin: auto;
        position: relative;
        > :global(*):first-child {
            opacity: 0.4;
            pointer-events: none;
        }
    }
    .countdown {
        font-family: 'Silkscreen Bold', monospace;
        font-size: 5em;
        display: flex;
        flex-direction: column;
        // justify-content: center;
        align-items: center;
        position: absolute;
        inset: 0;
        pointer-events: none;
        > div > span:nth-child(2) {
            font-size: 0.66em;
            color: #b74d27;
        }
        > div > span:nth-child(1) {
            text-shadow: 0.1em 0.1em 0 rgb(165 148 148 / 48%);
        }
        > div:not(:first-child) {
            margin-top: -0.75em;
        }
        > div:nth-child(2) {
            font-size: 0.75em;
            padding-left: 3.5ex;
        }
        > div:nth-child(3) {
            font-size: 0.56em;
            padding-left: 0.75ex;
        }
        > div:nth-child(4) {
            font-size: 0.421em;
            padding-left: 4.5ex;
        }
    }
</style>

<div class="page">
    <div class="rendering">
        <PuzzleRendering />
        <div class="countdown">
            <div><span>{formatDigits(countdownDays)}</span><span>D</span></div>
            <div><span>{formatDigits(countdownHours)}</span><span>H</span></div>
            <div><span>{formatDigits(countdownMinutes)}</span><span>M</span></div>
            <div><span>{formatDigits(countdownSeconds)}</span><span>s</span></div>
        </div>
    </div>
</div>
