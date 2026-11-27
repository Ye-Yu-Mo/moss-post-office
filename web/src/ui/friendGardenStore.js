import { reactive } from "vue";

export const friendGardenStore = reactive({
  snapshot: null
});

export function setFriendGardenSnapshot(snapshot) {
  friendGardenStore.snapshot = snapshot;
}
