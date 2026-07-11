/*
 * 济南管家工作台 · 企业微信消息后端
 * 纯 Node（无第三方依赖）。功能：
 *   1) 接收企业微信「自建应用」回调（URL 验证 + 消息 AES 解密，按官方规范）
 *   2) 把收到的消息存盘（messages.json），供前端轮询
 *   3) 提供手动注入接口（便于测试 / 从其他来源推消息）
 *   4) 顺带托管前端 index.html（运行本服务即可一站式访问）
 *
 * 配置：在企业微信管理后台建「自建应用」后，把下面三项填好，
 *       并把应用「接收消息」回调 URL 设为 http://<本机公网地址>:<PORT>/api/wecom/callback
 */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ===== 企业微信配置（已替换为自定义强随机值；仍可用环境变量覆盖）=====
// 这些值由 WorkBuddy 于 2026-07-11 生成，请勿外泄。企微后台的 Token / EncodingAESKey 须与此一致。
const TOKEN = process.env.WX_TOKEN || 'JinanButler_71b5cd406bcff9421ed6bc68';
const ENCODING_AES_KEY = process.env.WX_AESKEY || 'OL0UeAcz2M1i9eWjyzdAKDOWHY1JEups/Ah7N7duuuo'; // 43 位
const CORP_ID = process.env.WX_CORPID || 'your-corp-id';
const PORT = process.env.PORT || 3001;
// 消息落盘目录：容器重启会清空本地盘，云托管可在控制台挂载「文件存储」到某路径（如 /data）并设置 MSG_DIR=/data 实现持久化
const MSG_DIR = process.env.MSG_DIR || __dirname;
const MSG_FILE = path.join(MSG_DIR, 'messages.json');
// =========================================

function sha1(s) { return crypto.createHash('sha1').update(s, 'utf8').digest('hex'); }
function verifySig(args) { return sha1(args.slice().sort().join('')); }

function aesDecrypt(b64) {
  const key = Buffer.from(ENCODING_AES_KEY + '=', 'base64');
  const iv = key.slice(0, 16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  decipher.setAutoPadding(false);
  let dec = Buffer.concat([decipher.update(Buffer.from(b64, 'base64')), decipher.final()]);
  let pad = dec[dec.length - 1];
  if (pad < 1 || pad > 32) pad = 0;
  dec = dec.slice(0, dec.length - pad);
  const content = dec.slice(16);
  const len = content.readUInt32BE(0);
  return content.slice(4, 4 + len).toString('utf8');
}

function xmlGet(xml, tag) {
  const m = xml.match(new RegExp('<' + tag + '><!\\[CDATA\\[(.*?)\\]\\]></' + tag + '>|<' + tag + '>(.*?)</' + tag + '>', 's'));
  return m ? (m[1] || m[2] || '') : '';
}

// ---- 消息存储 ----
let messages = [];
let nextId = 1;
try {
  messages = JSON.parse(fs.readFileSync(MSG_FILE, 'utf8'));
  nextId = messages.reduce((mx, m) => Math.max(mx, m.id || 0), 0) + 1;
} catch (e) { messages = []; }
function save() { fs.writeFileSync(MSG_FILE, JSON.stringify(messages, null, 2)); }
function pushMsg(from, text) {
  const m = { id: nextId++, from: from || '微信', text: text || '', ts: Date.now() };
  messages.push(m); save(); return m;
}

function sendJSON(res, obj, code) {
  const body = JSON.stringify(obj);
  res.writeHead(code || 200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}
function corsPreflight(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end();
}
function readBody(req) {
  return new Promise((resolve) => {
    let d = ''; req.on('data', c => d += c); req.on('end', () => resolve(d));
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;

  if (req.method === 'OPTIONS') return corsPreflight(res);

  // 前端托管
  if (p === '/' || p === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
  }

  // 前端轮询：返回 since 之后的新消息
  if (p === '/api/messages' && req.method === 'GET') {
    const since = parseInt(u.searchParams.get('since') || '0', 10);
    const list = messages.filter(m => m.id > since);
    return sendJSON(res, { messages: list, lastId: nextId - 1 });
  }

  // 手动注入（测试 / 其他来源推消息）
  if (p === '/api/inject' && req.method === 'POST') {
    const body = await readBody(req);
    let data = {}; try { data = JSON.parse(body); } catch (e) {}
    const m = pushMsg(data.from, data.text);
    return sendJSON(res, { ok: true, message: m });
  }

  // 企业微信回调
  if (p === '/api/wecom/callback') {
    const q = u.searchParams;
    const msg_signature = q.get('msg_signature');
    const timestamp = q.get('timestamp');
    const nonce = q.get('nonce');

    // GET：URL 验证
    if (req.method === 'GET') {
      const echostr = q.get('echostr');
      if (verifySig([TOKEN, timestamp, nonce, echostr]) !== msg_signature) {
        res.writeHead(401); return res.end('invalid signature');
      }
      try { return res.end(aesDecrypt(echostr)); }
      catch (e) { res.writeHead(500); return res.end('decrypt fail'); }
    }

    // POST：接收消息
    if (req.method === 'POST') {
      const body = await readBody(req);
      const encrypt = xmlGet(body, 'Encrypt');
      if (verifySig([TOKEN, timestamp, nonce, encrypt]) !== msg_signature) {
        res.writeHead(401); return res.end('invalid signature');
      }
      try {
        const xml = aesDecrypt(encrypt);
        const from = xmlGet(xml, 'FromUserName');
        const content = xmlGet(xml, 'Content');
        pushMsg(from, content);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end('success');
      } catch (e) {
        res.writeHead(500); return res.end('decrypt fail');
      }
    }
  }

  res.writeHead(404); res.end('not found');
});

server.listen(PORT, () => {
  console.log('济南管家企业微信后端已启动： http://localhost:' + PORT);
  console.log('回调地址应为： http://<公网地址>:' + PORT + '/api/wecom/callback');
});
