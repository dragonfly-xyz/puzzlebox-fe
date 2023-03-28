export function formatScore(score: number) {
    return score.toLocaleString('en', {useGrouping: true});
}

