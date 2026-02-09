const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const blocksFile = path.join(__dirname, 'blocks.bin');
const PORT = process.env.PORT || 10000;
const wss = new WebSocket.Server({ port: PORT });
let blocks = {};

// Dosyadan blokları yükle
if (fs.existsSync(blocksFile)) {
    const buffer = fs.readFileSync(blocksFile);
    for (let i = 0; i < buffer.length; i += 8) {
        const blockIndex = buffer.readInt16LE(i);
        const x = buffer.readInt16LE(i + 2);
        const y = buffer.readInt16LE(i + 4);
        const z = buffer.readInt16LE(i + 6);
        blocks[`${blockIndex}.${x}.${y}.${z}`] = { blockIndex, x, y, z };
    }
}

// Blokları dosyaya kaydet
function saveBlocks() {
    const arr = Object.values(blocks);
    const buffer = Buffer.alloc(arr.length * 8);

    arr.forEach((b, i) => {
        const o = i * 8;
        buffer.writeInt16LE(b.blockIndex, o);
        buffer.writeInt16LE(b.x, o + 2);
        buffer.writeInt16LE(b.y, o + 4);
        buffer.writeInt16LE(b.z, o + 6);
    });

    fs.writeFileSync(blocksFile, buffer);
}

wss.on('connection', ws => {
    // Yeni bağlanan oyuncuya mevcut tüm blokları gönder
    for (let k in blocks)
        ws.send(JSON.stringify(blocks[k]));

    ws.on('message', msg => {
        const messageContent = msg.toString();

        // --- PING/PONG DESTEĞİ ---
        if (messageContent === "ping") {
            ws.send("pong");
            return; // Alt satırlardaki JSON işlemlerine girmeden burada bitir
        }
        // -------------------------

        let data;
        try { 
            data = JSON.parse(messageContent); 
        } catch (e) { 
            return; 
        }

        const key = `${data.blockIndex}.${data.x}.${data.y}.${data.z}`;

        if (data.action === "remove") {
            if (blocks[key]) {
                delete blocks[key];
                saveBlocks();
                broadcast({ action: "remove", ...data });
            }
        } else {
            if (!blocks[key]) {
                blocks[key] = data;
                saveBlocks();
                broadcast(data);
            }
        }
    });
});

function broadcast(data) {
    const msg = JSON.stringify(data);
    wss.clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN)
            c.send(msg);
    });
}

console.log("WebSocket sunucusu port", PORT, "üzerinde çalışıyor...");