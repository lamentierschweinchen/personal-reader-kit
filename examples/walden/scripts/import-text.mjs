import {readFile,writeFile,mkdir,realpath,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fromText,LIMIT} from '../site/core.mjs';
const [input,title,kind='prose'] = process.argv.slice(2);
if (!input || !title) {console.error('Usage: npm run import:text -- /path/to/book.txt "Book title" [prose|verse]');process.exit(1);}
const bytes = await readFile(input);
if (bytes.length > LIMIT) throw new Error('Maximum source size is 8 MB. Split larger works.');
const text = new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
const book = await fromText(text,{title,kind,bytes});
const root = fileURLToPath(new URL('../',import.meta.url)), dir = path.join(root,'.reader','private');
await mkdir(dir,{recursive:true});
if ((await realpath(dir)) !== dir || (await lstat(dir)).isSymbolicLink()) throw new Error('Private output must be a real local directory.');
const output = path.join(dir,`${book.id}.reader.json`);
await writeFile(output,JSON.stringify(book,null,2),{flag:'wx',mode:0o600});
console.log(`Created .reader/private/${book.id}.reader.json. Import it from the reader's Add a book dialog. Nothing was deployed.`);
