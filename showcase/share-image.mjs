// Render the catalogue's social preview from its reviewed artwork and local font.
// Output is a candidate in ignored test-results; inspect it before publication.
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const asset=async(name,type)=>`data:${type};base64,${(await readFile(new URL('assets/'+name,import.meta.url))).toString('base64')}`;
const [font,austen,alice,walden,halls]=await Promise.all([
  asset('bricolage-grotesque.woff2','font/woff2'),
  asset('austen-cover.jpg','image/jpeg'),
  asset('alice-rabbit.png','image/png'),
  asset('walden-survey.jpg','image/jpeg'),
  asset('two-halls-portraits.webp','image/webp')
]);
const output=new URL('../test-results/showcase/read-share.jpg',import.meta.url);
await mkdir(new URL('./',output),{recursive:true});
const browser=await pw.chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
  const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
  await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8"><style>
    @font-face{font-family:Bricolage;src:url('${font}') format('woff2');font-weight:200 800}
    *{box-sizing:border-box}body{margin:0;width:1200px;height:630px;padding:36px 44px;background:#f3f1e7;color:#243d58;font-family:Arial,sans-serif}
    header{display:flex;justify-content:space-between;align-items:center;margin-bottom:48px}
    .brand{font:650 65px/.9 Bricolage;letter-spacing:-4px}.brand span{color:#d94c28}
    h1{font:550 41px/1.05 Bricolage;letter-spacing:-1.6px;margin:0;width:470px;text-align:right}
    .books{display:grid;grid-template-columns:repeat(3,1fr) 1.55fr;gap:20px}
    figure{margin:0;min-width:0}.art{height:250px;display:flex;align-items:center;justify-content:center;overflow:hidden}
    img{display:block;width:100%;height:100%;object-fit:contain}
    .austen{background:#292e29;padding:12px}.austen img{width:auto}
    .alice{background:#dfe9e9;position:relative}.alice img{mix-blend-mode:multiply;position:absolute;width:113%;height:auto;bottom:-39px;left:3px}
    .walden{background:#d6dbce;padding:14px}.walden img{mix-blend-mode:multiply}
    .halls{background:#eee6d6}.halls img{object-fit:cover;object-position:50% 20%;mix-blend-mode:multiply}
    figcaption{font:550 23px/1.2 Bricolage;letter-spacing:-.3px;margin-top:14px}
    footer{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #c3c9c5;margin-top:61px;padding-top:22px;font-size:20px}
    .address{font-size:18px;color:#607079}
  </style><body>
    <header><div class="brand">new reading<span>.</span></div><h1>Your books.<br>Your own app.</h1></header>
    <div class="books">
      <figure><div class="art austen"><img src="${austen}" alt=""></div><figcaption>Pride and Prejudice</figcaption></figure>
      <figure><div class="art alice"><img src="${alice}" alt=""></div><figcaption>Alice in Wonderland</figcaption></figure>
      <figure><div class="art walden"><img src="${walden}" alt=""></div><figcaption>Walden</figcaption></figure>
      <figure><div class="art halls"><img src="${halls}" alt=""></div><figcaption>Two lecture halls</figcaption></figure>
    </div>
    <footer><span>Read, highlight, annotate, share.</span><span class="address">newreading.app</span></footer>
  </body></html>`);
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
  await page.screenshot({path:fileURLToPath(output),type:'jpeg',quality:90,animations:'disabled'});
  console.log('Review candidate: '+fileURLToPath(output));
}finally{await browser.close();}
