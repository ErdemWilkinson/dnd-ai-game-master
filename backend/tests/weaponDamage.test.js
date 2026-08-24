import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { getWeaponDamageDie, WEAPON_DAMAGE_DIE, UNARMED_DAMAGE_DIE, UNKNOWN_WEAPON_DAMAGE_DIE } = require("../data/weaponDamage.js");

describe("getWeaponDamageDie", () => {
  it("bilinen silahlar için doğru hasar zarını döner", () => {
    expect(getWeaponDamageDie("Kısa Kılıç")).toBe(6);
    expect(getWeaponDamageDie("Hançer x2")).toBe(4);
    expect(getWeaponDamageDie("Topuz")).toBe(6);
    expect(getWeaponDamageDie("Asa")).toBe(4);
  });

  it("silahsız (undefined/null/boş) için silahsız varsayılanı döner", () => {
    expect(getWeaponDamageDie(undefined)).toBe(UNARMED_DAMAGE_DIE);
    expect(getWeaponDamageDie(null)).toBe(UNARMED_DAMAGE_DIE);
    expect(getWeaponDamageDie("")).toBe(UNARMED_DAMAGE_DIE);
  });

  it("haritada olmayan bir silah adı için bilinmeyen-silah varsayılanını döner", () => {
    expect(getWeaponDamageDie("Gelecekte Eklenecek Silah")).toBe(UNKNOWN_WEAPON_DAMAGE_DIE);
  });

  it("WEAPON_DAMAGE_DIE haritasındaki her silahın farklı/tutarlı bir zar boyutu var", () => {
    expect(WEAPON_DAMAGE_DIE["Kısa Kılıç"]).not.toBe(WEAPON_DAMAGE_DIE["Hançer x2"]);
  });
});
