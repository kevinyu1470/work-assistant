'use strict';
const FoodGuide=(()=>{
const groups=[
{id:'beef',name:'燒肉',en:'A GOOD NIGHT FOR WAGYU',icon:'food',intro:'先選肉的風格，再挑今晚的氣氛。',items:[
['松阪牛燒肉 M・法善寺橫丁店','難波／法善寺','松阪牛・接待便利','想安排一餐精緻和牛，先看這間。大阪觀光局介紹整頭松阪牛採購，也提及中文接待。','松阪牛部位拼盤；是否提供中文服務請訂位時確認。','高預算｜先看套餐與取消規則','https://matsusaka-projects.com/shop/houzenji/','https://osaka-info.jp/spot/matsusaka-beef-yakiniku-m-yokocho/','觀光局推薦'],
['萬兩・南森町店','南森町','肉品選擇・在地人氣','適合把重點放在多種部位與肉的口感。官網設有各店預約入口。','先看當日部位與牛舌選擇；南森町與日本橋是不同分店。','中高預算｜建議先訂位','https://yakiniku-manryo.orwst.com/ja','https://tabelog.com/tw/osaka/A2701/A270103/27002291/','食評參考'],
['板前燒肉一斗・東心齋橋本館','東心齋橋','板前切肉・媒體推薦','想看肉櫃與板前處理，可以列入候選。PopDaily 曾收錄於大阪燒肉專題。','依喜歡的油花與口感詢問部位；先確認本館訂位與公休日。','中高預算｜先確認營業日','https://www.shimizu.or.jp/shop/gourmet/itamaeyakiniku_itto.html','https://www.popdaily.com.tw/travel/605361?is_app=true','PopDaily 專題']
]},
{id:'pot',name:'火鍋',en:'WARM UP, SLOW DOWN',icon:'food',intro:'涮涮鍋、烏龍麵鍋或蟹料理，照口味選。',items:[
['しゃぶ亭・心齋橋店','心齋橋','日式涮涮鍋','喜歡薄切肉與胡麻醬，這間很適合放在心齋橋購物後。','先看牛／豬肉套餐；人數與鍋具安排以訂位確認。','中預算｜官方可預約','https://syabuteisinsaibashi.owst.jp/','','官方資訊'],
['にし家・本店','心齋橋','烏龍麵海鮮鍋','想吃大阪特色的暖胃料理，可考慮店家招牌うどんちり。','烏龍麵鍋與海鮮料理；確認套餐是否有人數限制。','中高預算｜適合慢慢吃','https://udonchiri.nishiya.co.jp/zh/','','官方資訊'],
['蟹道樂・道頓堀本店','道頓堀','蟹料理・聚餐','想把一餐留給蟹料理，從官方套餐挑選較容易掌握內容。','選鍋物前先看套餐；不是所有套餐都包含蟹鍋。','高預算｜建議預約','https://douraku.co.jp/','','官方資訊']
]},
{id:'late',name:'宵夜',en:'ONE MORE BITE',icon:'food',intro:'晚餐後想再吃一點，出發前先查當晚營業。',items:[
['金龍拉麵・道頓堀店','道頓堀','深夜候選・豚骨','巨龍招牌容易辨識，適合道頓堀散步後補一碗。','口味偏清淡的豚骨路線；深夜營業狀況出發前再確認。','平價｜餐量自行斟酌','https://kinryuramen.com/','https://www.nippon.com/hk/japan-topics/c13819/','媒體介紹'],
['たこ焼道楽 わなか・千日前本店','難波千日前','晚間點心・章魚燒','想吃小份大阪名物，從醬汁或鹽味開始挑。','外脆內軟；請先確認打烊時間，並非通宵店。','平價｜適合分食','https://www.takoyaki-wanaka.com/','','官方資訊']
]},
{id:'ramen',name:'拉麵',en:'FIND YOUR FAVORITE BOWL',icon:'food',intro:'清爽、豚骨、經典街頭味，各有一碗。',items:[
['どうとんぼり神座','難波／道頓堀周邊','蔬菜湯底・溫和口味','想換一點較溫和的湯頭，可從招牌おいしいラーメン看起。','依官方門市列表選分店，再確認營業時間。','平價至中價｜購物途中用餐','https://kamukura.co.jp/','','官方資訊'],
['一蘭・阿倍野店','天王寺／阿倍野','豚骨・個人口味調整','適合搭配天王寺、HARUKAS 周邊安排，喜歡豚骨可列入候選。','官方已公告道頓堀本館結束營業，請用阿倍野店地圖。','平價至中價｜留意深夜加收費用','https://zh-cht.ichiran.com/shop/kinki/abeno/','','官方資訊'],
['金龍拉麵・道頓堀店','道頓堀','大阪街頭經典','逛道頓堀時想簡單吃一碗，位置容易和購物串在一起。','與其他金龍分店區分，導航請指定道頓堀店。','平價｜也可列為宵夜備案','https://kinryuramen.com/','','官方資訊']
]},
{id:'beauty',name:'藥妝・保養',en:'A LITTLE BEAUTY HAUL',icon:'bag',intro:'以保養、美妝與藥妝採購為主，先列清單再比價。',items:[
['松本清','心齋橋／難波周邊','美妝保養・官方優惠','適合按品牌與品項一次比較，官網有繁體中文資訊與門市查詢。','先比相同容量與包裝；敏感肌可詢問試用品。','購物預算自訂｜優惠以當日為準','https://tw.matsumotokiyoshi.net/','','官方資訊'],
['大國藥妝・道頓堀中央店','道頓堀','藥妝比價・集中補貨','購物路線經過道頓堀時，可把清單上的相同品項比一輪。','帶商品照片與容量比價；藥品使用問題詢問藥師。','購物預算自訂｜不保證全品最低價','https://daikokudrug.com/store/624/','','官方門市'],
['唐吉訶德・道頓堀御堂筋店','西心齋橋','藥妝＋零食・晚間購物','想把伴手禮、生活用品和美妝一起逛，可放在回飯店前。','品牌、醫藥品銷售與退稅窗口服務時間需依門市確認。','購物預算自訂｜留意結帳排隊','https://www.donki-global.com/zhtw/store/shop_detail.php?shop_id=373','','官方門市']
]},
{id:'buy',name:'必買店家',en:'TAKE A LITTLE OSAKA HOME',icon:'bag',intro:'先挑今晚吃的，再挑適合帶走的。',items:[
['551 蓬萊・心齋橋大丸店','大丸心齋橋 B1','大阪名物・豚まん','適合心齋橋逛街時順路買肉包，也可查看店內用餐選項。','建議旅途中享用；攜帶肉製品返台前請查入境規定。','平價點心｜現做商品留意保存','https://www.551horai.co.jp/shop/list/21/','','官方門市'],
['Rikuro 老爺爺・大丸心齋橋店','大丸心齋橋 B1','現烤起司蛋糕','適合買回飯店與旅伴分食，底部有葡萄乾。','確認當天保存方式與食用期限；不是常溫長途伴手禮。','平價至中價｜適合分食','https://www.daimaru.co.jp/shinsaibashi/shop/rikuro.html','','百貨官方'],
['Moncher・堂島ロール','堂島／心齋橋等','奶油蛋糕捲','偏愛奶香與柔軟蛋糕，可把堂島捲列為下午茶或飯店甜點。','官網列有分店與規格；鮮奶油甜點要留意冷藏。','中價甜點｜依尺寸選購','https://www.mon-cher.com/products/rollcake/dojima_roll.php','','官方商品']
]}
];
function page(){return header('EAT WELL, SHOP SLOWLY','大阪，吃逛靈感簿。','依肉質特色、用餐需求與逛街動線精選。',false)+`<section class="food-hero"><span>CURATED FOR YOUR OSAKA DAYS</span><h2>今晚吃什麼，明天買什麼。</h2><p>六個分類，向右滑就能比較。排序是旅行適合度建議，並非即時評分榜；評價與服務體驗因分店及當天而異。</p><nav class="food-categories" aria-label="推薦分類">${groups.map(g=>`<a href="#food-${g.id}" data-food-jump="${g.id}">${icon(g.icon)}${g.name}</a>`).join('')}</nav></section>${groups.map(g=>`<section class="food-section" id="food-${g.id}"><div class="food-section-top"><div><span class="food-overline">${g.en}</span><h2>${g.name}</h2><p>${g.intro}</p></div><span>向右滑選擇 →</span></div><div class="food-carousel" tabindex="0" aria-label="${g.name}推薦">${g.items.map((x,i)=>`<article class="food-card"><div class="food-card-cover food-${g.id}"><span>SELECT ${String(i+1).padStart(2,'0')}</span>${icon(g.icon)}<strong>${esc(x[2])}</strong></div><div class="food-card-body"><span class="food-area">${icon('pin')}${esc(x[1])}</span><h3>${esc(x[0])}</h3><p class="food-reason">${esc(x[3])}</p><div class="food-detail"><b>怎麼選</b><p>${esc(x[4])}</p></div><p class="food-budget">${esc(x[5])}</p><div class="food-actions"><a class="btn green" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('大阪 '+x[0])}">${icon('pin')}地圖／評價</a><a class="btn" target="_blank" rel="noopener noreferrer" href="${esc(x[6])}">店家資訊 ↗</a></div>${x[7]?`<a class="food-source" target="_blank" rel="noopener noreferrer" href="${esc(x[7])}">${esc(x[8])} ↗</a>`:`<span class="food-source">${esc(x[8])}</span>`}</div></article>`).join('')}</div></section>`).join('')}<p class="food-footer">資訊查核：2026/11/05。預算為相對級距，價格、營業時間、訂位條件以各店官方當日資訊為準。藥妝分類為零售採購建議。</p><details class="panel"><summary>原有交通與旅行提醒</summary><div class="notes-grid">${TRAVEL_NOTES.map(n=>`<section><h3>${esc(n.title)}</h3><p class="note-body">${esc(n.body)}</p></section>`).join('')}</div></details>`;}
document.addEventListener('click',e=>{const a=e.target.closest('[data-food-jump]');if(!a)return;e.preventDefault();document.getElementById('food-'+a.dataset.foodJump)?.scrollIntoView({behavior:'smooth',block:'start'});});
return {page};})();
