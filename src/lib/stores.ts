import { writable } from "svelte/store";
import { PUBLIC_CONTEST_END_TIMESTAMP } from '$env/static/public';

export let contestSecondsLeft = writable(getContestSecondsLeft());

setInterval(() => {
    contestSecondsLeft.set(getContestSecondsLeft());
}, 1e3);

function getContestSecondsLeft(): number {
    return Number(PUBLIC_CONTEST_END_TIMESTAMP) - Date.now() / 1e3;
}