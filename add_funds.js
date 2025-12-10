const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run("UPDATE fondos SET monto_total = monto_total + 1000000", (err) => {
        if (err) console.error("Error updating funds:", err);
        else console.log("Funds replenished successfully.");
    });
});

db.close();
