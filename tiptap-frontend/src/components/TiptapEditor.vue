<template>
    <editor-content v-if="editor" :editor="editor" />
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'

import Collaboration, { isChangeOrigin } from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import UniqueId from '@tiptap-pro/extension-unique-id'
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'

const editor = ref<Editor>()

const ydoc = new Y.Doc()

const provider = new HocuspocusProvider({
    url: 'ws://localhost:1235/collaboration',
    name: 'example-document',
    document: ydoc
})

onMounted(() => {
    editor.value = new Editor({
        extensions: [
            StarterKit.configure({ history: false }),
            UniqueId.configure({
                attributeName: 'uuid',
                types: ['paragraph'],
                filterTransaction: (transaction) => !isChangeOrigin(transaction)
            }),
            Collaboration.configure({
                document: ydoc
            }),
            CollaborationCursor.configure({
                provider
            })
        ]
    })
})

onBeforeUnmount(() => {
    editor.value?.destroy()
})
</script>

<style>
.tiptap {
    padding: 8px;
    line-height: 1.15;
}

.tiptap p {
    margin: 0;
}

/* Give a remote user a caret */
.collaboration-cursor__caret {
    position: relative;
    margin-left: -1px;
    margin-right: -1px;
    border-left: 1px solid #0d0d0d;
    border-right: 1px solid #0d0d0d;
    word-break: normal;
    pointer-events: none;
}

/* Render the username above the caret */
.collaboration-cursor__label {
    position: absolute;
    top: -1.4em;
    left: -1px;
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
    user-select: none;
    color: #0d0d0d;
    padding: 0.1rem 0.3rem;
    border-radius: 3px 3px 3px 0;
    white-space: nowrap;
}
</style>
