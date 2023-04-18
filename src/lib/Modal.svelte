<script lang="ts">
    import { getContext, onDestroy } from "svelte";
    import type { ModalBedContext } from "./ModalBed.svelte";

    const bedCtx = getContext('modal-bed') as ModalBedContext;
    export let show = false;
    let root: HTMLDivElement;
    let id: number | undefined;

    $: {
        if (root) {
            if (show) {
                console.log('show');
                if ($$slots.default) {
                    id = bedCtx.open({
                        content: [...root.children],
                        onClose() {
                            console.log('sheee');
                            show = false;
                            id = undefined;
                        },
                    });
                }
            } else if(id) {
                console.log('hide');
                bedCtx.close(id);
            }
        }
    }

    onDestroy(() => {
        if (id !== undefined) {
            bedCtx.close(id);
        }
    })
</script>

<style lang="scss">
    .component {
        display: none;
    }
</style>

<div class="component" bind:this={root}>
    <slot></slot>
</div>