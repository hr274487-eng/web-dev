const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, db.uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
        const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
        cb(null, `receipt-${Date.now()}${safeExt}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new Error("Only image files are allowed for receipt upload."));
    }
});

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "..")));
app.use("/uploads", express.static(db.uploadsDir));

function requireAdmin(req, res, next) {
    const auth = req.headers.authorization;
    if (auth === `Bearer ${ADMIN_PASSWORD}`) return next();
    const password = req.headers["x-admin-password"];
    if (password === ADMIN_PASSWORD) return next();
    return res.status(401).json({ error: "Unauthorized" });
}

app.get("/api/health", (_req, res) => {
    res.json({ ok: true, message: "IronForge Gym API is running" });
});

app.get("/api/payment-methods", (_req, res) => {
    res.json(db.getPaymentMethods());
});

app.post("/api/payment-methods", requireAdmin, (req, res) => {
    const { platformName, accountId, accountHolder } = req.body;
    if (!platformName?.trim() || !accountId?.trim() || !accountHolder?.trim()) {
        return res.status(400).json({ error: "Platform name, account ID, and account holder are required." });
    }
    const method = db.createPaymentMethod({
        id: `pay-${Date.now()}`,
        platformName: platformName.trim(),
        accountId: accountId.trim(),
        accountHolder: accountHolder.trim()
    });
    res.status(201).json(method);
});

app.put("/api/payment-methods/:id", requireAdmin, (req, res) => {
    const { platformName, accountId, accountHolder } = req.body;
    if (!platformName?.trim() || !accountId?.trim() || !accountHolder?.trim()) {
        return res.status(400).json({ error: "Platform name, account ID, and account holder are required." });
    }
    const existing = db.getPaymentMethod(req.params.id);
    if (!existing) return res.status(404).json({ error: "Payment method not found." });
    const method = db.updatePaymentMethod({
        id: req.params.id,
        platformName: platformName.trim(),
        accountId: accountId.trim(),
        accountHolder: accountHolder.trim()
    });
    res.json(method);
});

app.delete("/api/payment-methods/:id", requireAdmin, (req, res) => {
    db.deletePaymentMethod(req.params.id);
    res.json({ success: true });
});

app.post("/api/applications", upload.single("receipt"), (req, res) => {
    const { name, email, phone, plan, message, paymentMethodId } = req.body;

    if (!name?.trim() || !email?.trim() || !phone?.trim() || !plan?.trim()) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "Name, email, phone, and plan are required." });
    }
    if (!paymentMethodId?.trim()) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "Please select a payment platform." });
    }
    if (!req.file) {
        return res.status(400).json({ error: "Fee receipt screenshot is required." });
    }
    if (!db.getPaymentMethod(paymentMethodId)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "Invalid payment platform selected." });
    }

    const application = db.createApplication({
        id: `app-${Date.now()}`,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        plan: plan.trim(),
        message: (message || "").trim(),
        paymentMethodId: paymentMethodId.trim(),
        receiptPath: req.file.filename,
        status: "pending",
        date: new Date().toISOString()
    });

    res.status(201).json(application);
});

app.use((err, _req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ error: "Receipt image must be under 5 MB." });
        }
        return res.status(400).json({ error: err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
});

app.get("/api/applications", requireAdmin, (_req, res) => {
    res.json(db.getApplications());
});

app.patch("/api/applications/:id", requireAdmin, (req, res) => {
    const { status } = req.body;
    const { id } = req.params;

    if (!["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Invalid status." });
    }

    if (status === "approved") {
        const updated = db.approveApplication(id);
        if (!updated) return res.status(404).json({ error: "Application not found." });
        return res.json(updated);
    }

    const updated = db.updateApplicationStatus(id, status);
    if (!updated) return res.status(404).json({ error: "Application not found." });
    res.json(updated);
});

app.delete("/api/applications/:id", requireAdmin, (req, res) => {
    db.deleteApplication(req.params.id);
    res.json({ success: true });
});

app.get("/api/members", requireAdmin, (_req, res) => {
    res.json(db.getMembers());
});

app.delete("/api/members/:id", requireAdmin, (req, res) => {
    db.deleteMember(req.params.id);
    res.json({ success: true });
});

async function start() {
    await db.init();
    app.listen(PORT, () => {
        console.log(`IronForge Gym server running at http://localhost:${PORT}`);
        console.log(`Website: http://localhost:${PORT}/index.html`);
        console.log(`Admin:   http://localhost:${PORT}/admin.html`);
    });
}

start().catch(err => {
    console.error("Failed to start server:", err);
    process.exit(1);
});
