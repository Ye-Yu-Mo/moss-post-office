import { createApp } from "vue";
import SeedModal from "./SeedModal.vue";

let app = null;

export function mountSeedModal(element, handlers) {
  unmountSeedModal();
  if (!element) return;
  app = createApp(SeedModal, { ...handlers });
  app.mount(element);
}

export function unmountSeedModal() {
  if (!app) return;
  app.unmount();
  app = null;
}
