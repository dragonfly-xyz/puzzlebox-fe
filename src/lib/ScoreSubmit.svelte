<script lang="ts">
    import pkceChallenge from 'pkce-challenge';
    import { formatScore, storeSubmission } from "./util";
    import {
        PUBLIC_GH_CLIENT_ID_DRAGONFLY,
        PUBLIC_GH_CLIENT_ID_LOCALHOST,
        PUBLIC_GH_CLIENT_ID_NETLIFY,
        PUBLIC_TW_CLIENT_ID,
    } from '$env/static/public';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    
    const GH_AUTH_URL = 'https://github.com/login/oauth/authorize';
    const TW_AUTH_URL = 'https://twitter.com/i/oauth2/authorize';

    export let score: number = 0;
    export let solution: string | undefined;
    let root: HTMLDivElement;
    let submitName: string | undefined;
    let submitEmail: string | undefined;
    let canSubmit: boolean = false;
    let isSigning = false;
    let termsAgreed = false;

    $: canSubmit = !!submitName && isValidName(submitName) &&
        !!submitEmail && isValidEmail(submitEmail) &&
        termsAgreed;

    function isValidName(s: string): boolean {
        return s.length <= 32 && 
            /^[-/\\@a-z0-9_?!.,^~]*$/i.test(s);
    }

    function isValidEmail(s: string): boolean {
        return /^[^\s@]+@\S+\.\w+$/.test(s);
    }

    function saveToStorage(authType: 'github' | 'twitter', verifier?: string): string {
        return storeSubmission({
            authType,
            verifier,
            solution: solution!,
            email: submitEmail!,
            name: submitName!,
        });
    }

    function getGithubClientId(): string {
        const { hostname } = new URL($page.url);
        if (hostname === 'localhost') {
            return PUBLIC_GH_CLIENT_ID_LOCALHOST;
        }
        if (hostname.match(/netlify.app$/)) {
            return PUBLIC_GH_CLIENT_ID_NETLIFY;
        }
        return PUBLIC_GH_CLIENT_ID_DRAGONFLY;
    }

    async function signInWithGithub() {
        const key = saveToStorage('github');
        const url = new URL(GH_AUTH_URL);
        url.searchParams.append('client_id', getGithubClientId());
        url.searchParams.append('redirect_uri', new URL('/scores', $page.url).toString());
        url.searchParams.append('state', key);
        window.location.href = url.toString();
    }

    function signInWithTwitter() {
        const pkce = pkceChallenge();
        const key = saveToStorage('twitter', pkce.code_verifier);
        const url = new URL(TW_AUTH_URL);
        url.searchParams.append('response_type', 'code');
        url.searchParams.append('client_id', PUBLIC_TW_CLIENT_ID);
        url.searchParams.append('redirect_uri', new URL('/scores', $page.url).toString());
        url.searchParams.append('state', key);
        url.searchParams.append('code_challenge', pkce.code_challenge);
        url.searchParams.append('code_challenge_method', 'S256');
        url.searchParams.append('scope', 'tweet.read users.read');
        window.location.href = url.toString();
    }
</script>

<style lang="scss">
    @import "@picocss/pico/scss/pico.scss";
    @import "./common.scss";

    .component {
        @extend .pixel-corners;
        
        background-color: var(--background-color);
        padding: 1em 2em;
        width: 42ex;
        display: flex;
        flex-direction: column;
        gap: 0.5em;
        height: fit-content;
        margin: auto;

        @media (min-width: map-get($breakpoints, "md")) {
            width: 52ex;
        }

        > *:nth-child(1) {
            font-size: 1.25em;
            margin: 1em 0;
            text-align: center;
        }
        .score {
            font-family: 'Silkscreen', monospace;
            font-weight: bold;
        }
        button > .icon {
            height: 1.25em;
            filter: invert(1);
        }
        input.error {
            color: red;
            background-color: rgba(255,0,0,0.1);
            border: red 1px solid;
        }
        input[type=text] {
            margin-bottom: 0;
        }
        .hidden {
            display: none;
        }
        button {
            @extend .pixel-corners;
        }
        .buttons {
            display: flex;
            flex-direction: column;
        }
        .terms {
            display: flex;
            justify-content: center;
            margin: 1em;
            cursor: pointer;

            a {
                text-decoration: underline;
            }
        }
    }
</style>

<div class="component" bind:this={root}>
    <div>
        Your score: 🎉<span class="score">{ formatScore(score) }</span>🎉
    </div>
    <div>
        <div>Scoreboard Name</div>
        <input
            type="text"
            placeholder="name"
            maxlength="24"
            bind:value={submitName}
            class:error={submitName && !isValidName(submitName)}
        />
    </div>
    <div>
        <div>Contact Email</div>
        <input
            type="text"
            placeholder="For prizes/offers!"
            maxlength="24"
            bind:value={submitEmail}
            class:error={submitEmail && !isValidEmail(submitEmail)}
        />
    </div>
    <div class="terms">
        <div on:click={() => termsAgreed = !termsAgreed}>
            <input type="checkbox" bind:checked={termsAgreed} /> Agree to <a href="rules" target="_blank" on:click|stopPropagation>terms</a>
        </div>
    </div>
    <div class="buttons">
        <button
                class="github"
                aria-busy={!!isSigning}
                disabled={!canSubmit}
                on:click|preventDefault={signInWithGithub}>
                <img class="icon" src="gh-icon.svg" />
                Sign with Github
        </button>
        <button
            class="twitter"
            aria-busy={!!isSigning}
            disabled={!canSubmit}
                on:click|preventDefault={signInWithTwitter}>
                <img class="icon" src="tw-icon.svg" />
                Sign with Twitter
        </button>
    </div>
</div>