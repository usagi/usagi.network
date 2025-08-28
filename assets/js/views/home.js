// assets/js/views/home.js
export async function mount()
{
 console.log("Home page mounted");
 // 暫定: Latest Activity に告知カードを1件だけ表示
 const grid = document.getElementById('latest-grid');
 if (grid){
	grid.innerHTML = '';
	const card = document.createElement('article');
	card.className = 'card card--map';
	card.innerHTML = `
	 <div class="card__cut"></div>
	 <div class="card__body">
		 <span class="card__tag">お知らせ</span>
		 <h3 class="card__title">2025-08-28 USAGI.NETWORK 公式ウェブサイトの再建が開始されました。現在は暫定的に Music と About のみ機能しています。</h3>
		 <div class="card__date">2025-08-28</div>
	 </div>
	`;
	grid.appendChild(card);
 }
 // 必要になればここで追加の fetch/render を行う
}
export function unmount()
{
 // 必要ならイベント解除・DOM掃除
}
export default { mount, unmount };
