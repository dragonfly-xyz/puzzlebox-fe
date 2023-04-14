<script lang="ts">
    import emojiRegex from 'emoji-regex';
    import pkceChallenge from 'pkce-challenge';
    import { formatScore, storeSubmission } from "./util";
    import { PUBLIC_GH_CLIENT_ID, PUBLIC_TW_CLIENT_ID } from '$env/static/public';
    import { page } from '$app/stores';
    
    const EMOJI_REGIX = emojiRegex();
    const GH_AUTH_URL = 'https://github.com/login/oauth/authorize';
    const TW_AUTH_URL = 'https://twitter.com/i/oauth2/authorize';

    export let score: number = 0;
    export let solution: string | undefined;
    let submitName: string | undefined = 'foo';
    let submitEmail: string | undefined = 'foo@foo.com';
    let canSubmit: boolean = false;
    let isSigning = false;

    $: canSubmit = !!submitName && isValidName(submitName) &&
        !!submitEmail && isValidEmail(submitEmail);

    function isValidName(s: string): boolean {
        return /^[-/\\@a-z0-9_?!.,]+$/.test(s) || EMOJI_REGIX.test(s);
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

    async function signInWithGithub() {
        const key = saveToStorage('github');
        const url = new URL(GH_AUTH_URL);
        url.searchParams.append('client_id', PUBLIC_GH_CLIENT_ID);
        url.searchParams.append('redirect_uri', new URL('/scores', $page.url).toString());
        url.searchParams.append('state', key);
        window.location.href = url.toString();
    }

    function signInWithTwitter() {
        const pkce = pkceChallenge();
        const key = saveToStorage('twitter', pkce.code_verifier);
        console.log(pkce);
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
        position: absolute;
        > *[data-tooltip] {
            border-bottom: 0;
        }
        > *:nth-child(1) {
            font-size: 1.25em;
            text-align: center;
            margin: 0.5em 0;
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
        .hidden {
            display: none;
        }
        button {
            @extend .pixel-corners;
        }
    }
    // .component {
    //     position: absolute;              
    //     left: 0;
    //     top: 0;
    //     width: 100vw;
    //     height: 100vh;

    //     .frame {
    //         width: 90vw;
    //         @media (min-width: map-get($breakpoints, 'sm')) {
    //             width: 10em;
    //         }
    //         height: 100%;
    //     }
    // }
</style>

<div class="component">
    <div class="cover">

    </div>
    <div class="popover">
        <div>
            Your score: <span class="score">{ formatScore(score) }</span>
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
        <div data-tooltip="Where can we reach you about prizes/offers?">
            <div>Contact Email</div>
            <input
                type="text"
                placeholder="email"
                maxlength="24"
                bind:value={submitEmail}
                class:error={submitEmail && !isValidEmail(submitEmail)}
            />
        </div>
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