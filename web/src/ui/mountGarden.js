import { createApp } from "vue";
import GardenPanel from "./GardenPanel.vue";

let app = null;

export function mountGarden(element, props) {
  unmountGarden();
  if (!element) return;
  app = createApp(GardenPanel, props);
  app.mount(element);
}

export function unmountGarden() {
  if (!app) return;
  app.unmount();
  app = null;
}
