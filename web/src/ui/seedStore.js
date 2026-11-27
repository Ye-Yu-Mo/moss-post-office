import { reactive } from "vue";

export const seedStore = reactive({
  snapshot: null
});

export function setSeedSnapshot(snapshot) {
  seedStore.snapshot = snapshot;
}
