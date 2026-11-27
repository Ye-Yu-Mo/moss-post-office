import { createApp } from "vue";
import FriendGardenView from "./FriendGardenView.vue";

let app = null;

export function mountFriendGarden(element, handlers) {
  unmountFriendGarden();
  if (!element) return;
  app = createApp(FriendGardenView, { ...handlers });
  app.mount(element);
}

export function unmountFriendGarden() {
  if (!app) return;
  app.unmount();
  app = null;
}
