const pg = require("pg");
const client = new pg.Client({ host: "127.0.0.1", port: 5432, user: "postgres", password: "kurkaya1234", database: "postgres" });
client.connect().then(async () => {
  const res = await client.query("SELECT datname FROM pg_database WHERE datname LIKE $1 ORDER BY datname", ["%hesapisleri%"]);
  console.log(JSON.stringify(res.rows));
  await client.end();
}).catch(e => { console.error("ERROR:", e.message); process.exit(1); });
