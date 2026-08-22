// Bir kerelik asset hazırlama script'i: tgstation (.dmi/PNG) sprite sheet'lerinden
// belirli bir "state"in ilk yön/frame'ini kesip frontend/public/icons/ altına yazar.
// DMI metadata'sı (zTXt "Description" chunk'ı) state sırasını ve her state'in kaç
// tile (dirs*frames) kapladığını verir - "ilk tile" her zaman istenen state olmuyor
// (bazı dosyalarda ilk state bilinçli olarak boş/animasyonlu bir yer tutucu).
// Çalıştırma: node backend/scripts/extractIcons.js

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { PNG } = require("pngjs");

const ASSETS_ROOT = path.join(__dirname, "..", "..", "assets", "tgstation-icons");
const OUT_DIR = path.join(__dirname, "..", "..", "frontend", "public", "icons");
const ICON_SIZE = 32;

// slotId -> { file, state }: kaynak .dmi ve içindeki hedef state adı.
// State adları her dosyanın zTXt "Description" metadata'sından elle seçildi
// (ilk state genelde doğru ama bazı dosyalarda ilk state boş/error yer tutucu).
const SOURCES = {
  head: { file: "obj-clothing/head/hats.dmi", state: "tophat" },
  mask: { file: "obj-clothing/masks.dmi", state: "medical" },
  glasses: { file: "obj-clothing/glasses.dmi", state: "glasses_regular" },
  ears: { file: "obj-clothing/ears.dmi", state: "earmuffs" },
  neck: { file: "obj-clothing/neck.dmi", state: "tie_greyscale_tied" },
  back: { file: "mob-clothing/back/backpack.dmi", state: "backpack" },
  suit: { file: "obj-clothing/suits/armor.dmi", state: "armor" },
  under: { file: "obj-clothing/under/default.dmi", state: "jumpsuit" },
  gloves: { file: "obj-clothing/gloves.dmi", state: "black" },
  belt: { file: "obj-clothing/belts.dmi", state: "suspenders" },
  shoes: { file: "obj-clothing/shoes.dmi", state: "sneakers" },
  accessories: { file: "obj-clothing/accessories.dmi", state: "bronze" },
};

function readDescription(pngData) {
  let offset = 8;
  while (offset < pngData.length) {
    const len = pngData.readUInt32BE(offset);
    const type = pngData.toString("ascii", offset + 4, offset + 8);
    if (type === "zTXt") {
      const chunkData = pngData.slice(offset + 8, offset + 8 + len);
      const nullIdx = chunkData.indexOf(0);
      const compressed = chunkData.slice(nullIdx + 2);
      return zlib.inflateSync(compressed).toString("utf8");
    }
    if (type === "tEXt") {
      const chunkData = pngData.slice(offset + 8, offset + 8 + len);
      const nullIdx = chunkData.indexOf(0);
      return chunkData.slice(nullIdx + 1).toString("utf8");
    }
    offset += 8 + len + 4;
  }
  throw new Error("DMI metadata (zTXt/tEXt) bulunamadı.");
}

function parseStates(description) {
  const states = [];
  let current = null;
  for (const rawLine of description.split("\n")) {
    const line = rawLine.trim();
    const stateMatch = line.match(/^state = "(.*)"$/);
    if (stateMatch) {
      if (current) states.push(current);
      current = { name: stateMatch[1], dirs: 1, frames: 1 };
      continue;
    }
    const dirsMatch = line.match(/^dirs = (\d+)/);
    if (dirsMatch && current) current.dirs = parseInt(dirsMatch[1], 10);
    const framesMatch = line.match(/^frames = (\d+)/);
    if (framesMatch && current) current.frames = parseInt(framesMatch[1], 10);
  }
  if (current) states.push(current);
  return states;
}

function findTileOffset(states, targetName) {
  let offset = 0;
  for (const state of states) {
    if (state.name === targetName) return offset;
    offset += state.dirs * state.frames;
  }
  throw new Error(`State bulunamadı: "${targetName}"`);
}

function cropTile(srcPng, tileIndex, destPath) {
  const cols = Math.floor(srcPng.width / ICON_SIZE);
  const tx = (tileIndex % cols) * ICON_SIZE;
  const ty = Math.floor(tileIndex / cols) * ICON_SIZE;

  const out = new PNG({ width: ICON_SIZE, height: ICON_SIZE });
  for (let y = 0; y < ICON_SIZE; y++) {
    for (let x = 0; x < ICON_SIZE; x++) {
      const srcIdx = (srcPng.width * (ty + y) + (tx + x)) << 2;
      const dstIdx = (ICON_SIZE * y + x) << 2;
      out.data[dstIdx] = srcPng.data[srcIdx];
      out.data[dstIdx + 1] = srcPng.data[srcIdx + 1];
      out.data[dstIdx + 2] = srcPng.data[srcIdx + 2];
      out.data[dstIdx + 3] = srcPng.data[srcIdx + 3];
    }
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, PNG.sync.write(out));
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const [slot, { file, state }] of Object.entries(SOURCES)) {
  const srcPath = path.join(ASSETS_ROOT, file);
  if (!fs.existsSync(srcPath)) {
    console.error(`ATLANDI (dosya yok): ${slot} -> ${file}`);
    continue;
  }
  const raw = fs.readFileSync(srcPath);
  const png = PNG.sync.read(raw);
  const description = readDescription(raw);
  const states = parseStates(description);
  const tileOffset = findTileOffset(states, state);

  const destPath = path.join(OUT_DIR, `${slot}.png`);
  cropTile(png, tileOffset, destPath);
  console.log(`OK: ${slot} <- ${file} :: "${state}" (tile ${tileOffset})`);
}
