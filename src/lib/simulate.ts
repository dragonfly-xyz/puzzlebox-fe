export interface DecodedEvent {
    eventName: string,
    args: any | undefined;
}

export interface SimResults {
    gasUsed: number;
    puzzleEvents: DecodedEvent[];
    error?: string;
}
