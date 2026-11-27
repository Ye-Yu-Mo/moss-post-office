import { createApp } from "vue";
import AlbumView from "./AlbumView.vue";

let app = null;

export function mountAlbum(element) {
  unmountAlbum();
  if (!element) return;
  app = createApp(AlbumView);
  app.mount(element);
}

export function unmountAlbum() {
  if (!app) return;
  app.unmount();
  app = null;
}
