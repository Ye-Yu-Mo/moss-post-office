import { createApp } from "vue";
import ExpeditionPrepView from "./ExpeditionPrepView.vue";

let app = null;

export function mountExpeditionPrep(element, handlers) {
  unmountExpeditionPrep();
  if (!element) return;
  app = createApp(ExpeditionPrepView, { ...handlers });
  app.mount(element);
}

export function unmountExpeditionPrep() {
  if (!app) return;
  app.unmount();
  app = null;
}
