<script lang="ts" context="module">
    export interface ModalBedContext {
        open(details: ModalDetails): number;
        close(modalId: number): void;
    }
    export interface ModalDetails {
        content: Node[];
        onRequestClose?: () => void;
        onClose?: () => void;
        onOpen?: (id: number) => void;
    }
</script>

<script lang="ts">
    import { onDestroy, onMount, setContext } from "svelte";

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
            ++currentModalId;
            if (modal.onOpen) {
                modal.onOpen(currentModalId);
            }
            return currentModalId;
        },
        close(modalId?: number): boolean {
            if (!modal || (modal !== undefined && modalId !== currentModalId)) {
                return false;
            }
            const _modal = modal;
            if (origModalParent) {
                for (const ch of modal?.content || []) {
                    origModalParent.appendChild(ch);
                }
            }
            origModalParent = undefined;
            modal = undefined;
            ++currentModalId;
            if (_modal.onClose) {
                _modal.onClose();
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

    function onOutsideClick(e: MouseEvent) {
        if (modal) {
            if (modal.onRequestClose) {
                modal.onRequestClose();
            } else {
                ctx.close(currentModalId);
            }
        }
    }

    onMount(() => {
        root.addEventListener('modal-close', (e) => {
            e.stopPropagation();
            if (currentModalId) {
                ctx.close(currentModalId);
            }
        });
    });

    onDestroy(() => {
        ctx.close(currentModalId);
    });
    
</script>

<style lang="scss">
    @keyframes fade-in {
        0% { opacity: 0; }
        100% { opacity: 1; }
    }
    .component {
    }
    .modal-container {
        animation: fade-in 0.5s;
        display: none;
    }
    .modal-container.active {
        position: fixed;
        inset: 0;
        background-color: rgba($color: #340909, $alpha: 0.66);
        display: flex;
        overflow: auto;
    }
    .modal-window {
        margin: auto;
        padding: 2em;
        flex: 1 1 100%;
        display: flex;;
        width: 100%;
        height: 100%;
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
        on:click|self|stopPropagation={onOutsideClick}
    >
        <div class="modal-window" bind:this={modalWindow} on:click|self|stopPropagation={onOutsideClick}>
        </div>
    </div>
</div>

<svelte:body bind:this={body} />