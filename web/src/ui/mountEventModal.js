import { createApp } from "vue";
import EventModalView from "./EventModalView.vue";

let app = null;

export function mountEventModal(element, handlers) {
  unmountEventModal();
  if (!element) return;
  app = createApp(EventModalView, { ...handlers });
  app.mount(element);
}

export function unmountEventModal() {
  if (!app) return;
  app.unmount();
  app = null;
}
