// Return to the reader route that launched this game. Never change reader records.
const key='newreading-game-return-alice';
let hash='';try{hash=sessionStorage.getItem(key)||'';}catch{}
if(!/^#(?:shelf|companion|passages|read\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)$/.test(hash))hash='';
for(const a of document.querySelectorAll('a[href="../"]'))a.href='../'+hash;
if('serviceWorker' in navigator)navigator.serviceWorker.register(new URL('../sw.js',import.meta.url),{scope:new URL('../',import.meta.url).pathname}).catch(()=>{});

// Announce the fresh table after Restart without changing the game module.
document.querySelector('#restart')?.addEventListener('click',()=>{document.querySelector('#live').textContent='Ready. Hold a cup to begin.';});
