import { createApp } from "vue";
import NightWatchPanel from "./NightWatchPanel.vue";

let app = null;

export function mountNightWatchPanel(element, props) {
  unmountNightWatchPanel();
  if (!element) return;
  app = createApp(NightWatchPanel, props);
  app.mount(element);
}

export function unmountNightWatchPanel() {
  if (!app) return;
  app.unmount();
  app = null;
}
