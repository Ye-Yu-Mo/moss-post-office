import { reactive } from "vue";

export const workshopStore = reactive({
  snapshot: null
});

export function setWorkshopSnapshot(snapshot) {
  workshopStore.snapshot = snapshot;
}
