<script>
    export const prerender = true;
    import '@picocss/pico';
</script>

<style>
    
    @font-face {
        font-family: 'Superscript';
        src: url('/SUPERSCR.TTF') format('truetype');
    }
    @font-face {
        font-family: 'Silkscreen';
        src: url('/Silkscreen-Regular.ttf') format('truetype');
    }
    @font-face {
        font-family: 'Silkscreen Bold';
        src: url('/Silkscreen-Bold.ttf') format('truetype');
    }
    @font-face {
        font-family: 'VT323';
        src: url('/VT323-Regular.ttf') format('truetype');
    }
    @font-face {
        font-family: 'Comic Mono';
        src: url('/ComicMono.ttf') format('truetype');
    }

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
    .banner .df-ascii {
        font-family: 'Silkscreen', monospace;
        letter-spacing: -0.25ex;
        text-shadow: none;
        margin: -0.15em 0 0 0.25ex;
        transform: rotate(-8deg);
        color: #444;
        float: left;
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
</style>

<header>
    <div class="banner"><span class="df-ascii">&gt;|&lt;</span><span class="text">Puzzlebox<span class="ext">.sol</span></span></div>
    <div class="quick-links">
        <div><a>github</a></div>
        <div><a>twitter</a></div>
    </div>
</header>
<main class="container">
    <slot></slot>
</main>