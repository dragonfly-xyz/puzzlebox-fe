import type { SimResults, DecodedEvent } from './simulate';

interface EventRule {
    weight: number;
    maxCount: number;
    verify?: (args: any) => boolean;
}

export const TORCH_SELECTOR = '0x925facb1';
const BASE_SCORE = 1337;
const GAS_REFERENCE = 1577658;
const TRUE_FN = (..._args: any) => true;
const BREAKPOINT_RULES: { [event: string]: EventRule } = {
    'Operate': { weight: 0.4982, maxCount: 1 },
    'Lock': { weight: 0.75,  maxCount: 1, verify: (args: any) => args.selector === TORCH_SELECTOR && !args.isLocked },
    'Drip': { weight: 1.0 / 10, maxCount: 10 },
    'Torch': { weight: 1.25, maxCount: 1, verify: (args: any) => args.dripIds.length === 6 },
    'Zip': { weight: 1.25, maxCount: 1 },
    'Spread': { weight: 1.5, maxCount: 1, verify: (args: any) => args.remaining === 0n },
    'Open': { weight: 2, maxCount: 1 },
}
const GAS_BONUS = 5000;

export function scoreSimResults(sim: SimResults): number {
    if (sim.error || sim.gasUsed === 0) {
        return 0;
    }
    const eventsGroupedByName = sim.puzzleEvents.reduce((a, v) => {
        a[v.eventName] = [...(a[v.eventName] || []), v];
        return a;
    }, {} as { [event: string]: DecodedEvent[] });
    let score = 0;
    let opened = false;
    for (const eventName in eventsGroupedByName) {
        const rule = BREAKPOINT_RULES[eventName];
        if (!rule) {
            continue;
        }
        const instances = eventsGroupedByName[eventName]
            .filter(i => (rule.verify || TRUE_FN)(i.args))
            .slice(0, rule.maxCount);
        if (eventName === 'Open' && instances.length != 0) {
            opened = true;
        }
        score += rule.weight * instances.length;
    }
    score *= BASE_SCORE;
    if (opened) {
        score += GAS_BONUS * (GAS_REFERENCE / (sim.gasUsed + 1) - 1);
    }
    return Math.floor(score);
}