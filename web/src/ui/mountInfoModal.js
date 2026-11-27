import { createApp } from "vue";
import InfoModal from "./InfoModal.vue";

let app = null;

export function mountInfoModal(element) {
  unmountInfoModal();
  if (!element) return;
  app = createApp(InfoModal);
  app.mount(element);
}

export function unmountInfoModal() {
  if (!app) return;
  app.unmount();
  app = null;
}
