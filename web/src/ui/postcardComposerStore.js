import { reactive } from "vue";

export const postcardComposerStore = reactive({
  snapshot: null
});

export function setPostcardComposerSnapshot(snapshot) {
  postcardComposerStore.snapshot = snapshot;
}
