import { createApp } from "vue";
import MoonView from "./MoonView.vue";

let app = null;

export function mountMoon(element, handlers) {
  unmountMoon();
  if (!element) return;
  app = createApp(MoonView, { handlers });
  app.mount(element);
}

export function unmountMoon() {
  if (!app) return;
  app.unmount();
  app = null;
}
