import { createApp } from "vue";
import FriendProfileView from "./FriendProfileView.vue";

let app = null;

export function mountFriendProfile(element, handlers) {
  unmountFriendProfile();
  if (!element) return;
  app = createApp(FriendProfileView, { ...handlers });
  app.mount(element);
}

export function unmountFriendProfile() {
  if (!app) return;
  app.unmount();
  app = null;
}
