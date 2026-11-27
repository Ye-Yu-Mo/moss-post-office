import { reactive } from "vue";

export const infoStore = reactive({
  snapshot: null
});

export function setInfoSnapshot(snapshot) {
  infoStore.snapshot = snapshot;
}
