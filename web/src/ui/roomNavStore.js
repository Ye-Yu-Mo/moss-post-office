import { reactive } from "vue";

export const roomNavStore = reactive({
  snapshot: null
});

export function setRoomNavSnapshot(snapshot) {
  roomNavStore.snapshot = snapshot;
}
