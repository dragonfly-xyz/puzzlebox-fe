<script lang="ts" context="module">
    export interface ModalBedContext {
        open(details: ModalDetails): number;
        close(modalId: number): void;
    }
    export interface ModalDetails {
        content: Node[];
        onRequestClose?: () => void;
        onClose?: () => void;
    }
</script>

<script lang="ts">
    import { onDestroy, setContext } from "svelte";

    let root: HTMLDivElement;
    let body: HTMLBodyElement;
    let modalWindow : HTMLDivElement;
    let modal: ModalDetails | undefined;
    let origModalParent: Node | null | undefined;
    let currentModalId: number = Math.floor(Math.random() * 100);

    const ctx: ModalBedContext = {
        open(details): number {
            if (modal) {
                const { onClose } = modal;
                this.close(currentModalId);
                onClose?.();
            }
            modal = details;
            origModalParent = modal.content?.[0]?.parentElement || null;
            return ++currentModalId;
        },
        close(modalId?: number): boolean {
            if (!modal || (modal !== undefined && modalId !== currentModalId)) {
                return false;
            }
            const { onClose } = modal;
            if (origModalParent) {
                for (const ch of modal?.content || []) {
                    origModalParent.appendChild(ch);
                }
            }
            origModalParent = undefined;
            modal = undefined;
            ++currentModalId;
            if (onClose) {
                onClose();
            }
            return true;
        }
    };
    setContext('modal-bed', ctx);

    $: {
        if (modalWindow) {
            modalWindow.replaceChildren(...(modal?.content|| []));
            document.body.classList.toggle('noscroll', !!(modal?.content));
            if (modal?.content) {
                modalWindow.parentElement!.scrollTop = 0;
            }
        }
    }

    function onOutsideClick() {
        if (modal) {
            if (modal.onRequestClose) {
                modal.onRequestClose();
            } else {
                ctx.close(currentModalId);
            }
        }
    }

    onDestroy(() => {
        ctx.close(currentModalId);
    });
    
</script>

<style lang="scss">
    .component {
    }
    .overlay {
        display: none;
    }
    .modal-container {
        display: none;
    }
    .modal-container.active {
        position: fixed;
        inset: 0;
        background-color: rgba($color: #340909, $alpha: 0.5);
        display: flex;
        overflow: auto;
    }
    .modal-window {
        margin: auto;
        padding: 2em;
        align-self: center;
        justify-self: center;
    }
    :global(body.noscroll) {
        overflow: hidden;
    }
</style>

<div class="component" bind:this={root}>
    <slot></slot>
    <div
        class="modal-container"
        class:active={!!modal}
        on:click={onOutsideClick}
    >
        <div class="modal-window" bind:this={modalWindow} on:click|stopPropagation>
        </div>
    </div>
</div>

<svelte:body bind:this={body} />