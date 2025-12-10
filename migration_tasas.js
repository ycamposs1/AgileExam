const db = require('./db');

db.serialize(() => {
    db.run("ALTER TABLE prestamos ADD COLUMN tasas_detalle TEXT", (err) => {
        if (err) {
            if (err.message.includes("duplicate column")) {
                console.log("Column already exists");
            } else {
                console.error("Error adding column:", err);
            }
        } else {
            console.log("Column tasas_detalle added.");
        }
    });
});
