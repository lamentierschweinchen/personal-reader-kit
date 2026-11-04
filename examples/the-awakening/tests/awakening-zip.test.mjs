import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {packLicensedZip,unpackLicensedZip} from '../site/awakening-zip.mjs';
const license=new Uint8Array(await readFile(new URL('../site/gutenberg-license.txt',import.meta.url)));
const payload=new TextEncoder().encode('{"source":"é","value":[1,2,3]}\n');
test('licensed ZIP preserves JSON and full license bytes exactly',async()=>{
 const zip=await packLicensedZip(payload,license);assert.deepEqual(await unpackLicensedZip(zip),payload);
 assert.ok(zip.length>payload.length+license.length);assert.equal(new DataView(zip.buffer).getUint32(0,true),0x04034b50);
});
test('licensed ZIP rejects corrupt content, wrong license, extras, and arbitrary ZIP',async()=>{
 const zip=await packLicensedZip(payload,license),bad=zip.slice();bad[42]^=1;await assert.rejects(unpackLicensedZip(bad));
 const trailer=new Uint8Array(zip.length+1);trailer.set(zip);await assert.rejects(unpackLicensedZip(trailer));
 const wrong=license.slice();wrong[0]^=1;await assert.rejects(packLicensedZip(payload,wrong),/license/);
 const encrypted=zip.slice();encrypted[6]|=1;await assert.rejects(unpackLicensedZip(encrypted));
 const noZip=new TextEncoder().encode('not a zip');await assert.rejects(unpackLicensedZip(noZip));
 const renamed=zip.slice();renamed[30]=46;await assert.rejects(unpackLicensedZip(renamed));
 const compressed=zip.slice();compressed[8]=8;await assert.rejects(unpackLicensedZip(compressed));
});
test('licensed ZIP enforces bounds and independent slices',async()=>{
 await assert.rejects(packLicensedZip(new Uint8Array(),license));
 await assert.rejects(packLicensedZip(new Uint8Array(64*1024*1024+1),license));
 const zip=await packLicensedZip(payload,license),out=await unpackLicensedZip(zip);out[0]=0;assert.deepEqual(await unpackLicensedZip(zip),payload);
});
test('license fingerprint rejects a modified license even with repaired ZIP CRC',async()=>{
 const zip=await packLicensedZip(payload,license),v=new DataView(zip.buffer),end=zip.length-22,central=v.getUint32(end+16,true);
 const second=central+46+v.getUint16(central+28,true),local=v.getUint32(second+42,true),nameLen=v.getUint16(local+26,true),start=local+30+nameLen;
 zip[start]^=1;let crc=0xffffffff;for(const byte of zip.subarray(start,start+license.length)){crc^=byte;for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
 v.setUint32(local+14,crc,true);v.setUint32(second+16,crc,true);await assert.rejects(unpackLicensedZip(zip),/exact Gutenberg license/);
});
