<script lang="ts">
    import HiScoreDisplay from '$lib/HiScoreDisplay.svelte';
    import CodeEditor, { ExpandAction } from '$lib/CodeEditor.svelte';
    import PuzzleRendering, { type SimResultsWithScore } from '$lib/PuzzleRendering.svelte';
    import challengeCode from '$lib/sol/PuzzleBox.sol?raw';
    import solutionStubCode from '$lib/sol/Solution.sol?raw';
    import { simulate } from '$lib/simulate';
    import { compile } from '$lib/compile';
    import { solcCompile } from '$lib/worker-compiler';
    import { scoreSimResults } from '$lib/scoring';
    import { getScores, submitScore } from '$lib/backend';
    import type { Score } from '$lib/types';
    import { onMount } from 'svelte';
    import { scrollIntoView } from 'seamless-scroll-polyfill';
    import ScoreSubmit from '$lib/ScoreSubmit.svelte';
    import Modal from '$lib/Modal.svelte';
    import IoIosArrowUp from 'svelte-icons/io/IoIosArrowUp.svelte'
    import IoIosArrowDown from 'svelte-icons/io/IoIosArrowDown.svelte'

    enum SolveStep {
        None = 'Solve',
        Compiling = 'Compiling (1/2)...',
        Simulating = 'Executing (2/2)...',
    }

    let hiScores: Score[] | undefined;
    let account: Account;
    let solveStep: SolveStep = SolveStep.None;
    let solutionError: string | undefined;
    let simResultsWithScore: SimResultsWithScore | undefined;
    let solutionCode = solutionStubCode;
    let puzzleRenderingEl: HTMLElement | undefined;
    let challengeCodeExpanded = false;
    let isSubmitting = false;
    let isShowingTip = false;

    function copyChallenge({detail: contents}: CustomEvent<string>) {
        navigator.clipboard.writeText(contents);
    }

    function onSolve({detail: contents}: CustomEvent<string>) {
        (async () => {
            solveStep = SolveStep.Compiling;
            const artifacts = await compile(contents, solcCompile);
            solveStep = SolveStep.Simulating;
            const simResults = await simulate(artifacts);
            if (simResults.error) {
                throw new Error(`Solution reverted with '${simResults.error}"`);
            }
            simResultsWithScore = {
                simResults,
                score: scoreSimResults(simResults),
            };
        })().then(() => {
            solutionError = undefined;
        }).catch((err) => {
            console.error(err);
            solutionError = err.toString();
        }).then(() => {
            solveStep = SolveStep.None;
        });
    }

    function onSolutionAnimating(e: CustomEvent<any>) {
        scrollIntoView(
            document.querySelector('header'),
            { behavior: 'smooth', block: 'start', inline: 'center' },
            { duration: 250 },
        );
    }

    function onSubmitScore() {
        if (!simResultsWithScore || simResultsWithScore.score <= 0) {
            return;
        }
        isSubmitting = true;
    }

    function expandChallengeCode() {
        challengeCodeExpanded = !challengeCodeExpanded;
    }

    async function refreshScores(): Promise<void> {
        hiScores = await getScores(0, 17);
    }

    onMount(() => {
        const pollScores = async () => {
            let nextPollDelay = 60 * 10 * 1000;
            try {
                await refreshScores();
            } catch (err) {
                console.error(err);
                nextPollDelay = 5000;
            }
            setTimeout(pollScores, nextPollDelay);
        }
        pollScores();
    });
    
</script>

<style lang="scss">
    @import "@picocss/pico/scss/pico.scss";

    .page {
        display: flex;
        flex-direction: column;
        gap: 1em 1em;
        justify-content: center;
        @media (min-width: map-get($breakpoints, "lg")) {
            display: grid;
            grid: min-content max-content max-content / 1fr 1fr;
            flex-direction: row;
            flex-wrap: wrap;
        }
    }
    .rendering {
        width: 21.33em;
        height: 16em;
        margin: auto;
    }
    .hi-scores {
        height: 16em;
        // flex: 100%;
        @media (min-width: map-get($breakpoints, "lg")) {
            flex: 1;
        }
    }
    .tip {
        grid-column: span 2;
        flex-direction: column;
        display: flex;
        font-size: 0.75em;
        align-items: center;
        > .hide-btn {
            gap: 1ex;
            align-items: center;
            white-space: nowrap;
            font-weight: bold;
            height: 1em;
            margin: 0 0.5em 1em 0;
            flex: 0 0 auto;
            display: flex;
        }
        > .message {
            max-height: 64em;
            overflow-y: hidden;
            transition: max-height 0.5s;
        }
        > .message.hidden {
            max-height: 0;
        }
    }
    .code {
        grid-column: span 2;
        > .filename {
            padding-left: 2ex;
            opacity: 0.75;
        }
        > :global(*:last-child) {
            min-height: 24em;
            max-height: 32em;
            height: 1px;
        }
    }
    .challenge.expanded {
        > :global(*:last-child) {
            min-height: 24em;
            max-height: initial;
            height: auto;
        }
    }
    .solution {
        max-height: fit-content;
    }
</style>

<div class="page">
    <div class="rendering-container">
        <div class="rendering">
            <PuzzleRendering
                bind:el={puzzleRenderingEl}
                simResultsWithScore={simResultsWithScore}
                on:submitScore={onSubmitScore}
                on:animating={onSolutionAnimating}
            />
        </div>
    </div>
    <div class="hi-scores">
        <HiScoreDisplay
            hiScores={hiScores || []}
            message={hiScores ? null : 'Loading...'}
            scrollSpeed={2000}
            scrollPause={2500} />
    </div>
    <div class="tip">
        <a
            class="hide-btn"
            on:click|preventDefault|stopPropagation="{() => isShowingTip = !isShowingTip}">
            {#if isShowingTip}
                <div>Hide Tips</div><IoIosArrowUp />
                {:else}
                <div>Show Tips</div><IoIosArrowDown />
            {/if}
        </a>
        <div class="message" class:hidden={!isShowingTip}>
            <ul>
                <li>
                    The puzzlebox is defined by and configured through the following contracts,
                    which present multiple, interconnected EVM challenges you must solve to in
                    order to <strong>Open</strong> the box and save crypto!
                </li>
                <li>
                    Scores are awarded per challenge so even partial solutions will put you on the board.
                </li>
                <li>
                    <a href="https://github.com/dragonfly-xyz/puzzlebox-ctf">Here</a> is a foundry project
                    where you can iterate on and test your solution offline.
                </li>
                <li>
                    Challenge runs from May 5 00:00 UTC to May 7 00:00 UTC.
                    Three winning submissions will be chosen: one highest score, one fastest,
                    and one most creative. Eligible winners will be awarded one <strong>Milady NFT</strong>.
                </li>
                <li>
                    Hackers can compete solo or in teams, but not both.
                    See <a href="/terms">Rules</a> for more information.
                </li>
            </ul>
        </div>
    </div>
    <div class="challenge code" class:expanded={challengeCodeExpanded}>
        <div class="filename">
            <a href="https://github.com/dragonfly-xyz/puzzlebox-ctf/blob/main/src/PuzzleBox.sol">
                ./PuzzleBox.sol
            </a>
        </div>
        <CodeEditor
            
            readOnly
            contents={challengeCode}
            on:action={copyChallenge}
            actionText={'Copy'}
            expandAction={challengeCodeExpanded ? ExpandAction.Inpand : ExpandAction.Expand}
            on:expand={expandChallengeCode}
        />
    </div>
    <div class="solution code">
        <div class="filename">
            <a href="https://github.com/dragonfly-xyz/puzzlebox-ctf/blob/main/src/PuzzleBoxSolution.sol">
                ./Solution.sol
            </a>
        </div>
        <CodeEditor
            bind:contents={solutionCode}
            on:action={onSolve}
            actionText={solveStep}
            busy={solveStep != SolveStep.None}
            bind:error={solutionError}
        />
    </div>
    <Modal bind:show={isSubmitting}>
        <ScoreSubmit score={simResultsWithScore?.score} solution={solutionCode} />
    </Modal>
</div>
