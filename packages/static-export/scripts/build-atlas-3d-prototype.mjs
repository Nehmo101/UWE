import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const bundlePath = resolve(root, "packages/static-export/static/atlas-3d.js");
const outputPath = resolve(root, "docs/artifacts/atlas-3d-prototype.html");
const bundleBase64 = (await readFile(bundlePath)).toString("base64");

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>UWE Atlas 3D — interaktiver Prototyp</title>
<style>
  :root{color-scheme:dark;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#17130f;color:#f5ead2}
  *{box-sizing:border-box}body{margin:0;overflow:hidden}canvas{display:block;width:100vw;height:100vh;touch-action:none}
  .panel{position:fixed;z-index:2;left:20px;top:20px;max-width:390px;padding:16px 18px;border:1px solid #8e724d;border-radius:14px;background:rgba(28,23,17,.88);box-shadow:0 12px 40px #0008;backdrop-filter:blur(12px)}
  h1{margin:0 0 8px;font:600 22px Georgia,serif}.tag{display:inline-block;margin-bottom:10px;padding:3px 8px;border-radius:999px;background:#c2622b;color:white;font-size:11px}p{margin:0;color:#d4c4a8;line-height:1.5;font-size:12px}
  .help{position:fixed;z-index:2;right:18px;bottom:18px;padding:9px 12px;border-radius:9px;background:#17130fcc;color:#eadabd;font-size:11px}
  .error{color:#ffb199}
</style>
</head>
<body>
<div class="panel"><span class="tag">Stufe 0 · Design-Prototyp</span><h1>Canvas of Kings — echtes Terrain</h1><p>Dieselbe 2D-Karte liegt als Textur auf dem v3-Höhenfeld. Three.js liefert Licht, Perspektive, Raycast und Billboard-Objekte — das Dokument bleibt zweidimensional.</p></div>
<div class="help">Ziehen: schwenken · Rechts/Mitte/Alt: orbit · Mausrad: dolly</div>
<canvas id="demo"></canvas>
<script type="module">
const source = Uint8Array.from(atob("${bundleBase64}"), c => c.charCodeAt(0));
const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
try {
  const { createAtlas3D } = await import(url);
  const elevation = {};
  const cells = {};
  const cols = 64, rows = 40;
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const nx = (col + .5) / cols, ny = (row + .5) / rows;
    const ridge = Math.exp(-(((nx-.53)/.19)**2 + ((ny-.48)/.29)**2));
    const north = .7 * Math.exp(-(((nx-.25)/.12)**2 + ((ny-.25)/.15)**2));
    const south = .55 * Math.exp(-(((nx-.78)/.16)**2 + ((ny-.72)/.13)**2));
    const height = Math.max(0, Math.min(1, ridge + north + south - .18));
    if (height > .02) elevation[col+","+row] = height;
    cells[col+","+row] = height < .04 ? "water" : height > .64 ? "mountain" : height > .28 ? "hills" : "grass";
  }
  const grid = { cols, rows, elevation };
  const objects = Array.from({length:96}, (_, index) => {
    const angle = index * 2.39996, radius = .08 + (index % 19) * .019;
    return { id:"tree-"+index, paletteItemId:index%13===0?"city":"tree", x:.5+Math.cos(angle)*radius, y:.5+Math.sin(angle)*radius*.68, scale:index%13===0?1.45:.65+(index%7)*.06 };
  });
  function bakeGround(size) {
    const canvas = document.createElement("canvas"); canvas.width=size; canvas.height=Math.round(size/1.6);
    const ctx=canvas.getContext("2d"); const cw=canvas.width/cols,ch=canvas.height/rows;
    const colors={water:"#789eaa",grass:"#98ae73",hills:"#ad9668",mountain:"#827666"};
    ctx.fillStyle="#e7d8b7";ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){ctx.fillStyle=colors[cells[col+","+row]];ctx.fillRect(col*cw,row*ch,cw+1,ch+1)}
    ctx.globalAlpha=.34;ctx.strokeStyle="#3d2c1d";ctx.lineWidth=2;
    for(let i=0;i<18;i++){ctx.beginPath();ctx.ellipse(canvas.width*(.22+i*.035),canvas.height*(.48+Math.sin(i*.7)*.06),34+i*5,10+i*1.5,-.35,0,Math.PI*2);ctx.stroke()}
    ctx.globalAlpha=1;ctx.fillStyle="#3b281a";ctx.font="bold 34px Georgia";ctx.fillText("Königsmark",canvas.width*.57,canvas.height*.32);
    return canvas;
  }
  function drawObject(ctx, object, x, y, size) {
    ctx.save();ctx.translate(x,y);ctx.strokeStyle="#302116";ctx.fillStyle=object.paletteItemId==="city"?"#c2622b":"#49613d";ctx.lineWidth=3;
    if(object.paletteItemId==="city"){ctx.fillRect(-size*.2,-size*.35,size*.4,size*.35);ctx.beginPath();ctx.moveTo(-size*.26,-size*.35);ctx.lineTo(0,-size*.62);ctx.lineTo(size*.26,-size*.35);ctx.closePath();ctx.fill();ctx.stroke()}
    else{ctx.beginPath();ctx.moveTo(0,size*.18);ctx.lineTo(-size*.24,-size*.08);ctx.lineTo(-size*.1,-size*.08);ctx.lineTo(-size*.3,-size*.34);ctx.lineTo(0,-size*.62);ctx.lineTo(size*.3,-size*.34);ctx.lineTo(size*.1,-size*.08);ctx.lineTo(size*.24,-size*.08);ctx.closePath();ctx.fill();ctx.stroke()}
    ctx.restore();
  }
  const atlas = createAtlas3D(document.querySelector("#demo"), { getGrid:()=>grid, getObjects:()=>objects, bakeGround, drawObjectSprite:drawObject, getLightDirection:()=>"nw" }, { groundBakeSize:2048, leftPan:true, initialPitch:55 });
  window.__atlas3dPrototype = atlas;
} catch (error) {
  document.querySelector(".panel").insertAdjacentHTML("beforeend", '<p class="error">WebGL-Prototyp konnte nicht starten.</p>');
  console.error(error);
} finally { URL.revokeObjectURL(url); }
</script>
</body>
</html>`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, html);
console.log("[atlas] self-contained 3D prototype →", outputPath);
