import { createApp } from "vue";
import WorkshopView from "./WorkshopView.vue";

let app = null;

export function mountWorkshop(element, handlers) {
  unmountWorkshop();
  if (!element) return;
  app = createApp(WorkshopView, { handlers });
  app.mount(element);
}

export function unmountWorkshop() {
  if (!app) return;
  app.unmount();
  app = null;
}
