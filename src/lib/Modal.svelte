<script lang="ts">
    import { getContext, onDestroy } from "svelte";
    import type { ModalBedContext } from "./ModalBed.svelte";

    const bedCtx = getContext('modal-bed') as ModalBedContext;
    export let show = false;
    export let captive = false;
    let root: HTMLDivElement;
    let id: number | undefined;

    $: {
        if (root) {
            if (show) {
                if ($$slots.default) {
                    id = bedCtx.open({
                        content: [...root.children],
                        onOpen(id: number) {
                            for (const ch of this.content) {
                                ch.dispatchEvent(new CustomEvent('modal-open', { bubbles: false }));
                            }
                        },
                        onClose() {
                            show = false;
                            id = undefined;
                            for (const ch of this.content) {
                                ch.dispatchEvent(new CustomEvent('modal-close', { bubbles: false }));
                            }
                        },
                        onRequestClose() {
                            if (!captive) {
                                bedCtx.close(id!);
                            }
                        }
                    });
                }
            } else if(id) {
                bedCtx.close(id);
            }
        }
    }
    onDestroy(() => {
        if (id !== undefined) {
            bedCtx.close(id);
        }
    });
</script>

<style lang="scss">
    .component {
        display: none;
    }
</style>

<div class="component" bind:this={root}>
    <slot></slot>
</div>