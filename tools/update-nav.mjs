// 更新导航主页：插入泰拉物语卡片（一次性脚本）
import { readFileSync, writeFileSync } from 'node:fs';
let html = readFileSync('tools/nav-cur.html', 'utf8');

const card = `  <div class="card">
    <span class="tag">最新作品</span>
    <h2>泰 拉 物 语</h2>
    <p class="desc">致敬《泰拉瑞亚》的 2D 沙盒冒险，手机电脑都能挖：<br>1200×400 程序化大世界——雪原、森林、沙漠、洞穴与地狱岩浆；<br>砍树建家、挖矿炼铁，工作台→熔炉→铁砧 27 种配方逐步升级；<br>白天史莱姆、夜晚僵尸与恶魔之眼，火把照亮黑暗的生存战；<br>合成「可疑眼球」召唤克苏鲁之眼，半血狂暴两阶段 Boss 战；<br>BFS 光照引擎 + 程序化像素画 + 合成音效，零依赖畅玩，自动存档。</p>
    <a class="btn" href="https://yjj0339.github.io/taila-wuyu/" style="background: linear-gradient(135deg, #67a446, #2e7d32); color: #ffffff;">进 入 泰 拉 大 陆</a>
    <div class="qr">
      <img src="qr-taila.png" alt="泰拉物语二维码" />
      <p>手机扫一扫，降临泰拉大陆</p>
    </div>
  </div>

`;

if (html.includes('泰 拉 物 语')) { console.log('already inserted'); process.exit(0); }
// 文件为 CRLF 行尾，锚点用正则兼容两种换行
const re = /[ \t]*<div class="card">\r?\n[ \t]*<span class="tag">最新作品<\/span>\r?\n[ \t]*<h2>纸 上 江 南<\/h2>/;
const m = html.match(re);
if (!m) { console.log('ANCHOR NOT FOUND'); process.exit(1); }
const replacement = card.trimEnd() + '\n\n' + m[0].replace('最新作品', '上一件作品');
html = html.replace(m[0], replacement);
writeFileSync('tools/nav-new.html', html);
console.log('inserted ok, bytes:', html.length);
