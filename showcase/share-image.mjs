// Render a new social-preview composition from exact reviewed artwork and local fonts.
// This is a candidate: inspect it and pin its hash before publication.
import {readFile, mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url), pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const asset=async(name,type)=>`data:${type};base64,${(await readFile(new URL('assets/'+name,import.meta.url))).toString('base64')}`;
const [regular,italic,mono,austen,alice,walden]=await Promise.all([
  asset('im-fell-normal.woff2','font/woff2'), asset('im-fell-italic.woff2','font/woff2'),
  asset('martian-mono-normal.woff2','font/woff2'), asset('austen-cover.jpg','image/jpeg'),
  asset('alice-rabbit.png','image/png'), asset('walden-survey.jpg','image/jpeg')
]);
const output=new URL('../test-results/showcase/read-share.jpg',import.meta.url);
await mkdir(new URL('./',output),{recursive:true});
const browser=await pw.chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try {
  const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
  await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8"><style>
    @font-face{font-family:Fell;src:url('${regular}')}@font-face{font-family:Fell;src:url('${italic}');font-style:italic}
    @font-face{font-family:Mono;src:url('${mono}')}
    *{box-sizing:border-box}body{margin:0;width:1200px;height:630px;overflow:hidden;background:#f5f1e7;color:#1f1f1b;font-family:Fell,Georgia,serif}
    .brand{position:absolute;left:58px;top:42px;width:160px;padding-top:24px;font-size:48px;line-height:1}
    .brand span{position:absolute;top:0;left:0;font-size:25px;font-style:italic;color:#ad3525}
    .brand svg{position:absolute;top:7px;left:51px;width:17px;height:12px;fill:none;stroke:#ad3525;stroke-width:2}
    h1{position:absolute;left:58px;top:192px;width:620px;font-size:88px;line-height:1.02;letter-spacing:-2px;font-weight:400;margin:0}
    h1 em{font-weight:400;color:#ad3525}.dot{color:#ad3525}
    .books{position:absolute;left:733px;top:90px;width:410px;height:440px}
    .austen{position:absolute;left:121px;top:-15px;width:211px;height:298px;object-fit:cover;transform:rotate(13deg);box-shadow:8px 12px 20px #20201822}
    .walden{position:absolute;left:-30px;top:278px;width:252px;height:170px;padding:18px;background:#d8dfce;transform:rotate(-9deg);box-shadow:0 10px 22px #2020181c}
    .walden img{width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply}
    .alice{position:absolute;left:42px;top:69px;width:260px;height:357px;padding:3px;background:#eeeadd;transform:rotate(-4deg);box-shadow:0 16px 28px #20201822}
    .alice img{width:100%;height:100%;object-fit:contain;mix-blend-mode:multiply}
    footer{position:absolute;left:58px;right:58px;bottom:35px;display:flex;align-items:baseline;justify-content:space-between;border-top:1px solid #cfc8b8;padding-top:19px}
    .line{font-size:31px}.line em{color:#ad3525}small{font:14px Mono,monospace;letter-spacing:-.2px}
  </style><body>
    <div class="brand"><span>new</span><svg viewBox="0 0 18 12" aria-hidden="true"><path d="m1 11 8-9 8 9"/></svg>reading</div>
    <h1>Make any book<br><em>your own</em><span class="dot">.</span></h1>
    <div class="books" aria-hidden="true"><img class="austen" src="${austen}" alt=""><div class="walden"><img src="${walden}" alt=""></div><div class="alice"><img src="${alice}" alt=""></div></div>
    <footer><span class="line">Read it. <em>Explore it.</em></span><small>newreading.app</small></footer>
  </body></html>`);
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
  await page.screenshot({path:fileURLToPath(output),type:'jpeg',quality:94,animations:'disabled'});
  console.log('Review candidate: '+fileURLToPath(output));
} finally {await browser.close();}
