// assets/js/main.js
import { start } from "./router.js";

// DOM 構築後に router を起動（nav のイベントバインドを確実にする）
if (document.readyState === "loading")
{
 window.addEventListener("DOMContentLoaded", start, { once: true });
}
else
{
 start();
}

// ヒーローの装飾や小さなイベントは後段で
requestIdleCallback?.(() => import("./utils/dom.js"));
