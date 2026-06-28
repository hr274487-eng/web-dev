const tabTitles = {
    plans: "Manage Plans",
    fees: "Fee Structure",
    admission: "Admission Steps",
    payments: "Payment Methods",
    applications: "Applications",
    members: "Current Members",
    settings: "Settings"
};

let currentTab = "plans";

function initAdmin() {
    if (!document.getElementById("admin-panel")) return;

    if (GymStore.isLoggedIn()) {
        showPanel();
    }

    document.getElementById("login-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const password = document.getElementById("password").value;
        const error = document.getElementById("login-error");

        if (GymStore.login(password)) {
            error.hidden = true;
            showPanel();
        } else {
            error.hidden = false;
        }
    });

    document.getElementById("logout-btn").addEventListener("click", () => {
        GymStore.logout();
        document.getElementById("admin-panel").hidden = true;
        document.getElementById("login-screen").hidden = false;
        document.getElementById("password").value = "";
    });

    document.querySelectorAll(".admin-nav-btn").forEach(btn => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    document.getElementById("add-plan-btn").addEventListener("click", () => openPlanModal());
    document.getElementById("add-fee-btn").addEventListener("click", () => openFeeModal());
    document.getElementById("add-step-btn").addEventListener("click", () => openStepModal());
    document.getElementById("add-payment-btn").addEventListener("click", () => openPaymentModal());

    document.getElementById("password-form").addEventListener("submit", handlePasswordChange);
    document.getElementById("reset-data-btn").addEventListener("click", handleReset);

    document.getElementById("admin-panel").addEventListener("click", handleAdminAction);
    setupModal();
}

function handleAdminAction(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const { action, id } = btn.dataset;
    switch (action) {
        case "edit-plan": openPlanModal(id); break;
        case "delete-plan": deletePlan(id); break;
        case "edit-fee": openFeeModal(id); break;
        case "delete-fee": deleteFee(id); break;
        case "edit-step": openStepModal(id); break;
        case "delete-step": deleteStep(id); break;
        case "approve-app": updateAppStatus(id, "approved"); break;
        case "reject-app": updateAppStatus(id, "rejected"); break;
        case "delete-app": deleteApp(id); break;
        case "remove-member": removeMember(id); break;
        case "edit-payment": openPaymentModal(id); break;
        case "delete-payment": deletePayment(id); break;
        case "view-receipt": viewReceipt(btn.dataset.url); break;
    }
}

function showPanel() {
    document.getElementById("login-screen").hidden = true;
    document.getElementById("admin-panel").hidden = false;
    renderAllAdmin();
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll(".admin-nav-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".admin-tab").forEach(t => t.classList.toggle("active", t.id === `tab-${tab}`));
    document.getElementById("admin-title").textContent = tabTitles[tab];
}

function renderAllAdmin() {
    renderAdminPlans();
    renderAdminFees();
    renderAdminSteps();
    renderAdminPaymentMethods();
    renderAdminApplications();
    renderAdminMembers();
}

function renderAdminPlans() {
    const container = document.getElementById("admin-plans-list");
    const { plans } = GymStore.getData();

    container.innerHTML = plans.map(plan => `
        <div class="admin-card">
            <div class="admin-card-info">
                <h4>${escapeHtml(plan.name)} ${plan.featured ? '<span class="badge">Featured</span>' : ""}</h4>
                <p>${GymStore.formatPrice(plan.price)} · ${escapeHtml(plan.duration)} · ${(plan.features || []).length} features</p>
            </div>
            <div class="admin-card-actions">
                <button class="btn btn-outline btn-sm" data-action="edit-plan" data-id="${escapeAttr(plan.id)}">Edit</button>
                <button class="btn btn-danger btn-sm" data-action="delete-plan" data-id="${escapeAttr(plan.id)}">Delete</button>
            </div>
        </div>
    `).join("") || '<p style="color:var(--text-muted)">No plans yet. Add one to get started.</p>';
}

function renderAdminFees() {
    const container = document.getElementById("admin-fees-list");
    const { fees } = GymStore.getData();

    container.innerHTML = `
        <table class="admin-table">
            <thead>
                <tr><th>Item</th><th>Amount</th><th>Note</th><th>Actions</th></tr>
            </thead>
            <tbody>
                ${fees.map(fee => `
                    <tr>
                        <td>${escapeHtml(fee.item)}</td>
                        <td>${GymStore.formatPrice(fee.amount)}</td>
                        <td>${escapeHtml(fee.note || "—")}${fee.refundable ? ' <span class="fee-refund">Refundable</span>' : ""}</td>
                        <td class="actions">
                            <button class="btn btn-outline btn-sm" data-action="edit-fee" data-id="${escapeAttr(fee.id)}">Edit</button>
                            <button class="btn btn-danger btn-sm" data-action="delete-fee" data-id="${escapeAttr(fee.id)}">Delete</button>
                        </td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}

function renderAdminSteps() {
    const container = document.getElementById("admin-steps-list");
    const { admissionSteps } = GymStore.getData();
    const sorted = [...admissionSteps].sort((a, b) => a.step - b.step);

    container.innerHTML = sorted.map(step => `
        <div class="admin-card">
            <div class="admin-card-info">
                <h4>Step ${step.step}: ${escapeHtml(step.title)}</h4>
                <p>${escapeHtml(step.description)}</p>
            </div>
            <div class="admin-card-actions">
                <button class="btn btn-outline btn-sm" data-action="edit-step" data-id="${escapeAttr(step.id)}">Edit</button>
                <button class="btn btn-danger btn-sm" data-action="delete-step" data-id="${escapeAttr(step.id)}">Delete</button>
            </div>
        </div>
    `).join("") || '<p style="color:var(--text-muted)">No steps yet.</p>';
}

function renderAdminApplications() {
    const container = document.getElementById("admin-applications-list");
    const countEl = document.getElementById("app-count");

    GymAPI.getApplications().then(applications => {
        countEl.textContent = `${applications.length} application${applications.length !== 1 ? "s" : ""}`;

        if (!applications.length) {
            container.innerHTML = '<p style="padding:1.5rem;color:var(--text-muted)">No applications yet.</p>';
            return;
        }

        container.innerHTML = `
            <table class="admin-table applications-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Contact</th>
                        <th>Plan</th>
                        <th>Payment</th>
                        <th>Receipt</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${applications.map(app => {
                        const receiptFullUrl = app.receiptUrl ? `${API_BASE}${app.receiptUrl}` : "";
                        return `
                        <tr>
                            <td>${escapeHtml(app.name)}</td>
                            <td>${escapeHtml(app.email)}<br><small>${escapeHtml(app.phone)}</small></td>
                            <td>${escapeHtml(app.plan)}</td>
                            <td class="payment-cell">
                                <strong>${escapeHtml(app.paymentPlatform || "—")}</strong>
                                ${app.accountId ? `<br><small>${escapeHtml(app.accountId)}</small>` : ""}
                                ${app.accountHolder ? `<br><small>${escapeHtml(app.accountHolder)}</small>` : ""}
                            </td>
                            <td>
                                ${receiptFullUrl
                                    ? `<button type="button" class="receipt-thumb-btn" data-action="view-receipt" data-url="${escapeAttr(receiptFullUrl)}">
                                        <img src="${escapeAttr(receiptFullUrl)}" alt="Receipt" class="receipt-thumb">
                                       </button>`
                                    : '<span class="text-muted">—</span>'}
                            </td>
                            <td>${new Date(app.date).toLocaleDateString()}</td>
                            <td><span class="status-${app.status}">${app.status}</span></td>
                            <td class="actions">
                                ${app.status !== "approved"
                                    ? `<button class="btn btn-outline btn-sm" data-action="approve-app" data-id="${escapeAttr(app.id)}" title="Verify receipt and approve">Approve Payment</button>`
                                    : ""}
                                ${app.status !== "rejected"
                                    ? `<button class="btn btn-danger btn-sm" data-action="reject-app" data-id="${escapeAttr(app.id)}" title="Reject — payment not verified">Reject</button>`
                                    : ""}
                                <button class="btn btn-outline btn-sm" data-action="delete-app" data-id="${escapeAttr(app.id)}">Delete</button>
                            </td>
                        </tr>
                    `}).join("")}
                </tbody>
            </table>
        `;
    }).catch(() => {
        countEl.textContent = "—";
        container.innerHTML = '<p class="api-error">Could not load applications. Make sure the server is running (<code>npm start</code> in the server folder).</p>';
    });
}

function renderAdminPaymentMethods() {
    const container = document.getElementById("admin-payments-list");
    if (!container) return;

    GymAPI.getPaymentMethods().then(methods => {
        if (!methods.length) {
            container.innerHTML = '<p style="padding:1.5rem;color:var(--text-muted)">No payment methods yet. Add JazzCash, EasyPaisa, or bank accounts.</p>';
            return;
        }

        container.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr><th>Platform</th><th>Account / ID</th><th>Account Holder</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    ${methods.map(m => `
                        <tr>
                            <td><strong>${escapeHtml(m.platformName)}</strong></td>
                            <td>${escapeHtml(m.accountId)}</td>
                            <td>${escapeHtml(m.accountHolder)}</td>
                            <td class="actions">
                                <button class="btn btn-outline btn-sm" data-action="edit-payment" data-id="${escapeAttr(m.id)}">Edit</button>
                                <button class="btn btn-danger btn-sm" data-action="delete-payment" data-id="${escapeAttr(m.id)}">Delete</button>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    }).catch(() => {
        container.innerHTML = '<p class="api-error">Could not load payment methods. Make sure the server is running.</p>';
    });
}

function openPaymentModal(id) {
    GymAPI.getPaymentMethods().then(methods => {
        const method = id ? methods.find(m => m.id === id) : null;
        const isEdit = !!method;

        document.getElementById("modal-title").textContent = isEdit ? "Edit Payment Method" : "Add Payment Method";
        document.getElementById("modal-form").innerHTML = `
            <input type="hidden" name="id" value="${method?.id || ""}">
            <div class="form-group">
                <label>Platform Name</label>
                <input type="text" name="platformName" required placeholder="e.g. JazzCash, EasyPaisa, Bank Transfer" value="${escapeAttr(method?.platformName || "")}">
            </div>
            <div class="form-group">
                <label>Account / ID Number</label>
                <input type="text" name="accountId" required placeholder="Phone number or bank account number" value="${escapeAttr(method?.accountId || "")}">
            </div>
            <div class="form-group">
                <label>Account Holder Name</label>
                <input type="text" name="accountHolder" required placeholder="Name on the account" value="${escapeAttr(method?.accountHolder || "")}">
            </div>
            <button type="submit" class="btn btn-primary btn-full">${isEdit ? "Save Changes" : "Add Payment Method"}</button>
        `;

        document.getElementById("modal-form").onsubmit = async (e) => {
            e.preventDefault();
            const form = e.target;
            try {
                await GymAPI.savePaymentMethod({
                    id: form.id.value || undefined,
                    platformName: form.platformName.value.trim(),
                    accountId: form.accountId.value.trim(),
                    accountHolder: form.accountHolder.value.trim()
                });
                closeModal();
                renderAdminPaymentMethods();
            } catch (err) {
                alert(err.message);
            }
        };

        openModal();
    });
}

async function deletePayment(id) {
    if (!confirm("Delete this payment method? It will no longer appear on the application form.")) return;
    try {
        await GymAPI.deletePaymentMethod(id);
        renderAdminPaymentMethods();
    } catch {
        alert("Failed to delete payment method.");
    }
}

function viewReceipt(url) {
    document.getElementById("modal-title").textContent = "Payment Receipt";
    document.getElementById("modal-form").innerHTML = `
        <div class="receipt-viewer">
            <img src="${escapeAttr(url)}" alt="Payment receipt">
        </div>
        <a href="${escapeAttr(url)}" target="_blank" rel="noopener" class="btn btn-outline btn-full">Open Full Size</a>
    `;
    document.getElementById("modal-form").onsubmit = (e) => e.preventDefault();
    openModal();
}

function renderAdminMembers() {
    const container = document.getElementById("admin-members-list");
    const countEl = document.getElementById("member-count");
    if (!container) return;

    GymAPI.getMembers().then(members => {
        countEl.textContent = `${members.length} active member${members.length !== 1 ? "s" : ""}`;

        if (!members.length) {
            container.innerHTML = '<p style="padding:1.5rem;color:var(--text-muted)">No active members yet. Approve applications to add members here.</p>';
            return;
        }

        container.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr><th>Name</th><th>Contact</th><th>Plan</th><th>Joined</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    ${members.map(member => `
                        <tr>
                            <td>${escapeHtml(member.name)}</td>
                            <td>${escapeHtml(member.email)}<br><small>${escapeHtml(member.phone)}</small></td>
                            <td>${escapeHtml(member.plan)}</td>
                            <td>${new Date(member.joinedAt).toLocaleDateString()}</td>
                            <td class="actions">
                                <button class="btn btn-danger btn-sm" data-action="remove-member" data-id="${escapeAttr(member.id)}">Remove</button>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    }).catch(() => {
        countEl.textContent = "—";
        container.innerHTML = '<p class="api-error">Could not load members. Make sure the server is running.</p>';
    });
}

function openPlanModal(id) {
    const data = GymStore.getData();
    const plan = id ? data.plans.find(p => p.id === id) : null;
    const isEdit = !!plan;

    document.getElementById("modal-title").textContent = isEdit ? "Edit Plan" : "Add Plan";
    document.getElementById("modal-form").innerHTML = `
        <input type="hidden" name="id" value="${plan?.id || ""}">
        <div class="form-group">
            <label>Plan Name</label>
            <input type="text" name="name" required value="${escapeAttr(plan?.name || "")}">
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Price (Rs.)</label>
                <input type="number" name="price" required min="0" value="${plan?.price || ""}">
            </div>
            <div class="form-group">
                <label>Duration</label>
                <input type="text" name="duration" required placeholder="e.g. 3 Months" value="${escapeAttr(plan?.duration || "")}">
            </div>
        </div>
        <div class="form-group">
            <label>Features (one per line)</label>
            <textarea name="features" rows="5" required>${(plan?.features || []).join("\n")}</textarea>
        </div>
        <div class="checkbox-group">
            <input type="checkbox" name="featured" id="featured" ${plan?.featured ? "checked" : ""}>
            <label for="featured">Mark as Most Popular</label>
        </div>
        <button type="submit" class="btn btn-primary btn-full">${isEdit ? "Save Changes" : "Add Plan"}</button>
    `;

    document.getElementById("modal-form").onsubmit = (e) => {
        e.preventDefault();
        const form = e.target;
        const planData = {
            id: form.id.value || GymStore.generateId("plan"),
            name: form.name.value.trim(),
            price: Number(form.price.value),
            duration: form.duration.value.trim(),
            features: form.features.value.split("\n").map(f => f.trim()).filter(Boolean),
            featured: form.featured.checked
        };

        if (isEdit) {
            data.plans = data.plans.map(p => p.id === planData.id ? planData : p);
        } else {
            data.plans.push(planData);
        }

        if (planData.featured) {
            data.plans = data.plans.map(p => ({ ...p, featured: p.id === planData.id }));
        }

        GymStore.saveData(data);
        closeModal();
        renderAdminPlans();
    };

    openModal();
}

function openFeeModal(id) {
    const data = GymStore.getData();
    const fee = id ? data.fees.find(f => f.id === id) : null;
    const isEdit = !!fee;

    document.getElementById("modal-title").textContent = isEdit ? "Edit Fee" : "Add Fee";
    document.getElementById("modal-form").innerHTML = `
        <input type="hidden" name="id" value="${fee?.id || ""}">
        <div class="form-group">
            <label>Fee Item</label>
            <input type="text" name="item" required value="${escapeAttr(fee?.item || "")}">
        </div>
        <div class="form-group">
            <label>Amount (Rs.)</label>
            <input type="number" name="amount" required min="0" value="${fee?.amount || ""}">
        </div>
        <div class="form-group">
            <label>Note</label>
            <input type="text" name="note" value="${escapeAttr(fee?.note || "")}">
        </div>
        <div class="checkbox-group">
            <input type="checkbox" name="refundable" id="refundable" ${fee?.refundable ? "checked" : ""}>
            <label for="refundable">Refundable</label>
        </div>
        <button type="submit" class="btn btn-primary btn-full">${isEdit ? "Save Changes" : "Add Fee"}</button>
    `;

    document.getElementById("modal-form").onsubmit = (e) => {
        e.preventDefault();
        const form = e.target;
        const feeData = {
            id: form.id.value || GymStore.generateId("fee"),
            item: form.item.value.trim(),
            amount: Number(form.amount.value),
            note: form.note.value.trim(),
            refundable: form.refundable.checked
        };

        if (isEdit) {
            data.fees = data.fees.map(f => f.id === feeData.id ? feeData : f);
        } else {
            data.fees.push(feeData);
        }

        GymStore.saveData(data);
        closeModal();
        renderAdminFees();
    };

    openModal();
}

function openStepModal(id) {
    const data = GymStore.getData();
    const step = id ? data.admissionSteps.find(s => s.id === id) : null;
    const isEdit = !!step;

    document.getElementById("modal-title").textContent = isEdit ? "Edit Step" : "Add Step";
    document.getElementById("modal-form").innerHTML = `
        <input type="hidden" name="id" value="${step?.id || ""}">
        <div class="form-group">
            <label>Step Number</label>
            <input type="number" name="step" required min="1" value="${step?.step || data.admissionSteps.length + 1}">
        </div>
        <div class="form-group">
            <label>Title</label>
            <input type="text" name="title" required value="${escapeAttr(step?.title || "")}">
        </div>
        <div class="form-group">
            <label>Description</label>
            <textarea name="description" rows="3" required>${escapeAttr(step?.description || "")}</textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-full">${isEdit ? "Save Changes" : "Add Step"}</button>
    `;

    document.getElementById("modal-form").onsubmit = (e) => {
        e.preventDefault();
        const form = e.target;
        const stepData = {
            id: form.id.value || GymStore.generateId("step"),
            step: Number(form.step.value),
            title: form.title.value.trim(),
            description: form.description.value.trim()
        };

        if (isEdit) {
            data.admissionSteps = data.admissionSteps.map(s => s.id === stepData.id ? stepData : s);
        } else {
            data.admissionSteps.push(stepData);
        }

        GymStore.saveData(data);
        closeModal();
        renderAdminSteps();
    };

    openModal();
}

function deletePlan(id) {
    if (!confirm("Delete this plan?")) return;
    const data = GymStore.getData();
    data.plans = data.plans.filter(p => p.id !== id);
    GymStore.saveData(data);
    renderAdminPlans();
}

function deleteFee(id) {
    if (!confirm("Delete this fee item?")) return;
    const data = GymStore.getData();
    data.fees = data.fees.filter(f => f.id !== id);
    GymStore.saveData(data);
    renderAdminFees();
}

function deleteStep(id) {
    if (!confirm("Delete this step?")) return;
    const data = GymStore.getData();
    data.admissionSteps = data.admissionSteps.filter(s => s.id !== id);
    GymStore.saveData(data);
    renderAdminSteps();
}

async function updateAppStatus(id, status) {
    const msg = status === "approved"
        ? "Approve this application? Confirm the fee receipt is valid."
        : "Reject this application? The payment was not verified.";
    if (!confirm(msg)) return;

    try {
        await GymAPI.updateApplicationStatus(id, status);
        renderAdminApplications();
        if (status === "approved") renderAdminMembers();
    } catch {
        alert("Failed to update application. Is the server running?");
    }
}

async function deleteApp(id) {
    if (!confirm("Delete this application?")) return;
    try {
        await GymAPI.deleteApplication(id);
        renderAdminApplications();
        renderAdminMembers();
    } catch {
        alert("Failed to delete application.");
    }
}

async function removeMember(id) {
    if (!confirm("Remove this member from the active list?")) return;
    try {
        await GymAPI.deleteMember(id);
        renderAdminMembers();
    } catch {
        alert("Failed to remove member.");
    }
}

function handlePasswordChange(e) {
    e.preventDefault();
    const newPass = document.getElementById("new-password").value;
    const confirm = document.getElementById("confirm-password").value;
    const status = document.getElementById("password-status");

    if (newPass !== confirm) {
        status.hidden = false;
        status.className = "form-status error";
        status.textContent = "Passwords do not match.";
        return;
    }

    GymStore.setPassword(newPass);
    status.hidden = false;
    status.className = "form-status success";
    status.textContent = "Password updated successfully.";
    e.target.reset();
}

function handleReset() {
    if (!confirm("Reset all plans, fees, and admission steps to defaults? Database applications and members are not affected.")) return;
    GymStore.resetToDefaults();
    renderAllAdmin();
}

function setupModal() {
    document.querySelector(".modal-close").addEventListener("click", closeModal);
    document.querySelector(".modal-backdrop").addEventListener("click", closeModal);
}

function openModal() {
    document.getElementById("modal").hidden = false;
}

function closeModal() {
    document.getElementById("modal").hidden = true;
}

function escapeAttr(text) {
    return String(text || "").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdmin);
} else {
    initAdmin();
}
