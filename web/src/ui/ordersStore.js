import { reactive } from "vue";

export const ordersStore = reactive({
  snapshot: null
});

export function setOrdersSnapshot(snapshot) {
  ordersStore.snapshot = snapshot;
}
