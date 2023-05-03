import type { SimResults, DecodedEvent } from './simulate';

interface EventRule {
    weight: number;
    maxCount: number;
    refGas: number,
    verify?: (args: any) => boolean;
}

export const TORCH_SELECTOR = '0x925facb1';
const BASE_SCORE = 1337;
const TRUE_FN = (..._args: any) => true;
const BREAKPOINT_RULES: { [event: string]: EventRule } = {
    'Operate': { weight: 0.5, maxCount: 1, refGas: 80e3 },
    'Lock': { weight: 0.75,  maxCount: 1, refGas: 10e3, verify: (args: any) => args.selector === TORCH_SELECTOR && !args.isLocked },
    'Drip': { weight: 1.0 / 10, maxCount: 10, refGas: 500e3 / 10 },
    'Torch': { weight: 1.25, maxCount: 1, refGas: 31e3, verify: (args: any) => args.dripIds.length === 6 },
    'Zip': { weight: 1.25, maxCount: 1, refGas: 110e3 },
    'Creep': { weight: 1.25, maxCount: 1, refGas: 92e3 },
    'Spread': { weight: 1.5, maxCount: 1, refGas: 50e3, verify: (args: any) => args.remaining === 0n },
    'Open': { weight: 4, maxCount: 1, refGas: 37e3 },
}

export function scoreSimResults(sim: SimResults): number {
    if (sim.error || sim.gasUsed === 0) {
        return 0;
    }
    const eventsGroupedByName = sim.puzzleEvents.reduce((a, v) => {
        a[v.eventName] = [...(a[v.eventName] || []), v];
        return a;
    }, {} as { [event: string]: DecodedEvent[] });
    let rawScore = 0;
    let opened = false;
    let totalRefGas = 0;
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
        rawScore += rule.weight * instances.length;
        totalRefGas += rule.refGas * instances.length;
    }
    rawScore *= BASE_SCORE;
    const gasMultiplier = totalRefGas / (sim.gasUsed + 1);
    const score = rawScore * gasMultiplier;
    return Math.floor(score);
}