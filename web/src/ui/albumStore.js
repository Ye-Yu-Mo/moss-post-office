import { reactive } from "vue";

export const albumStore = reactive({
  snapshot: null
});

export function setAlbumSnapshot(snapshot) {
  albumStore.snapshot = snapshot;
}
