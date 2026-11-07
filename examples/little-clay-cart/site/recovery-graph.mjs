// A JSON-portable, versioned representation of structured-clone recovery data.
// Unsupported values fail explicitly rather than silently losing private records.
const FORMAT='personal-reader-recovery-graph',VERSION=1;
const MAX_NODES=100000,MAX_BYTES=128*1024*1024,MAX_ARRAY=10000000;
const typedNames=['Int8Array','Uint8Array','Uint8ClampedArray','Int16Array','Uint16Array','Int32Array','Uint32Array','Float32Array','Float64Array','BigInt64Array','BigUint64Array','Float16Array'];
const typed=new Map(typedNames.filter(name=>typeof globalThis[name]==='function').map(name=>[name,globalThis[name]]));
const errors=new Map(['Error','EvalError','RangeError','ReferenceError','SyntaxError','TypeError','URIError','AggregateError'].filter(name=>typeof globalThis[name]==='function').map(name=>[name,globalThis[name]]));
const blobSymbols=typeof Blob==='function'?new Set(Object.getOwnPropertySymbols(new Blob([]))):new Set();
const fileSymbols=typeof File==='function'?new Set(Object.getOwnPropertySymbols(new File([],''))):new Set();
const nativeErrorStack=Object.getOwnPropertyDescriptor(new Error(),'stack');
const regexpFlags=[['hasIndices','d'],['global','g'],['ignoreCase','i'],['multiline','m'],['dotAll','s'],['unicode','u'],['unicodeSets','v'],['sticky','y']];
const fail=message=>{throw new Error(message);};
const check=(condition,message)=>{if(!condition)fail(message);};
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,names)=>object(value)&&Object.keys(value).sort().join('|')===[...names].sort().join('|');
function toBase64(bytes) {let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);}
function fromBase64(value) {
  check(typeof value==='string'&&value.length%4===0&&value.length<=Math.ceil(MAX_BYTES/3)*4&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value),'Invalid recovery bytes.');
  let binary;try{binary=atob(value);}catch{fail('Invalid recovery bytes.');}check(btoa(binary)===value,'Invalid recovery bytes.');return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
const numeric=value=>Number.isNaN(value)?{$:'nan'}:value===Infinity?{$:'infinity'}:value===-Infinity?{$:'negative-infinity'}:Object.is(value,-0)?{$:'negative-zero'}:value;

export async function encodeRecoveryGraph(value) {
  const nodes=[],seen=new Map();let bytes=0;
  function account(size){bytes+=size;check(bytes<=MAX_BYTES,'Recovery data exceeds the 128 MiB binary limit.');}
  async function props(input,skip=()=>false,checkSymbols=false,allowNativeStack=false) {
    if(checkSymbols)check(Object.getOwnPropertySymbols(input).length===0,'Symbol-keyed recovery data is unsupported.');
    const result=[];
    for(const key of Object.getOwnPropertyNames(input)){
      if(skip(key))continue;const descriptor=Object.getOwnPropertyDescriptor(input,key);
      check(descriptor,'Invalid recovery property.');let item=descriptor.value,writable=descriptor.writable;
      if(!own(descriptor,'value')){check(allowNativeStack&&key==='stack'&&typeof nativeErrorStack?.get==='function'&&descriptor.get===nativeErrorStack.get&&descriptor.set===nativeErrorStack.set,'Recovery data with accessors is unsupported.');item=descriptor.get.call(input);writable=true;}
      result.push({key,value:await visit(item),enumerable:descriptor.enumerable,writable,configurable:descriptor.configurable});
    }
    return result;
  }
  async function visit(input) {
    if(input===null||typeof input==='string'||typeof input==='boolean')return input;
    if(typeof input==='number')return numeric(input);
    if(typeof input==='undefined')return {$:'undefined'};
    if(typeof input==='bigint')return {$:'bigint',value:input.toString()};
    check(typeof input==='object','This recovery value cannot be represented safely.');
    if(seen.has(input))return {$:'ref',id:seen.get(input)};
    check(nodes.length<MAX_NODES,'Recovery data contains too many objects.');const id=nodes.length;seen.set(input,id);nodes.push(null);let node;
    if(Array.isArray(input)){
      check(input.length<=MAX_ARRAY,'Recovery array is too large.');node={type:'array',length:input.length,lengthWritable:Object.getOwnPropertyDescriptor(input,'length').writable,props:await props(input,key=>key==='length',true)};
    }else if(Object.getPrototypeOf(input)===Object.prototype||Object.getPrototypeOf(input)===null){
      node={type:'object',nullPrototype:Object.getPrototypeOf(input)===null,props:await props(input,()=>false,true)};
    }else if(Object.getPrototypeOf(input)===RegExp.prototype){
      const source=Object.getOwnPropertyDescriptor(RegExp.prototype,'source').get.call(input),flags=regexpFlags.filter(([key])=>Object.getOwnPropertyDescriptor(RegExp.prototype,key)?.get.call(input)).map(([,flag])=>flag).join('');
      node={type:'regexp',source,flags,props:await props(input,()=>false,true)};
    }else if([...errors].some(([,constructor])=>Object.getPrototypeOf(input)===constructor.prototype)){
      const entry=[...errors].find(([,constructor])=>Object.getPrototypeOf(input)===constructor.prototype);node={type:'error',name:entry[0],props:await props(input,()=>false,true,true)};
    }else if(Object.getPrototypeOf(input)===Date.prototype){node={type:'date',time:numeric(Date.prototype.getTime.call(input)),props:await props(input,()=>false,true)};
    }else if(Object.getPrototypeOf(input)===Map.prototype){const entries=[];for(const [key,item] of Map.prototype.entries.call(input))entries.push([await visit(key),await visit(item)]);node={type:'map',entries,props:await props(input,()=>false,true)};
    }else if(Object.getPrototypeOf(input)===Set.prototype){const entries=[];for(const item of Set.prototype.values.call(input))entries.push(await visit(item));node={type:'set',entries,props:await props(input,()=>false,true)};
    }else if(Object.getPrototypeOf(input)===ArrayBuffer.prototype){check(!input.resizable,'Resizable recovery buffers are unsupported.');account(input.byteLength);node={type:'arraybuffer',data:toBase64(new Uint8Array(input)),props:await props(input,()=>false,true)};
    }else if(Object.getPrototypeOf(input)===DataView.prototype){node={type:'dataview',buffer:await visit(input.buffer),byteOffset:input.byteOffset,byteLength:input.byteLength,props:await props(input,()=>false,true)};
    }else if(ArrayBuffer.isView(input)){
      const entry=[...typed].find(([,constructor])=>Object.getPrototypeOf(input)===constructor.prototype);check(entry,'Unsupported typed recovery array.');
      node={type:'typedarray',name:entry[0],buffer:await visit(input.buffer),byteOffset:input.byteOffset,length:input.length,props:await props(input,key=>/^(0|[1-9]\d*)$/.test(key)&&Number(key)<input.length,true)};
    }else if(typeof File==='function'&&Object.getPrototypeOf(input)===File.prototype){check(Object.getOwnPropertySymbols(input).every(key=>fileSymbols.has(key)),'Symbol-keyed recovery data is unsupported.');account(input.size);node={type:'file',name:input.name,lastModified:input.lastModified,mediaType:input.type,data:toBase64(new Uint8Array(await Blob.prototype.arrayBuffer.call(input))),props:await props(input)};
    }else if(typeof Blob==='function'&&Object.getPrototypeOf(input)===Blob.prototype){check(Object.getOwnPropertySymbols(input).every(key=>blobSymbols.has(key)),'Symbol-keyed recovery data is unsupported.');account(input.size);node={type:'blob',mediaType:input.type,data:toBase64(new Uint8Array(await Blob.prototype.arrayBuffer.call(input))),props:await props(input)};
    }else fail('Unsupported recovery object type. The original data has not been changed.');
    nodes[id]=node;return {$:'ref',id};
  }
  return {format:FORMAT,version:VERSION,root:await visit(value),nodes};
}

function assertSafeGraphInput(root) {
  const pending=[root],seen=new WeakSet();let count=0;
  while(pending.length){const current=pending.pop();if(current===null||typeof current!=='object')continue;
    check(!seen.has(current),'Recovery graph must be plain, acyclic JSON data.');seen.add(current);check(++count<=MAX_NODES*20,'Recovery graph is too complex.');
    const prototype=Object.getPrototypeOf(current);check(prototype===Object.prototype||prototype===null||(Array.isArray(current)&&prototype===Array.prototype),'Recovery graph must contain only plain JSON data.');
    check(Object.getOwnPropertySymbols(current).length===0,'Recovery graph cannot contain symbol keys.');
    for(const key of Object.getOwnPropertyNames(current)){const descriptor=Object.getOwnPropertyDescriptor(current,key);check(descriptor&&own(descriptor,'value'),'Recovery graph cannot contain accessors.');const item=descriptor.value;check(item===null||['object','string','boolean','number'].includes(typeof item),'Recovery graph contains a non-JSON value.');if(item&&typeof item==='object')pending.push(item);}
  }
}

export async function decodeRecoveryGraph(graph) {
  assertSafeGraphInput(graph);
  check(exact(graph,['format','version','root','nodes'])&&graph.format===FORMAT&&graph.version===VERSION&&Array.isArray(graph.nodes)&&graph.nodes.length<=MAX_NODES,'Unsupported recovery graph.');
  const nodes=graph.nodes,objects=new Array(nodes.length);let bytes=0;
  function value(token) {
    if(token===null||typeof token==='string'||typeof token==='boolean')return token;
    if(typeof token==='number'){check(Number.isFinite(token),'Invalid recovery number.');return token;}
    check(object(token)&&typeof token.$==='string','Invalid recovery value.');
    if(token.$==='ref'){check(exact(token,['$','id'])&&Number.isInteger(token.id)&&token.id>=0&&token.id<objects.length&&objects[token.id]!==undefined,'Invalid recovery reference.');return objects[token.id];}
    if(token.$==='bigint'){check(exact(token,['$','value'])&&typeof token.value==='string'&&/^(0|-?[1-9]\d*)$/.test(token.value),'Invalid recovery integer.');return BigInt(token.value);}
    check(exact(token,['$']),'Invalid recovery scalar.');
    switch(token.$){case 'undefined':return undefined;case 'nan':return NaN;case 'infinity':return Infinity;case 'negative-infinity':return -Infinity;case 'negative-zero':return -0;default:fail('Unsupported recovery scalar.');}
  }
  function data(input){const decoded=fromBase64(input);bytes+=decoded.length;check(bytes<=MAX_BYTES,'Recovery data exceeds the 128 MiB binary limit.');return decoded;}
  const schemas={object:['type','nullPrototype','props'],array:['type','length','lengthWritable','props'],date:['type','time','props'],regexp:['type','source','flags','props'],error:['type','name','props'],map:['type','entries','props'],set:['type','entries','props'],arraybuffer:['type','data','props'],dataview:['type','buffer','byteOffset','byteLength','props'],typedarray:['type','name','buffer','byteOffset','length','props'],blob:['type','mediaType','data','props'],file:['type','name','lastModified','mediaType','data','props']};
  // Allocate identities first, including buffers and blobs, then views, then links.
  for(const [i,node] of nodes.entries()){
    check(object(node)&&own(schemas,node.type)&&exact(node,schemas[node.type])&&Array.isArray(node.props),'Invalid recovery object.');
    switch(node.type){
      case 'object':check(typeof node.nullPrototype==='boolean','Invalid recovery object.');objects[i]=node.nullPrototype?Object.create(null):{};break;
      case 'array':check(Number.isInteger(node.length)&&node.length>=0&&node.length<=MAX_ARRAY&&typeof node.lengthWritable==='boolean','Invalid recovery array.');objects[i]=new Array(node.length);break;
      case 'date':{const time=value(node.time);check(typeof time==='number'&&(Number.isFinite(time)||Number.isNaN(time)),'Invalid recovery date.');objects[i]=new Date(time);break;}
      case 'regexp':check(typeof node.source==='string'&&typeof node.flags==='string','Invalid recovery expression.');try{objects[i]=new RegExp(node.source,node.flags);}catch{fail('Invalid recovery expression.');}break;
      case 'error':{const constructor=errors.get(node.name);check(constructor,'Unsupported recovery error.');objects[i]=node.name==='AggregateError'?new constructor([]):new constructor();for(const key of Object.getOwnPropertyNames(objects[i]))delete objects[i][key];break;}
      case 'map':check(Array.isArray(node.entries),'Invalid recovery map.');objects[i]=new Map();break;
      case 'set':check(Array.isArray(node.entries),'Invalid recovery set.');objects[i]=new Set();break;
      case 'arraybuffer':{const decoded=data(node.data);objects[i]=decoded.buffer;break;}
      case 'blob':case 'file':{check(typeof node.mediaType==='string','Invalid recovery media.');const decoded=data(node.data);if(node.type==='file'){check(typeof File==='function'&&typeof node.name==='string'&&Number.isFinite(node.lastModified),'File recovery is unavailable or invalid.');objects[i]=new File([decoded],node.name,{type:node.mediaType,lastModified:node.lastModified});}else{check(typeof Blob==='function','Blob recovery is unavailable.');objects[i]=new Blob([decoded],{type:node.mediaType});}break;}
      case 'dataview':case 'typedarray':break;
    }
  }
  for(const [i,node] of nodes.entries())if(node.type==='dataview'||node.type==='typedarray'){
    const buffer=value(node.buffer);check(buffer instanceof ArrayBuffer&&Number.isInteger(node.byteOffset)&&node.byteOffset>=0,'Invalid recovery view.');
    try{if(node.type==='dataview'){check(Number.isInteger(node.byteLength)&&node.byteLength>=0,'Invalid recovery view.');objects[i]=new DataView(buffer,node.byteOffset,node.byteLength);}else{const constructor=typed.get(node.name);check(constructor&&Number.isInteger(node.length)&&node.length>=0,'Unsupported recovery array type.');objects[i]=new constructor(buffer,node.byteOffset,node.length);}}catch{fail('Invalid recovery view bounds.');}
  }
  for(const [i,node] of nodes.entries()){
    const target=objects[i],keys=new Set();
    for(const property of node.props){check(exact(property,['key','value','enumerable','writable','configurable'])&&typeof property.key==='string'&&!keys.has(property.key)&&typeof property.enumerable==='boolean'&&typeof property.writable==='boolean'&&typeof property.configurable==='boolean','Invalid recovery property.');keys.add(property.key);check(!(node.type==='array'&&(property.key==='length'||(/^(0|[1-9]\d*)$/.test(property.key)&&Number(property.key)<4294967295&&Number(property.key)>=node.length))),'Invalid array property.');check(!(node.type==='typedarray'&&/^(0|[1-9]\d*)$/.test(property.key)),'Invalid typed array property.');try{Object.defineProperty(target,property.key,{value:value(property.value),enumerable:property.enumerable,writable:property.writable,configurable:property.configurable});}catch{fail('Invalid recovery property.');}}
    if(node.type==='array'&&!node.lengthWritable)Object.defineProperty(target,'length',{writable:false});
    if(node.type==='map')for(const entry of node.entries){check(Array.isArray(entry)&&entry.length===2,'Invalid recovery map entry.');target.set(value(entry[0]),value(entry[1]));}
    if(node.type==='set')for(const entry of node.entries)target.add(value(entry));
  }
  return value(graph.root);
}
