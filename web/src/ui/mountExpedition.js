import { createApp } from "vue";
import ExpeditionView from "./ExpeditionView.vue";

let app = null;

export function mountExpedition(element, handlers) {
  unmountExpedition();
  if (!element) return;
  app = createApp(ExpeditionView, { handlers });
  app.mount(element);
}

export function unmountExpedition() {
  if (!app) return;
  app.unmount();
  app = null;
}
