import { reactive } from "vue";

export const eventStore = reactive({
  snapshot: null
});

export function setEventSnapshot(snapshot) {
  eventStore.snapshot = snapshot;
}
