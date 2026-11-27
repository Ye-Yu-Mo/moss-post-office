import { reactive } from "vue";

export const expeditionStore = reactive({
  snapshot: null
});

export function setExpeditionSnapshot(snapshot) {
  expeditionStore.snapshot = snapshot;
}
