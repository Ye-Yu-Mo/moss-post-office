import { reactive } from "vue";

export const nightPanelStore = reactive({
  snapshot: null
});

export function setNightPanelSnapshot(snapshot) {
  nightPanelStore.snapshot = snapshot;
}
