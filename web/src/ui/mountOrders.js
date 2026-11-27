import { createApp } from "vue";
import OrdersView from "./OrdersView.vue";

let app = null;

export function mountOrders(element, handlers) {
  unmountOrders();
  if (!element) return;
  app = createApp(OrdersView, { handlers });
  app.mount(element);
}

export function unmountOrders() {
  if (!app) return;
  app.unmount();
  app = null;
}
