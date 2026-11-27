import { reactive } from "vue";

export const friendProfileStore = reactive({
  snapshot: null
});

export function setFriendProfileSnapshot(snapshot) {
  friendProfileStore.snapshot = snapshot;
}
