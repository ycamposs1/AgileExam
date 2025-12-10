const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'data.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run("ALTER TABLE prestamos ADD COLUMN fondo_individual REAL DEFAULT 0", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log("⚠️ Column already exists.");
            } else {
                console.error("❌ Error adding column:", err.message);
            }
        } else {
            console.log("✅ Column 'fondo_individual' added successfully.");
        }
    });
});

db.close();
