import { createApp, h } from "vue";
import TownView from "./TownView.vue";

let app = null;

export function mountTown(element, props) {
  unmountTown();
  if (!element) return;
  app = createApp({
    render: () => h(TownView, props)
  });
  app.mount(element);
}

export function unmountTown() {
  if (!app) return;
  app.unmount();
  app = null;
}
