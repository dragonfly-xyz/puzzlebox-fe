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
    @font-face {
        font-family: 'Mondwest';
        src: url('/Mondwest-Regular.ttf') format('truetype'); 
    }

    :root {
        --background: white;
        --primary: rgb(250,76,20);
        --primary-hover: rgb(242,242,242);
        --text-primary: black;
        --text-secondary: rgb(242,242,242);
        --accent: purple;
    }
</style>

<slot></slot>