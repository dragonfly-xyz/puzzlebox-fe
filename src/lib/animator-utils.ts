import type { Animator } from "./animator";
import type { SimResults } from "./simulate";

export function animateFromResults(animator: Animator, results: SimResults): void {
    if (results.puzzleEvents.length === 0) {
        animator.animateFail();
        return;
    }
    let currentDripIds: number[] = [];
    let burnedDripIds: number[] = [];
    let totalFees = 0;

    const { puzzleEvents: events } = results;

    for (let i = 0; i < events.length; ++i) {
        const e = events[i];
        const { eventName, args: eventArgs } = e;
        if (eventName === 'Operate') {
            animator.animateOperateChallenge();
        } else if (eventName === 'Lock') {
            animator.animateUnlockTorchChallenge();
        } else if (eventName === 'Drip') {
            const mintedIds: number[] = [];
            let mintFees = 0;
            for (; i < events.length; ++i) {
                const nextEvent = events[i];
                if (nextEvent.eventName !== 'Drip') {
                    i = i - 1;
                    break;
                }
                mintedIds.push(Number(nextEvent.args.dripId));
                mintFees += Number(nextEvent.args.fee);
            }
            if (mintFees !== 0) {
                animator.animateTakeFee(totalFees, mintFees);
            }
            if (mintedIds.length !== 0) {
                animator.animateDripChallenge(currentDripIds.length, mintedIds);
            }
            currentDripIds.push(...mintedIds);
            totalFees += mintFees;
        } else if (eventName === 'Burned') {
            const burnedIds: number[] = [];
            for (; i < events.length; ++i) {
                const nextEvent = events[i];
                if (nextEvent.eventName !== 'Burned') {
                    i = i - 1;
                    break;
                }
                burnedIds.push(Number(nextEvent.args.dripId));
            }
            animator.animateBurn(currentDripIds.length, burnedDripIds.length, burnedIds);
            currentDripIds = currentDripIds.filter(id => !burnedDripIds.includes(id));
            burnedDripIds.push(...burnedIds);
        } else if (eventName === 'Torch') {
            animator.animateTorchChallenge();
        } else if (eventName === 'Zip') {
            animator.animateZipChallenge();
        } else if (eventName === 'Creep') {
            animator.animateCreepChallenge();
        } else if (eventName === 'Spread') {
            animator.animateSpreadChallenge(Number(eventArgs.amount));
        } else if (eventName === 'Open') {
            animator.animateOpenChallenge();
        }
    }
}