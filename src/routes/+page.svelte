<script lang="ts">
    import HiScoreDisplay from '$lib/HiScoreDisplay.svelte';
    import CodeEditor from '$lib/CodeEditor.svelte';
    import PuzzleRendering, { type SimResultsWithScore } from '$lib/PuzzleRendering.svelte';
    import challengeCode from '$lib/sol/PuzzleBox.sol?raw';
    import solutionStubCode from '$lib/sol/Solution.sol?raw';
    import { simulate } from '$lib/simulate';
    import { compile } from '$lib/compile';
    import { solcCompile } from '$lib/worker-compiler';
    import { scoreSimResults } from '$lib/scoring';
    import { submitScore } from '$lib/submit-score';

    enum SolveStep {
        None = 'Solve',
        Compiling = 'Compiling (1/2)...',
        Simulating = 'Executing (2/2)...',
    }

    export let data;
    let account: Account;
    let solveStep: SolveStep = SolveStep.None;
    let solutionError: string | null = null;
    let simResultsWithScore: SimResultsWithScore | null = null;
    let isSubmittingScore: boolean;
    let solutionCode = solutionStubCode;

    function copyChallenge({detail: contents}) {
        navigator.clipboard.writeText(contents);
    }

    function onSolve({detail: contents}) {
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
            solutionError = null;
        }).catch((err) => {
            console.error(err);
            solutionError = err.toString();
        }).then(() => {
            solveStep = SolveStep.None;
        });
    }

    function onSubmitScore({ detail }: { detail: { name: string, score: number } } ) {
        if (detail.score <= 0) {
            return;
        }
        isSubmittingScore = true;
        submitScore(detail.name, detail.score, 600, solutionCode)
            .catch(err => console.error(err))
            .then(isSubmittingScore = false);
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
            <PuzzleRendering
                simResultsWithScore={simResultsWithScore}
                on:submitScore={onSubmitScore}
            />
        </div>
    </div>
    <div class="hi-scores">
        <HiScoreDisplay hiScores={data.hiScores} scrollSpeed={2000} scrollPause={2500}></HiScoreDisplay>
    </div>
    <div class="challenge">
        <CodeEditor readOnly contents={challengeCode} on:action={copyChallenge} actionText={'Copy'}></CodeEditor>
    </div>
    <div class="solution">
        <CodeEditor
            bind:contents={solutionCode}
            on:action={onSolve}
            actionText={solveStep}
            busy={solveStep != SolveStep.None}
            bind:error={solutionError}
        ></CodeEditor>
    </div>
</div>
