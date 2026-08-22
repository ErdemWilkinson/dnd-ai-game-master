import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

// Faz 7-B: data/db.js hangi motoru (SQLite/Postgres) kullanacağına import
// ANINDA (process.env okuyarak) karar veriyor. Vitest'in kendi test worker'ı
// zaten require.cache'te bir kopya tutuyor ve VITEST=true altında çalışıyor,
// bu yüzden modülü aynı process içinde farklı env kombinasyonlarıyla yeniden
// test etmek güvenilir değil (Node'un CJS require cache'i vi.resetModules()
// tarafından temizlenmiyor). Onun yerine her senaryoyu ayrı bir alt process'te
// (node -e) çalıştırıp sadece `engine` alanını okuyoruz - gerçek "import anı"
// davranışını birebir test eden tek yöntem bu.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, "..");

function engineFor(env) {
  const script = `console.log(require(${JSON.stringify(path.join(backendRoot, "data", "db.js"))}).engine);`;
  const output = execFileSync(process.execPath, ["-e", script], {
    cwd: backendRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  return output.trim();
}

describe("data/db.js — Faz 7-B: DATABASE_URL'e göre motor seçimi", () => {
  it("DATABASE_URL yokken engine 'sqlite' olur", () => {
    const env = { ...process.env };
    delete env.DATABASE_URL;
    delete env.VITEST;
    expect(engineFor({ DATABASE_URL: "", VITEST: "" })).toBe("sqlite");
  });

  it("DATABASE_URL set ama VITEST=true iken YİNE 'sqlite' olur (test izolasyonu korunuyor, gerçek Postgres'e dokunulmuyor)", () => {
    expect(
      engineFor({ DATABASE_URL: "postgres://user:pass@localhost:5432/doesnotexist", VITEST: "true" }),
    ).toBe("sqlite");
  });

  it("DATABASE_URL set ve VITEST yokken engine 'postgres' olur (require anında bağlanmaya ÇALIŞMAZ, hata fırlatmaz)", () => {
    // Gerçek bir Postgres instance'ı yok - bu test sadece modülün import
    // anında (Pool eager connect etmediği için) çökmediğini doğruluyor.
    // Gerçek bağlantı/sorgu testi PM ile deploy aşamasında yapılacak.
    expect(
      engineFor({ DATABASE_URL: "postgres://user:pass@localhost:59999/doesnotexist", VITEST: "" }),
    ).toBe("postgres");
  });
});
