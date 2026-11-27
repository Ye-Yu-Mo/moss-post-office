import { reactive } from "vue";

export const moonStore = reactive({
  snapshot: null
});

export function setMoonSnapshot(snapshot) {
  moonStore.snapshot = snapshot;
}
