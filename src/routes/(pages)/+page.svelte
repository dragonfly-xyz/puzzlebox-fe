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

    enum SolveStep {
        None = 'Solve',
        Compiling = 'Compiling (1/2)...',
        Simulating = 'Executing (2/2)...',
    }

    let hiScores: Score[] | undefined;
    let account: Account;
    let solveStep: SolveStep = SolveStep.None;
    let solutionError: string | undefined;
    let simResultsWithScore: SimResultsWithScore | undefined = { score: 100 };
    let signScorePromise: Promise<any> | undefined;
    let solutionCode = solutionStubCode;
    let puzzleRenderingEl: HTMLElement | undefined;
    let challengeCodeExpanded = false;
    let isSubmitting: boolean = true;

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
            puzzleRenderingEl,
            { behavior: 'smooth', block: 'start', inline: 'center' },
            { duration: 250 },
        );
    }

    function onSubmitScore() {
        if (!simResultsWithScore || simResultsWithScore.score <= 0) {
            return;
        }
        isSubmitting = true;
        // const score = simResultsWithScore.score;
        // if (submitPromise) {
        //     throw new Error('Alreadying submitting!');
        // }
        // submitPromise = submitScore(name, score, 600, solutionCode)
        //     .then(() => { refreshScores(); })
        //     .finally(() => submitPromise = undefined);
    }

    function expandChallengeCode() {
        challengeCodeExpanded = !challengeCodeExpanded;
    }

    async function refreshScores(): Promise<void> {
        hiScores = await getScores(16);
    }

    onMount(async () => {
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
    .code {
        width: map-get($breakpoints, "xs");
        @media (min-width: map-get($breakpoints, "lg")) {
            width: map-get($breakpoints, "lg");
        }
        @media (min-width: map-get($breakpoints, "md")) {
            width: map-get($breakpoints, "md");
        }
        @media (min-width: map-get($breakpoints, "sm")) {
            width: map-get($breakpoints, "sm");
        }
        min-height: 12em;
        max-height: 32em;
        flex: 100%;
    }
    .challenge.expanded {
        max-height: fit-content;
    }
    .solution {
        max-height: fit-content;
    }
    .filename {
        padding-left: 2ex;
        opacity: 0.75;
    }
    .submit-container {
    }
    .submit-container.hidden {
        display: none;
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
        <HiScoreDisplay hiScores={hiScores || []} message={hiScores ? null : 'Loading...'} scrollSpeed={2000} scrollPause={2500}></HiScoreDisplay>
    </div>
    <div class="challenge code" class:expanded={challengeCodeExpanded}>
        <div class="filename">./PuzzleBox.sol</div>
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
        <div class="filename">./Solution.sol</div>
        <CodeEditor
            bind:contents={solutionCode}
            on:action={onSolve}
            actionText={solveStep}
            busy={solveStep != SolveStep.None}
            bind:error={solutionError}
        />
    </div>
    <div class="submit-container" class:hidden={!isSubmitting}>
        <ScoreSubmit score={simResultsWithScore?.score} solution={solutionCode} />
    </div>
</div>
