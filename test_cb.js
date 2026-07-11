// 后端自检：模拟企业微信回调（加密+签名），验证解密与存储
const http = require('http');
const crypto = require('crypto');

const TOKEN = 'JinanButler_71b5cd406bcff9421ed6bc68';
const AESKEY = 'OL0UeAcz2M1i9eWjyzdAKDOWHY1JEups/Ah7N7duuuo';
const CORP = 'your-corp-id';
const BASE = 'http://localhost:3001';

function sha1(s){return crypto.createHash('sha1').update(s,'utf8').digest('hex');}
function aesEncrypt(msg){
  const key=Buffer.from(AESKEY+'=','base64');const iv=key.slice(0,16);
  const rnd=Buffer.from('abcdefghijklmnop');
  const mb=Buffer.from(msg,'utf8');
  const lb=Buffer.alloc(4);lb.writeUInt32BE(mb.length,0);
  let plain=Buffer.concat([rnd,lb,mb,Buffer.from(CORP,'utf8')]);
  let pad=32-(plain.length%32);if(pad===0)pad=32;plain=Buffer.concat([plain,Buffer.alloc(pad,pad)]);
  const c=crypto.createCipheriv('aes-256-cbc',key,iv);c.setAutoPadding(false);
  return Buffer.concat([c.update(plain),c.final()]).toString('base64');
}
function req(method,path,body){
  return new Promise((res,rej)=>{
    const data=body?JSON.stringify(body):null;
    const r=http.request(BASE+path,{method,headers:data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}:{}},resp=>{
      let d='';resp.on('data',c=>d+=c);resp.on('end',()=>res({code:resp.statusCode,body:d}));
    });
    if(data)r.write(data);r.end();
  });
}
(async()=>{
  // 1) inject
  const inj=await req('POST','/api/inject',{from:'测试',text:'手动注入一条'});
  console.log('inject:',inj.code,inj.body);
  // 2) 模拟企微回调
  const inner='<xml><ToUserName><![CDATA[to]]></ToUserName><FromUserName><![CDATA[user_zhang]]></FromUserName><CreateTime>1700000000</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[张老师明天几点上课]]></Content><MsgId>123</MsgId></xml>';
  const enc=aesEncrypt(inner);
  const ts='1700000001',nonce='abc123';
  const sig=sha1([TOKEN,ts,nonce,enc].sort().join(''));
  const cb=await req('POST','/api/wecom/callback?msg_signature='+sig+'&timestamp='+ts+'&nonce='+nonce,
    '<xml><Encrypt><![CDATA['+enc+']]></Encrypt></xml>');
  console.log('callback:',cb.code,cb.body);
  // 3) 拉取
  const msgs=await req('GET','/api/messages?since=0');
  console.log('messages:',msgs.code,msgs.body);
})();
