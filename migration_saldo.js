const db = require('./db');

db.serialize(() => {
    db.run("ALTER TABLE prestamos ADD COLUMN saldo_pendiente REAL", (err) => {
        if (err) {
            if (err.message.includes("duplicate column")) {
                console.log("Column already exists");
            } else {
                console.error("Error adding column:", err);
            }
        } else {
            console.log("Column added.");
            // Initialize saldo_pendiente = monto for existing rows where it's null
            db.run("UPDATE prestamos SET saldo_pendiente = monto WHERE saldo_pendiente IS NULL", (errUpdate) => {
                if (errUpdate) console.error("Error updating defaults:", errUpdate);
                else console.log("Defaults updated.");
            });
        }
    });
});
