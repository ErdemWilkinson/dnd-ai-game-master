// Faz 7-B: DATABASE_URL varsa Postgres (üretim), yoksa SQLite (yerel/test)
// kullan. Testler (VITEST=true) DATABASE_URL ayarlanmış olsa bile HER ZAMAN
// SQLite'a (:memory:) düşer - test ortamı gerçek bir Postgres instance'ı
// gerektirmesin ve davranış deterministik kalsın diye.

const usePostgres = Boolean(process.env.DATABASE_URL) && !process.env.VITEST;

module.exports = usePostgres ? require("./dbPostgres") : require("./dbSqlite");
