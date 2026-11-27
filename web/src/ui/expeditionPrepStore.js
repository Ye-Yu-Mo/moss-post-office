import { reactive } from "vue";

export const expeditionPrepStore = reactive({
  snapshot: null
});

export function setExpeditionPrepSnapshot(snapshot) {
  expeditionPrepStore.snapshot = snapshot;
}
