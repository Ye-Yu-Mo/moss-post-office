import { createApp } from "vue";
import NightWatchView from "./NightWatchView.vue";

let app = null;

export function mountNightWatch(element, props) {
  unmountNightWatch();
  if (!element) return;
  app = createApp(NightWatchView, props);
  app.mount(element);
}

export function unmountNightWatch() {
  if (!app) return;
  app.unmount();
  app = null;
}
