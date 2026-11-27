import { createApp } from "vue";
import RoomNav from "./RoomNav.vue";

let app = null;

export function mountRoomNav(element, props) {
  if (!element) return;
  if (app) return;
  app = createApp(RoomNav, props);
  app.mount(element);
}

export function unmountRoomNav() {
  if (!app) return;
  app.unmount();
  app = null;
}
