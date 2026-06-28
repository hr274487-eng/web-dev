const initSqlJs = require("sql.js");
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "..", "data");
const uploadsDir = path.join(dataDir, "uploads");
const dbPath = path.join(dataDir, "gym.db");

[dataDir, uploadsDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

let db;

function saveDb() {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
}

function getAll(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
}

function getOne(sql, params = []) {
    return getAll(sql, params)[0] || null;
}

function runSql(sql, params = []) {
    db.run(sql, params);
    saveDb();
}

function initSchema() {
    db.run(`
        CREATE TABLE IF NOT EXISTS applications (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            plan TEXT NOT NULL,
            message TEXT DEFAULT '',
            payment_method_id TEXT,
            receipt_path TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS members (
            id TEXT PRIMARY KEY,
            application_id TEXT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            plan TEXT NOT NULL,
            joined_at TEXT NOT NULL
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS payment_methods (
            id TEXT PRIMARY KEY,
            platform_name TEXT NOT NULL,
            account_id TEXT NOT NULL,
            account_holder TEXT NOT NULL
        )
    `);

    const appColumns = getAll("PRAGMA table_info(applications)").map(c => c.name);
    if (!appColumns.includes("payment_method_id")) {
        db.run("ALTER TABLE applications ADD COLUMN payment_method_id TEXT");
    }
    if (!appColumns.includes("receipt_path")) {
        db.run("ALTER TABLE applications ADD COLUMN receipt_path TEXT");
    }

    const paymentCount = getOne("SELECT COUNT(*) as count FROM payment_methods").count;
    if (paymentCount === 0) {
        [
            ["pay-1", "JazzCash", "0300 1234567", "IronForge Gym"],
            ["pay-2", "EasyPaisa", "0300 1234567", "IronForge Gym"],
            ["pay-3", "Bank Transfer", "PK12ABCD1234567890123456", "IronForge Fitness Pvt Ltd"]
        ].forEach(([id, platform, account, holder]) => {
            db.run(
                "INSERT INTO payment_methods (id, platform_name, account_id, account_holder) VALUES (?, ?, ?, ?)",
                [id, platform, account, holder]
            );
        });
    }

    saveDb();
}

async function init() {
    const SQL = await initSqlJs();
    if (fs.existsSync(dbPath)) {
        db = new SQL.Database(fs.readFileSync(dbPath));
    } else {
        db = new SQL.Database();
    }
    initSchema();
}

function rowToApplication(row) {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        plan: row.plan,
        message: row.message,
        paymentMethodId: row.payment_method_id,
        paymentPlatform: row.platform_name || "",
        accountId: row.account_id || "",
        accountHolder: row.account_holder || "",
        receiptPath: row.receipt_path || "",
        receiptUrl: row.receipt_path ? `/uploads/${row.receipt_path}` : "",
        status: row.status,
        date: row.created_at
    };
}

function rowToMember(row) {
    return {
        id: row.id,
        applicationId: row.application_id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        plan: row.plan,
        joinedAt: row.joined_at
    };
}

function rowToPaymentMethod(row) {
    return {
        id: row.id,
        platformName: row.platform_name,
        accountId: row.account_id,
        accountHolder: row.account_holder
    };
}

module.exports = {
    uploadsDir,
    init,

    createApplication(app) {
        runSql(
            `INSERT INTO applications (id, name, email, phone, plan, message, payment_method_id, receipt_path, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                app.id, app.name, app.email, app.phone, app.plan,
                app.message || "", app.paymentMethodId, app.receiptPath || "",
                app.status || "pending", app.date
            ]
        );
        return rowToApplication(getOne(
            `SELECT a.*, p.platform_name, p.account_id, p.account_holder
             FROM applications a
             LEFT JOIN payment_methods p ON a.payment_method_id = p.id
             WHERE a.id = ?`,
            [app.id]
        ));
    },

    getApplications() {
        return getAll(
            `SELECT a.*, p.platform_name, p.account_id, p.account_holder
             FROM applications a
             LEFT JOIN payment_methods p ON a.payment_method_id = p.id
             ORDER BY a.created_at DESC`
        ).map(rowToApplication);
    },

    updateApplicationStatus(id, status) {
        runSql("UPDATE applications SET status = ? WHERE id = ?", [status, id]);
        const row = getOne(
            `SELECT a.*, p.platform_name, p.account_id, p.account_holder
             FROM applications a
             LEFT JOIN payment_methods p ON a.payment_method_id = p.id
             WHERE a.id = ?`,
            [id]
        );
        return row ? rowToApplication(row) : null;
    },

    deleteApplication(id) {
        const row = getOne("SELECT receipt_path FROM applications WHERE id = ?", [id]);
        if (row?.receipt_path) {
            const filePath = path.join(uploadsDir, row.receipt_path);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        runSql("DELETE FROM members WHERE application_id = ?", [id]);
        runSql("DELETE FROM applications WHERE id = ?", [id]);
    },

    approveApplication(id) {
        const app = getOne(
            `SELECT a.*, p.platform_name, p.account_id, p.account_holder
             FROM applications a
             LEFT JOIN payment_methods p ON a.payment_method_id = p.id
             WHERE a.id = ?`,
            [id]
        );
        if (!app) return null;

        db.run("UPDATE applications SET status = ? WHERE id = ?", ["approved", id]);
        const existing = getOne("SELECT id FROM members WHERE application_id = ?", [id]);
        if (!existing) {
            db.run(
                `INSERT INTO members (id, application_id, name, email, phone, plan, joined_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [`member-${Date.now()}`, id, app.name, app.email, app.phone, app.plan, new Date().toISOString()]
            );
        }
        saveDb();
        return rowToApplication(getOne(
            `SELECT a.*, p.platform_name, p.account_id, p.account_holder
             FROM applications a
             LEFT JOIN payment_methods p ON a.payment_method_id = p.id
             WHERE a.id = ?`,
            [id]
        ));
    },

    getMembers() {
        return getAll("SELECT * FROM members ORDER BY joined_at DESC").map(rowToMember);
    },

    deleteMember(id) {
        runSql("DELETE FROM members WHERE id = ?", [id]);
    },

    getPaymentMethods() {
        return getAll("SELECT * FROM payment_methods ORDER BY platform_name").map(rowToPaymentMethod);
    },

    getPaymentMethod(id) {
        const row = getOne("SELECT * FROM payment_methods WHERE id = ?", [id]);
        return row ? rowToPaymentMethod(row) : null;
    },

    createPaymentMethod(method) {
        runSql(
            "INSERT INTO payment_methods (id, platform_name, account_id, account_holder) VALUES (?, ?, ?, ?)",
            [method.id, method.platformName, method.accountId, method.accountHolder]
        );
        return rowToPaymentMethod(getOne("SELECT * FROM payment_methods WHERE id = ?", [method.id]));
    },

    updatePaymentMethod(method) {
        runSql(
            "UPDATE payment_methods SET platform_name = ?, account_id = ?, account_holder = ? WHERE id = ?",
            [method.platformName, method.accountId, method.accountHolder, method.id]
        );
        return rowToPaymentMethod(getOne("SELECT * FROM payment_methods WHERE id = ?", [method.id]));
    },

    deletePaymentMethod(id) {
        runSql("DELETE FROM payment_methods WHERE id = ?", [id]);
    }
};
