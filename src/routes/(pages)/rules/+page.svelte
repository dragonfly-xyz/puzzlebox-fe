<script lang="ts">
    import { base } from '$app/paths';
</script>
<style lang="scss">
    .page {
        display: flex;
        iframe {
            flex: 1;
            min-height: 48em;
        }
    }
</style>
<div class="page">
    <iframe src={`${base}/terms/rules.html`} />
</div>