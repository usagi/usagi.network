// assets/js/views/home.js
export async function mount()
{
 console.log("Home page mounted");
 // 既存の hero や latest-grid の描画ロジックをここに集約
 // fetch('/data/...') が必要ならここで呼ぶ
}
export function unmount()
{
 // 必要ならイベント解除・DOM掃除
}
export default { mount, unmount };
