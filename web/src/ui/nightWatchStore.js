import { reactive } from "vue";

export const nightWatchStore = reactive({
  snapshot: null
});

export function setNightWatchSnapshot(snapshot) {
  nightWatchStore.snapshot = snapshot;
}
