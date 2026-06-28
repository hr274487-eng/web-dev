const STORAGE_KEY = "ironforge_gym_data";
const AUTH_KEY = "ironforge_admin_auth";
const DEFAULT_PASSWORD = "admin123";

const defaultData = {
    plans: [
        {
            id: "plan-1",
            name: "Basic",
            price: 1999,
            duration: "1 Month",
            features: ["Gym floor access", "Locker room", "Basic equipment", "Weekday hours"],
            featured: false
        },
        {
            id: "plan-2",
            name: "Pro",
            price: 4999,
            duration: "3 Months",
            features: ["24/7 gym access", "All equipment", "2 group classes/week", "Diet consultation", "Personal locker"],
            featured: true
        },
        {
            id: "plan-3",
            name: "Elite",
            price: 8999,
            duration: "6 Months",
            features: ["Everything in Pro", "Unlimited group classes", "Monthly PT session", "Sauna & steam room", "Guest pass (2/month)"],
            featured: false
        }
    ],
    fees: [
        { id: "fee-1", item: "Registration Fee", amount: 500, note: "One-time, non-refundable" },
        { id: "fee-2", item: "Security Deposit", amount: 1000, note: "Refundable on membership cancellation", refundable: true },
        { id: "fee-3", item: "ID Card Fee", amount: 200, note: "Membership card issuance" },
        { id: "fee-4", item: "Late Payment Penalty", amount: 300, note: "Applied after 7-day grace period" },
        { id: "fee-5", item: "Personal Training (per session)", amount: 1500, note: "Optional add-on" }
    ],
    admissionSteps: [
        { id: "step-1", step: 1, title: "Visit the Gym", description: "Come to IronForge Gym during working hours (6 AM – 10 PM) for a free tour of our facilities." },
        { id: "step-2", step: 2, title: "Choose a Plan", description: "Select a membership plan that suits your fitness goals and budget. Our staff will guide you." },
        { id: "step-3", step: 3, title: "Fill Application Form", description: "Complete the membership application with your personal details, emergency contact, and health information." },
        { id: "step-4", step: 4, title: "Pay Fees", description: "Pay the registration fee, security deposit, and your chosen plan fee. We accept cash, card, and bank transfer." },
        { id: "step-5", step: 5, title: "Get Your Membership Card", description: "Receive your membership card and schedule your free fitness assessment with a trainer." }
    ],
    applications: []
};

const API_BASE = window.location.port === "3000" ? "" : "http://localhost:3000";

const GymAPI = {
    getAdminHeaders() {
        const password = sessionStorage.getItem("admin_token") || GymStore.getPassword();
        return {
            "Content-Type": "application/json",
            "X-Admin-Password": password
        };
    },

    async submitApplication(formData) {
        const res = await fetch(`${API_BASE}/api/applications`, {
            method: "POST",
            body: formData
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Failed to submit application.");
        }
        return res.json();
    },

    async getPaymentMethods() {
        const res = await fetch(`${API_BASE}/api/payment-methods`);
        if (!res.ok) throw new Error("Failed to load payment methods.");
        return res.json();
    },

    async savePaymentMethod(method) {
        const isEdit = Boolean(method.id);
        const res = await fetch(
            isEdit ? `${API_BASE}/api/payment-methods/${method.id}` : `${API_BASE}/api/payment-methods`,
            {
                method: isEdit ? "PUT" : "POST",
                headers: GymAPI.getAdminHeaders(),
                body: JSON.stringify({
                    platformName: method.platformName,
                    accountId: method.accountId,
                    accountHolder: method.accountHolder
                })
            }
        );
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Failed to save payment method.");
        }
        return res.json();
    },

    async deletePaymentMethod(id) {
        const res = await fetch(`${API_BASE}/api/payment-methods/${id}`, {
            method: "DELETE",
            headers: GymAPI.getAdminHeaders()
        });
        if (!res.ok) throw new Error("Failed to delete payment method.");
        return res.json();
    },

    async getApplications() {
        const res = await fetch(`${API_BASE}/api/applications`, {
            headers: GymAPI.getAdminHeaders()
        });
        if (!res.ok) throw new Error("Failed to load applications.");
        return res.json();
    },

    async updateApplicationStatus(id, status) {
        const res = await fetch(`${API_BASE}/api/applications/${id}`, {
            method: "PATCH",
            headers: GymAPI.getAdminHeaders(),
            body: JSON.stringify({ status })
        });
        if (!res.ok) throw new Error("Failed to update application.");
        return res.json();
    },

    async deleteApplication(id) {
        const res = await fetch(`${API_BASE}/api/applications/${id}`, {
            method: "DELETE",
            headers: GymAPI.getAdminHeaders()
        });
        if (!res.ok) throw new Error("Failed to delete application.");
        return res.json();
    },

    async getMembers() {
        const res = await fetch(`${API_BASE}/api/members`, {
            headers: GymAPI.getAdminHeaders()
        });
        if (!res.ok) throw new Error("Failed to load members.");
        return res.json();
    },

    async deleteMember(id) {
        const res = await fetch(`${API_BASE}/api/members/${id}`, {
            method: "DELETE",
            headers: GymAPI.getAdminHeaders()
        });
        if (!res.ok) throw new Error("Failed to remove member.");
        return res.json();
    },

    async checkHealth() {
        try {
            const res = await fetch(`${API_BASE}/api/health`);
            return res.ok;
        } catch {
            return false;
        }
    }
};

const GymStore = {
    getData() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            this.saveData(defaultData);
            return structuredClone(defaultData);
        }
        const parsed = JSON.parse(stored);
        return {
            plans: parsed.plans || defaultData.plans,
            fees: parsed.fees || defaultData.fees,
            admissionSteps: parsed.admissionSteps || defaultData.admissionSteps,
            applications: parsed.applications || []
        };
    },

    saveData(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    },

    getPassword() {
        return localStorage.getItem(AUTH_KEY) || DEFAULT_PASSWORD;
    },

    setPassword(password) {
        localStorage.setItem(AUTH_KEY, password);
    },

    isLoggedIn() {
        return sessionStorage.getItem("admin_logged_in") === "true";
    },

    login(password) {
        if (password === this.getPassword()) {
            sessionStorage.setItem("admin_logged_in", "true");
            sessionStorage.setItem("admin_token", password);
            return true;
        }
        return false;
    },

    logout() {
        sessionStorage.removeItem("admin_logged_in");
        sessionStorage.removeItem("admin_token");
    },

    resetToDefaults() {
        const data = this.getData();
        const apps = data.applications;
        const fresh = structuredClone(defaultData);
        fresh.applications = apps;
        this.saveData(fresh);
    },

    generateId(prefix) {
        return `${prefix}-${Date.now()}`;
    },

    formatPrice(amount) {
        return `Rs. ${Number(amount).toLocaleString("en-PK")}`;
    }
};

function renderPlans() {
    const grid = document.getElementById("plans-grid");
    if (!grid) return;

    const { plans } = GymStore.getData();
    grid.innerHTML = plans.map(plan => `
        <article class="plan-card ${plan.featured ? "featured" : ""}">
            ${plan.featured ? '<span class="plan-badge">Most Popular</span>' : ""}
            <h3>${escapeHtml(plan.name)}</h3>
            <p class="plan-duration">${escapeHtml(plan.duration)}</p>
            <div class="plan-price">
                <strong>${GymStore.formatPrice(plan.price)}</strong>
                <span> / ${escapeHtml(plan.duration.toLowerCase())}</span>
            </div>
            <ul class="plan-features">
                ${plan.features.map(f => `<li>${escapeHtml(f)}</li>`).join("")}
            </ul>
            <a href="#apply" class="btn ${plan.featured ? "btn-primary" : "btn-outline"}">Choose Plan</a>
        </article>
    `).join("");
}

function renderAdmissionSteps() {
    const container = document.getElementById("admission-steps");
    if (!container) return;

    const { admissionSteps } = GymStore.getData();
    const sorted = [...admissionSteps].sort((a, b) => a.step - b.step);

    container.innerHTML = sorted.map(item => `
        <div class="step-item">
            <div class="step-number">${item.step}</div>
            <div class="step-content">
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.description)}</p>
            </div>
        </div>
    `).join("");
}

function renderFees() {
    const tbody = document.getElementById("fees-body");
    if (!tbody) return;

    const { fees } = GymStore.getData();
    tbody.innerHTML = fees.map(fee => `
        <tr>
            <td>${escapeHtml(fee.item)}</td>
            <td>${GymStore.formatPrice(fee.amount)}</td>
            <td>
                <span class="fee-note">${escapeHtml(fee.note || "—")}</span>
                ${fee.refundable ? ' <span class="fee-refund">Refundable</span>' : ""}
            </td>
        </tr>
    `).join("");
}

function populatePlanSelect() {
    const select = document.getElementById("plan");
    if (!select) return;

    const { plans } = GymStore.getData();
    select.innerHTML = '<option value="">Select a plan</option>' +
        plans.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)} — ${GymStore.formatPrice(p.price)}</option>`).join("");
}

async function renderPaymentMethods() {
    const list = document.getElementById("payment-methods-list");
    const select = document.getElementById("paymentMethodId");
    if (!list && !select) return;

    try {
        const methods = await GymAPI.getPaymentMethods();

        if (list) {
            list.innerHTML = methods.length
                ? methods.map(m => `
                    <div class="payment-method-card">
                        <h4>${escapeHtml(m.platformName)}</h4>
                        <div class="payment-detail">
                            <span class="payment-label">Account / ID</span>
                            <strong>${escapeHtml(m.accountId)}</strong>
                        </div>
                        <div class="payment-detail">
                            <span class="payment-label">Account Holder</span>
                            <strong>${escapeHtml(m.accountHolder)}</strong>
                        </div>
                    </div>
                `).join("")
                : '<p class="payment-empty">Payment methods will appear here once configured.</p>';
        }

        if (select) {
            select.innerHTML = '<option value="">Select platform you paid through</option>' +
                methods.map(m => `<option value="${escapeAttr(m.id)}">${escapeHtml(m.platformName)} — ${escapeHtml(m.accountId)}</option>`).join("");
        }
    } catch {
        if (list) list.innerHTML = '<p class="payment-empty">Could not load payment methods. Start the server to view accounts.</p>';
    }
}

function escapeAttr(text) {
    return String(text || "").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function setupNav() {
    const toggle = document.querySelector(".nav-toggle");
    const links = document.querySelector(".nav-links");
    if (!toggle || !links) return;

    toggle.addEventListener("click", () => {
        const open = links.classList.toggle("open");
        toggle.setAttribute("aria-expanded", open);
    });

    links.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            links.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
        });
    });
}

function setupApplyForm() {
    const form = document.getElementById("apply-form");
    if (!form) return;

    const receiptInput = document.getElementById("receipt");
    const receiptPreview = document.getElementById("receipt-preview");
    const fileLabel = form.querySelector(".file-upload-text");

    receiptInput?.addEventListener("change", () => {
        const file = receiptInput.files[0];
        if (!file) {
            receiptPreview.hidden = true;
            if (fileLabel) fileLabel.textContent = "Choose screenshot (PNG, JPG — max 5 MB)";
            return;
        }
        if (fileLabel) fileLabel.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (e) => {
            receiptPreview.src = e.target.result;
            receiptPreview.hidden = false;
        };
        reader.readAsDataURL(file);
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const status = document.getElementById("form-status");
        const submitBtn = form.querySelector('button[type="submit"]');
        const formData = new FormData(form);

        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";

        try {
            await GymAPI.submitApplication(formData);
            form.reset();
            receiptPreview.hidden = true;
            if (fileLabel) fileLabel.textContent = "Choose screenshot (PNG, JPG — max 5 MB)";
            status.hidden = false;
            status.className = "form-status success";
            status.textContent = "Application submitted! We will verify your payment and contact you within 24 hours.";
            setTimeout(() => { status.hidden = true; }, 6000);
        } catch (err) {
            status.hidden = false;
            status.className = "form-status error";
            status.textContent = err.message.includes("Failed to fetch")
                ? "Could not reach server. Please start the server and try again."
                : err.message;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Application";
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function initPublicSite() {
    renderPlans();
    renderAdmissionSteps();
    renderFees();
    populatePlanSelect();
    renderPaymentMethods();
    setupNav();
    setupApplyForm();
}

if (document.getElementById("plans-grid")) {
    initPublicSite();
}
