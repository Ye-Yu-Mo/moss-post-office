import { createApp } from "vue";
import PostcardComposerView from "./PostcardComposerView.vue";

let app = null;

export function mountPostcardComposer(element, handlers) {
  unmountPostcardComposer();
  if (!element) return;
  app = createApp(PostcardComposerView, { ...handlers });
  app.mount(element);
}

export function unmountPostcardComposer() {
  if (!app) return;
  app.unmount();
  app = null;
}
