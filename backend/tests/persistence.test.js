import { describe, it, expect, beforeEach } from "vitest";
import { createRequire } from "module";

// Faz 6-B: SQLite kalıcılık katmanı. VITEST=true olduğu için data/db.js
// otomatik olarak :memory: kullanıyor (bkz. db.js), gerçek game.db dosyasına
// dokunmuyoruz. bkz. diğer backend testlerindeki createRequire deseni.
const require = createRequire(import.meta.url);
const { db } = require("../data/db.js");
const {
  loadAll,
  saveCharacter,
  saveChatHistory,
  saveActiveCharacterId,
} = require("../services/persistence.js");
const { characters, chatHistories, activeCharacterIdBySession } = require("../data/store.js");

beforeEach(() => {
  characters.clear();
  chatHistories.clear();
  activeCharacterIdBySession.clear();
  db.exec("DELETE FROM characters; DELETE FROM chat_histories; DELETE FROM sessions;");
});

describe("persistence — save* fonksiyonları DB'ye doğru yazıyor", () => {
  it("saveCharacter, characters tablosuna id+JSON olarak yazar", () => {
    const character = { id: "char-1", name: "Aragorn", hp: { current: 10, max: 10 } };
    saveCharacter(character);

    const row = db.prepare("SELECT * FROM characters WHERE id = ?").get("char-1");
    expect(row).toBeTruthy();
    expect(JSON.parse(row.data)).toEqual(character);
  });

  it("saveCharacter aynı id ile tekrar çağrılırsa UPSERT yapar (yeni satır eklemez, günceller)", () => {
    saveCharacter({ id: "char-1", name: "Aragorn", hp: { current: 10, max: 10 } });
    saveCharacter({ id: "char-1", name: "Aragorn", hp: { current: 3, max: 10 } });

    const rows = db.prepare("SELECT * FROM characters WHERE id = ?").all("char-1");
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].data).hp.current).toBe(3);
  });

  it("saveChatHistory, chat_histories tablosuna sessionId+JSON mesaj dizisi olarak yazar", () => {
    const messages = [{ id: "m1", role: "player", text: "merhaba" }];
    saveChatHistory("session-x", messages);

    const row = db.prepare("SELECT * FROM chat_histories WHERE session_id = ?").get("session-x");
    expect(JSON.parse(row.data)).toEqual(messages);
  });

  it("saveActiveCharacterId, sessions tablosuna session->characterId eşlemesini yazar", () => {
    saveActiveCharacterId("session-x", "char-1");

    const row = db.prepare("SELECT * FROM sessions WHERE session_id = ?").get("session-x");
    expect(row.active_character_id).toBe("char-1");
  });
});

describe("persistence — loadAll() 'restart' senaryosunu doğru simüle ediyor", () => {
  it("DB'de veri varken loadAll() çağrılırsa in-memory Map'ler doğru şekilde dolduruluyor", async () => {
    // 1) DB'ye doğrudan (route'lardan bağımsız) veri yaz - "önceki oturumdan kalan" veri
    const character = { id: "char-1", name: "Aragorn", hp: { current: 7, max: 12 } };
    const messages = [{ id: "m1", role: "player", text: "eski mesaj" }];
    saveCharacter(character);
    saveChatHistory("session-x", messages);
    saveActiveCharacterId("session-x", "char-1");

    // 2) "Sunucu yeniden başladı" - in-memory Map'ler bomboş
    characters.clear();
    chatHistories.clear();
    activeCharacterIdBySession.clear();
    expect(characters.size).toBe(0);

    // 3) loadAll() - server.js'in açılışta yaptığı şey (Faz 7-B: async)
    await loadAll();

    // 4) Her şey geri gelmiş olmalı
    expect(characters.get("char-1")).toEqual(character);
    expect(chatHistories.get("session-x")).toEqual(messages);
    expect(activeCharacterIdBySession.get("session-x")).toBe("char-1");
  });

  it("DB boşken loadAll() hata vermeden çalışır, Map'ler boş kalır", async () => {
    await loadAll(); // reject ederse test zaten fail olur
    expect(characters.size).toBe(0);
  });

  it("active_character_id NULL olan bir session satırı loadAll()'da atlanır (Map'e boş/null değer eklenmez)", async () => {
    db.prepare("INSERT INTO sessions (session_id, active_character_id) VALUES (?, NULL)").run("session-y");
    await loadAll();
    expect(activeCharacterIdBySession.has("session-y")).toBe(false);
  });
});

describe("persistence — uçtan uca: route mutasyonu → DB'ye yazılıyor → loadAll ile geri geliyor", () => {
  it("karakter oluşturma + sohbet sonrası state'in tamamı DB'den doğru geri yükleniyor ('restart' testi)", async () => {
    const express = require("express");
    const request = require("supertest");
    const characterRouter = require("../routes/character.js");
    const chatRouter = require("../routes/chat.js");

    function buildApp() {
      const app = express();
      app.use(express.json());
      app.use("/api/character", characterRouter);
      app.use("/api/chat", chatRouter);
      return app;
    }

    const app = buildApp();
    const sessionId = "restart-test-session";
    const withSession = (method, url) => request(app)[method](url).set("X-Session-Id", sessionId);

    const createRes = await withSession("post", "/api/character/create").send({
      name: "RestartTest", raceId: "human", classId: "fighter",
    });
    const characterId = createRes.body.id;

    await withSession("post", "/api/chat").send({ message: "merhaba dünya" });

    // "Sunucu yeniden başladı": in-memory her şeyi temizle
    characters.clear();
    chatHistories.clear();
    activeCharacterIdBySession.clear();

    // server.js'in açılışta yaptığını yap (Faz 7-B: async)
    await loadAll();

    // Yeni bir app/request ile (gerçek restart'ı taklit etmek için) aynı sessionId'yle sorgula
    const app2 = buildApp();
    const withSession2 = (method, url) => request(app2)[method](url).set("X-Session-Id", sessionId);

    const charAfterRestart = await withSession2("get", "/api/character");
    expect(charAfterRestart.body.id).toBe(characterId);
    expect(charAfterRestart.body.name).toBe("RestartTest");

    const chatAfterRestart = await withSession2("get", "/api/chat");
    expect(chatAfterRestart.body.messages.some((m) => m.text === "merhaba dünya")).toBe(true);
  });
});
