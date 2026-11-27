import { createApp, h } from "vue";
import AccountView from "./AccountView.vue";

let app = null;

export function mountAccount(element, props) {
  unmountAccount();
  if (!element) return;
  app = createApp({
    render: () => h(AccountView, props)
  });
  app.mount(element);
}

export function unmountAccount() {
  if (!app) return;
  app.unmount();
  app = null;
}
