const db = require('./db');

db.serialize(() => {
    db.run("ALTER TABLE prestamos ADD COLUMN tipo_tasa TEXT DEFAULT 'TEA'", (err) => {
        if (err) {
            if (err.message.includes("duplicate column name")) {
                console.log("Column 'tipo_tasa' already exists.");
            } else {
                console.error("Error adding column:", err);
            }
        } else {
            console.log("Column 'tipo_tasa' added successfully.");
        }
    });
});
