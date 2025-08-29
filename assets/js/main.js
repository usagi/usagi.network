// assets/js/main.js
import { start } from "./router.js";
import "./utils/dom.js";        // ensure layout tweaks (top padding) apply immediately
import "./utils/bgm-ui.js";

// DOM 構築後に router を起動（nav のイベントバインドを確実にする）
if (document.readyState === "loading")
{
 window.addEventListener("DOMContentLoaded", start, { once: true });
}
else
{
 start();
}

// 追加の軽量機能は後段で
// (dom.js は上で即時読み込みに変更)
