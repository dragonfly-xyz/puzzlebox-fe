<style>
    header {
        font-family: 'Silkscreen', monospace;
        display: flex;
        flex-direction: column;
    }
    main {
        font-family: 'Silkscreen', monospace;
        padding-top: 0;
    }
    .banner {
        font-size: 3em;
        align-self: center;
    }
    .banner .text {
        font-family: 'Superscript', monospace;
        -webkit-font-smoothing: none;
        text-shadow: 0.15em 0.15em rgba(146, 146, 146, 0.3);
    }
    .banner .text .ext {
        font-size: 0.66em;
    }
    .banner a {
        color: rbg(250,76,20) !important;
        text-decoration: none !important;
    }
    .subbanner {
        font-size: 1em;
    }
    .subbanner .text{
        font-family: 'Silkscreen', monospace;
        text-shadow: none;
    }
    .quick-links {
        display: flex;
        flex-direction: row;
        align-self: center;
        font-size: 0.9em;
    }
    .quick-links > * + *::before {
        content: ' • ';
        white-space: pre;
    }
    footer {
        display: flex;
        flex-direction: column;
        align-items: end;
        padding: 0 2em 1em 2em;
        font-family: 'Silkscreen', monospace;
    }
    footer .dfly {
        letter-spacing: -0.25ex;
        outline: 0;
    }
</style>

<header>
    <div class="banner"><a class="text" href="/">Puzzlebox<span class="ext">.sol</span></a></div>
    <div class="banner subbanner"><a class="text" href="https://www.dragonfly.xyz/">A CTF from Dragonfly</a></div>
    <div class="quick-links">
        <div><a href="https://github.com/dragonfly-xyz/puzzlebox-ctf">github</a></div>
        <div><a href="https://twitter.com/merklejerk">support</a></div>
        <div><a href="https://jobs.dragonfly.xyz/jobs">jobs</a></div>
    </div>
</header>
<main class="container">
    <slot></slot>
</main>
<footer>
    <div>
        <a class="dfly" href="https://dragonfly.xyz" target="_blank">&gt;|&lt;</a>
    </div>
</footer>