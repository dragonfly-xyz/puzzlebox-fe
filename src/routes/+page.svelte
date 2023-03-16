<script lang="ts">
    // import "@picocss/pico";

    import type { HiScore } from '$lib/HiScoreDisplay.svelte';
    import HiScoreDisplay from '$lib/HiScoreDisplay.svelte';
    import CodeEditor from '$lib/CodeEditor.svelte';
    import PuzzleRendering from '$lib/PuzzleRendering.svelte';
    import { onMount } from 'svelte';
    import { type WalletClient, createWalletClient, custom, getAccount, type Account } from 'viem';

    export let data;
    let client: WalletClient;
    let account: Account;
    onMount(async () => {
        client = createWalletClient({
            transport: custom(window.ethereum),
        });
        const [address] = await client.requestAddresses();
        account = getAccount(address);
        
        const checkConnectedWallet = (() => setTimeout(async () => {
            const [currentAddress] = await client.getAddresses();
            if (currentAddress != account.address) {
                account = getAccount(currentAddress);
            }
            checkConnectedWallet();
        }, 600));
        checkConnectedWallet();
    });

    function onSolved() {
        console.log('solved');
    }
</script>

<style lang="scss">
    @import "@picocss/pico/scss/pico.scss";

    .page {
        display: flex;
        flex-wrap: wrap;
        gap: 2em 1em;
        justify-content: center;
    }
    .rendering-container {
        flex: 1;
    }
    .rendering {
        width: 21.33em;
        height: 16em;
        margin: auto;
    }
    .hi-scores {
        max-height: 16em;
        flex: 100%;
        @media (min-width: map-get($breakpoints, "lg")) {
            flex: 1;
        }
    }
    .challenge {
        height: 13em;
        flex: 100%;
    }
    .solution {
        height: 13em;
        flex: 100%;
    }
    .spacer {
        flex: 100%;
        height: 0;
    }
</style>

<div class="page">
    <div class="rendering-container">
        <div class="rendering">
            <PuzzleRendering></PuzzleRendering>
        </div>
    </div>
    <div class="hi-scores">
        <HiScoreDisplay hiScores={data.hiScores} scrollSpeed={2000} scrollPause={2500}></HiScoreDisplay>
    </div>
    <div class="challenge">
        <CodeEditor readOnly contents={data.challengeCode}></CodeEditor>
    </div>
    <div class="solution">
        <CodeEditor contents={data.solutionCode} on:solved={onSolved}></CodeEditor>
    </div>
</div>
