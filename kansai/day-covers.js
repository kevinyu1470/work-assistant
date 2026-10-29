'use strict';
// Public scenic-photo catalogue. The selected day and private itinerary stay in
// the shared cloud document; no dates or sharing credentials belong here.
const DAY_COVERS=Object.freeze([
 {id:'harukas',label:'HARUKAS 300・大阪夜景',priority:100,match:/harukas|ハルカス|阿倍野|阿倍諾/i,src:'https://www.neverendingvoyage.com/wp-content/uploads/2019/03/abeno-harukas300-20.jpg',source:'https://www.neverendingvoyage.com/abeno-harukas-300-osaka/',credit:'Never Ending Voyage',position:'64% 48%'},
 {id:'nara',label:'奈良公園・小鹿散步',priority:110,match:/奈良|nara|餵鹿|小鹿|鹿せんべい/i,src:'https://www.snowmonkeyresorts.com/wp-content/uploads/2021/03/3531103_m-2.jpg',source:'https://www.snowmonkeyresorts.com/activities/nara-park/',credit:'Snow Monkey Resorts',position:'64% 62%'},
 {id:'katsuoji',label:'勝尾寺・達摩與紅葉',priority:120,match:/勝尾寺|勝尾|katsuo|達摩|だるま|ダルマ/i,src:'https://his-food-travel.com/cdn/shop/articles/Katsuouji_view.jpg?v=1641380828',source:'https://his-food-travel.com/es/blogs/food-and-travel/a-famous-autumn-leaves-spot-with-daruma-katsuo-ji-temple-osaka',credit:'HIS JAPAN',position:'68% 50%'},
 {id:'amanohashidate',label:'天橋立・海灣風景',priority:115,match:/天橋立|amanohashidate/i,src:'https://www.kyoto.coop/musubi/uploads/h1_7_amanohashidate.jpg',source:'https://www.kyoto.coop/musubi/vol08/post_26/',credit:'京都生協 むすび。',position:'65% 55%'},
 {id:'arashiyama',label:'嵐山・竹林小徑',priority:120,match:/嵐山|arashiyama|竹林|渡月橋|天龍寺/i,src:'https://mediaim.expedia.com/destination/2/6f024abcd72a361f2ef55a471e0d51a6.jpg',source:'https://www.expedia.com.tw/Arashiyama-Bamboo-Grove-Arashiyama.d553248621526920833.Place-To-Visit',credit:'Expedia',position:'68% 50%'},
 {id:'usj',label:'日本環球影城・經典地球',priority:125,match:/環球|\busj\b|universal|ニンテンドー/i,src:'https://s3.voyapon.com/wp-content/uploads/2021/10/15131104/Pokemon-USJ-01-1024x683.jpg',source:'https://voyapon.com/pokemon-theme-park-universal-studios-japan/',credit:'VOYAPON',position:'68% 45%'},
 {id:'fushimi',label:'伏見稻荷・千本鳥居',priority:125,match:/伏見|稻荷|稲荷|千本鳥居|fushimi|inari/i,src:'https://media.cntraveler.com/photos/55ad686d0121edec2570635b/16%3A9/w_2560%2Cc_limit/sake-Fushimi-Inari-Shrine-cr-alamy.jpg',source:'https://www.cntraveler.com/stories/2015-07-20/drinking-sake-in-kyoto-the-8-essential-places',credit:'Condé Nast Traveler / Alamy',position:'62% 50%'},
 {id:'kaiyukan',label:'海遊館・鯨鯊的藍色世界',priority:130,match:/海遊館|海游館|kaiyukan|鯨鯊|ジンベエ/i,src:'https://www.kaiyukan.com/blog/img/201507_kai2.jpg',source:'https://www.kaiyukan.com/connect/blog/2015/07/post-750.html',credit:'大阪海遊館',position:'72% 48%'},
 {id:'dotonbori',label:'心齋橋・道頓堀街景',priority:80,match:/道頓|心齋|心斎|難波|なんば|namba|dotonbori|shinsaibashi|固力果/i,src:'https://mushroomtravelpage.b-cdn.net/wp-content/uploads/2024/04/Shinsaibashi-shutterstock_445950196.jpg',source:'https://www.mushroomtravel.com/page/shopping-osaka-japan/',credit:'Mushroom Travel / Shutterstock',position:'58% 50%'}
]);
function pickDayCover(events){
 let best=null;
 for(const event of events){
  // Notes may mention a different day. Only this event's title and location
  // determine its scenic cover; transit stops rank below actual visits.
  const text=(String(event.title||'')+' '+String(event.location||'')).normalize('NFKC');
  for(const cover of DAY_COVERS){
   if(!cover.match.test(text))continue;
   const score=cover.priority+(event.type==='travel'?-60:event.type==='food'?-10:20);
   if(!best||score>best.score)best={...cover,eventTitle:event.title,eventId:event.id,score};
  }
 }
 return best||{id:'fallback',label:'今天的旅行風景',src:'autumn.svg',position:'right center',eventTitle:'',eventId:'',source:'',credit:''};
}
function attachDayCover(){
 const image=document.querySelector('[data-day-cover]');if(!image)return;
 image.addEventListener('error',()=>{
  const hero=image.closest('.hero');image.src='autumn.svg';image.alt='關西秋日旅行插畫';
  image.style.objectPosition='right center';hero.classList.remove('hero-photo');hero.classList.add('hero-fallback');
  hero.querySelector('.hero-credit')?.remove();
 },{once:true});
 // Cached failures may finish before the listener is attached.
 if(image.complete&&image.naturalWidth===0)image.dispatchEvent(new Event('error'));
}
