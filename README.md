<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>IC Surveillance — ICU Trauma</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" />
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', sans-serif; background: #F5F7FF; }
  input, select, textarea, button { font-family: 'Sarabun', sans-serif; }
  input:focus, select:focus, textarea:focus, button:focus-visible { outline: 2px solid #0EA5A0; outline-offset: 1px; }
  @media print {
    .no-print { display: none !important; }
    body { background: #fff !important; }
    .print-title { display: block !important; }
  }
  .print-title { display: none; }
</style>
</head>
<body>
<div id="root"></div>

<script>
const { useState, useEffect, useMemo, useCallback, useRef } = React;
const h = React.createElement;

// ====== CONFIGURE THIS ======
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzGwczSiH8qpypBcEtOWbdPu6_RxcHyLEnMO87Q4c1yJT5zN_ZyjMkZHU6Q5hPY9A63/exec";
const IC_TEAM_PASSWORD = "ictrauma";
// =============================

const T = {
  ink: "#152238", inkSoft: "#5B6B8C", bg: "#F5F7FF", surface: "#FFFFFF", line: "#E3E8FA",
  primary: "#0EA5A0", primaryDark: "#0A7A76", amber: "#E8590C", amberSoft: "#FFEEE3",
  gold: "#D69E00", goldSoft: "#FFF6DB", green: "#12977A", greenSoft: "#E1F7EF",
  mono: "'IBM Plex Mono', monospace",
};
const CLASS_COLORS = {
  VAP: { color: "#2B6CB0", bg: "#E6F0FB" }, CLABSI: { color: "#7C3AED", bg: "#F0E9FE" },
  CAUTI: { color: "#DD6B20", bg: "#FDECDC" }, SSI: { color: "#D53F8C", bg: "#FCE7F3" },
  PHLEBITIS: { color: "#E11D48", bg: "#FDE3E9" }, EXTRAVASATION: { color: "#0891B2", bg: "#DFF6FA" },
  FLUID: { color: "#64748B", bg: "#EAEEF4" }, OTHER: { color: "#64748B", bg: "#EAEEF4" },
};
const UNIT_COLORS = {
  SX: { solid: "#2563EB", grad: "linear-gradient(135deg, #1D4ED8, #38BDF8)" },
  NEURO: { solid: "#D97706", grad: "linear-gradient(135deg, #B45309, #FBBF24)" },
};
const ICONS = { plus: "＋", dash: "▦", form: "🗒", month: "📋", summary: "📊", trash: "🗑", lock: "🔒",
  login: "→", logout: "⎋", copy: "⧉", check: "✓", refresh: "↻", users: "👥", close: "✕", download: "⬇" };

const UNITS = [{ key: "SX", label: "ICU-Sx" }, { key: "NEURO", label: "ICU-Neuro" }];
const SPECIMENS = ["Sputum C/S", "H/C", "U/C", "CSF C/S", "Pus C/S", "Tip C/S", "อื่นๆ"];
const CLASS_TYPES = [
  { key: "VAP", label: "VAP", full: "ปอดอักเสบจากเครื่องช่วยหายใจ" },
  { key: "CLABSI", label: "CLABSI", full: "ติดเชื้อกระแสเลือดจากสาย CVC" },
  { key: "CAUTI", label: "CAUTI", full: "ติดเชื้อทางเดินปัสสาวะจากสายสวน" },
  { key: "SSI", label: "SSI", full: "แผลผ่าตัดติดเชื้อ" },
  { key: "OTHER", label: "อื่นๆ", full: "ยังไม่จัดประเภท / เฝ้าระวัง" },
];
const PREFIXES = { "นาย": "นาย", "นาง": "นาง", "นางสาว": "นส.", "เด็กชาย": "ด.ช.", "เด็กหญิง": "ด.ญ." };
const DEVICE_FIELDS = [{ key: "vent", label: "ใช้เครื่องช่วยหายใจ" }, { key: "foley", label: "คาสายสวนปัสสาวะ" }, { key: "cvc", label: "On CVC" }];

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const thisMonthISO = () => new Date().toISOString().slice(0, 7);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function maskFirstName(name) { if (!name) return ""; const keep = name.length <= 3 ? 1 : Math.ceil(name.length * 0.6); return name.slice(0, keep) + "***"; }
function maskLastName(name) { if (!name) return ""; const keep = Math.min(2, name.length); return name.slice(0, keep) + "**"; }
function buildMaskedName(prefix, first, last) {
  const p = PREFIXES[prefix] || prefix || "";
  const f = maskFirstName(first.trim()); const l = maskLastName(last.trim());
  return `${p}${f}${l ? " " + l : ""}`.trim();
}

function emptyDeviceRow() { return { count: "", days: "" }; }
function emptyMonthlyDevice(unit, month) {
  return { id: null, unit, month, patientDays: "", discharged: "",
    vent: { lt7: emptyDeviceRow(), gt7: emptyDeviceRow() },
    foley: { lt7: emptyDeviceRow(), gt7: emptyDeviceRow() },
    cvc: { lt7: emptyDeviceRow(), gt7: emptyDeviceRow() },
    fluid: emptyDeviceRow(), phlebitisCount: "", extravasationCount: "", recordedBy: "" };
}
function emptyCaseForm(unit) {
  return { id: null, unit, bed: "", prefix: "นางสาว", firstName: "", lastName: "", originalMaskedName: "",
    specimen: SPECIMENS[0], specimenOther: "", organism: "", resistance: "",
    classification: "VAP", date: todayISO(), note: "", reportedBy: "" };
}

function flattenDevice(f) {
  return {
    id: f.id || uid(), unit: f.unit, month: f.month,
    patientDays: num(f.patientDays), discharged: num(f.discharged),
    ventLt7Count: num(f.vent.lt7.count), ventLt7Days: num(f.vent.lt7.days),
    ventGt7Count: num(f.vent.gt7.count), ventGt7Days: num(f.vent.gt7.days),
    foleyLt7Count: num(f.foley.lt7.count), foleyLt7Days: num(f.foley.lt7.days),
    foleyGt7Count: num(f.foley.gt7.count), foleyGt7Days: num(f.foley.gt7.days),
    cvcLt7Count: num(f.cvc.lt7.count), cvcLt7Days: num(f.cvc.lt7.days),
    cvcGt7Count: num(f.cvc.gt7.count), cvcGt7Days: num(f.cvc.gt7.days),
    fluidCount: num(f.fluid.count), fluidDays: num(f.fluid.days),
    phlebitisCount: num(f.phlebitisCount), extravasationCount: num(f.extravasationCount),
    recordedBy: f.recordedBy || "",
  };
}
function unflattenDevice(row) {
  return { id: row.id, unit: row.unit, month: row.month,
    patientDays: row.patientDays, discharged: row.discharged,
    vent: { lt7: { count: row.ventLt7Count, days: row.ventLt7Days }, gt7: { count: row.ventGt7Count, days: row.ventGt7Days } },
    foley: { lt7: { count: row.foleyLt7Count, days: row.foleyLt7Days }, gt7: { count: row.foleyGt7Count, days: row.foleyGt7Days } },
    cvc: { lt7: { count: row.cvcLt7Count, days: row.cvcLt7Days }, gt7: { count: row.cvcGt7Count, days: row.cvcGt7Days } },
    fluid: { count: row.fluidCount, days: row.fluidDays },
    phlebitisCount: row.phlebitisCount, extravasationCount: row.extravasationCount, recordedBy: row.recordedBy };
}
const deviceTotalDays = (row) => num(row && row.lt7 && row.lt7.days) + num(row && row.gt7 && row.gt7.days);
const deviceTotalCount = (row) => num(row && row.lt7 && row.lt7.count) + num(row && row.gt7 && row.gt7.count);

async function apiGet() {
  const res = await fetch(`${APPS_SCRIPT_URL}?type=all`);
  return res.json();
}
async function apiPost(action, payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, payload }),
  });
  return res.json();
}

const inputStyle = { width: "100%", padding: "9px 10px", borderRadius: 9, border: `1px solid ${T.line}`, fontSize: 14, background: "#fff", color: T.ink };
function btnStyle(kind) {
  const base = { flex: 1, padding: "11px 14px", borderRadius: 10, fontSize: 14.5, fontWeight: 600, border: "none", cursor: "pointer" };
  if (kind === "primary") return { ...base, background: T.primary, color: "#fff" };
  if (kind === "danger") return { ...base, background: T.amber, color: "#fff" };
  return { ...base, background: T.surface, color: T.inkSoft, border: `1px solid ${T.line}` };
}
function Card(props) {
  return h("div", { style: { background: T.surface, borderRadius: 14, padding: 14, border: `1px solid ${T.line}` } },
    h("div", { style: { fontSize: 12.5, fontWeight: 700, color: T.primaryDark, marginBottom: 10, textTransform: "uppercase" } }, props.title),
    props.children);
}
function EmptyState(props) { return h("div", { style: { textAlign: "center", padding: 20, color: T.inkSoft, fontSize: 13 } }, props.text); }
function Row2(props) { return h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 } }, props.children); }
function Field(props) {
  return h("label", { style: { display: "block" } },
    h("div", { style: { fontSize: 12, color: T.inkSoft, marginBottom: 4 } },
      props.label, props.required ? h("span", { style: { color: T.amber } }, " *") : null),
    props.children);
}
function MonthPicker(props) {
  return h("input", { type: "month", value: props.month, onChange: (e) => props.setMonth(e.target.value), style: { ...inputStyle, width: "auto" } });
}

function MiniBarChart(props) {
  const data = props.data;
  const max = Math.max(1, ...data.map((d) => d.count));
  return h("div", { style: { display: "flex", alignItems: "flex-end", gap: 10, height: 140, padding: "0 4px" } },
    data.map((d) => h("div", { key: d.key, style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 } },
      h("div", { style: { fontSize: 11, fontWeight: 700, color: CLASS_COLORS[d.key] && CLASS_COLORS[d.key].color } }, d.count),
      h("div", { style: { width: "70%", height: `${Math.max(4, (d.count / max) * 100)}px`, background: (CLASS_COLORS[d.key] && CLASS_COLORS[d.key].color) || T.primary, borderRadius: "6px 6px 0 0" } }),
      h("div", { style: { fontSize: 10.5, color: T.inkSoft } }, d.name)
    ))
  );
}

function NavBtn(props) {
  const { active, onClick, icon, label, primary } = props;
  return h("button", { onClick, style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: active ? T.primary : T.inkSoft, padding: "4px 8px" } },
    h("div", { style: { width: 38, height: 38, borderRadius: primary ? 12 : "50%", background: primary ? "linear-gradient(135deg, #0EA5A0, #38BDF8)" : (active ? T.greenSoft : "transparent"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: primary ? "#fff" : "inherit" } }, icon),
    h("span", { style: { fontSize: 10, fontWeight: active ? 600 : 500 } }, label)
  );
}

function LoginModal(props) {
  const [pin, setPin] = useState(""); const [err, setErr] = useState(false);
  const submit = (e) => { e.preventDefault(); if (pin === IC_TEAM_PASSWORD) props.onSuccess(); else { setErr(true); setTimeout(() => setErr(false), 1600); } };
  return h("div", { style: { position: "fixed", inset: 0, background: "rgba(19,42,40,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 70 } },
    h("form", { onSubmit: submit, style: { background: "#fff", borderRadius: 14, padding: 20, maxWidth: 320, width: "100%" } },
      h("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 12 } },
        h("div", { style: { fontWeight: 700 } }, `${ICONS.users} เข้าสู่ระบบทีม IC`),
        h("button", { type: "button", onClick: props.onClose, style: { background: "none", border: "none", cursor: "pointer" } }, ICONS.close)
      ),
      h("input", { autoFocus: true, type: "password", value: pin, onChange: (e) => setPin(e.target.value), placeholder: "รหัสผ่านทีม IC", style: inputStyle }),
      err ? h("div", { style: { color: T.amber, fontSize: 12, marginTop: 6 } }, "รหัสผ่านไม่ถูกต้อง") : null,
      h("button", { type: "submit", style: { ...btnStyle("primary"), width: "100%", marginTop: 14 } }, `${ICONS.login} เข้าสู่ระบบ`)
    )
  );
}
function LoginPrompt(props) {
  return h(Card, { title: "IC ประจำเดือน" },
    h("div", { style: { textAlign: "center", padding: 24 } },
      h("div", { style: { fontSize: 13.5, color: T.inkSoft, marginBottom: 14 } }, "ต้องเข้าสู่ระบบทีม IC ก่อนคีย์ข้อมูล device-days ประจำเดือน"),
      h("button", { onClick: props.onLogin, style: btnStyle("primary") }, `${ICONS.login} เข้าสู่ระบบทีม IC`)
    )
  );
}

function Dashboard(props) {
  const { unit, month, setMonth, list, byClassThisMonth, onRefresh, onEdit, onDelete } = props;
  const sorted = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return h("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
      h(MonthPicker, { month, setMonth }),
      h("button", { onClick: onRefresh, style: { display: "flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${T.line}`, borderRadius: 8, padding: "6px 10px", fontSize: 12, color: T.primary, cursor: "pointer" } }, `${ICONS.refresh} รีเฟรช`)
    ),
    h(Card, { title: `สรุปเชื้อประจำเดือน — ${(UNITS.find(u => u.key === unit) || {}).label}` }, h(MiniBarChart, { data: byClassThisMonth })),
    h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
      CLASS_TYPES.map((t) => h("span", { key: t.key, style: { fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 999, background: CLASS_COLORS[t.key].bg, color: CLASS_COLORS[t.key].color } }, t.label))
    ),
    h(Card, { title: "กระดาน IC — รายงานเดือนนี้" },
      sorted.length === 0 ? h(EmptyState, { text: "ยังไม่มีรายงานในเดือนนี้" }) :
      h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
        sorted.map((r) => h("div", { key: r.id, style: { borderBottom: `1px solid ${T.line}`, paddingBottom: 10, borderLeft: `4px solid ${(CLASS_COLORS[r.classification] && CLASS_COLORS[r.classification].color) || T.primary}`, paddingLeft: 10 } },
          h("div", { style: { display: "flex", justifyContent: "space-between" } },
            h("div", null,
              h("div", { style: { fontWeight: 700, fontSize: 13.5 } }, `เตียง ${r.bed} · ${r.maskedName}`),
              h("div", { style: { fontSize: 11.5, color: T.inkSoft, fontFamily: T.mono, marginTop: 2 } },
                `${r.specimen === "อื่นๆ" && r.specimenOther ? r.specimenOther : r.specimen} : ${r.organism} ${r.resistance ? "(" + r.resistance + ")" : ""} · เก็บสิ่งส่งตรวจ ${r.date}`),
              h("div", { style: { fontSize: 10.5, color: T.inkSoft, marginTop: 2 } }, `บันทึกเข้าระบบ: ${r.createdAt ? new Date(r.createdAt).toLocaleDateString("th-TH") : "-"}`),
              r.reportedBy ? h("div", { style: { fontSize: 10.5, color: T.inkSoft, marginTop: 2 } }, `ผู้ลงข้อมูล: ${r.reportedBy}`) : null
            ),
            h("button", { onClick: () => onDelete(r.id), style: { background: "none", border: "none", cursor: "pointer" } }, ICONS.trash)
          ),
          h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 6 } },
            h("span", { style: { fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: CLASS_COLORS[r.classification] && CLASS_COLORS[r.classification].bg, color: CLASS_COLORS[r.classification] && CLASS_COLORS[r.classification].color } }, r.classification),
            h("button", { onClick: () => onEdit(r), style: { fontSize: 12, color: T.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 600 } }, "แก้ไข")
          )
        ))
      )
    )
  );
}

function CaseFormView(props) {
  const { form, setForm, onSubmit, onCancel } = props;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const nameUnchanged = form.id && form.firstName === form.originalMaskedName && !form.lastName.trim();
  const preview = nameUnchanged ? form.originalMaskedName : buildMaskedName(form.prefix, form.firstName, form.lastName);
  return h("form", { onSubmit, style: { display: "flex", flexDirection: "column", gap: 14 } },
    h(Card, { title: form.id ? "แก้ไขรายงานเคส" : "รายงานผู้ป่วยติดเชื้อ" },
      h("div", { style: { display: "flex", flexDirection: "column", gap: 12 } },
        h(Row2, null,
          h(Field, { label: "วอร์ด" }, h("select", { value: form.unit, onChange: (e) => set("unit", e.target.value), style: inputStyle }, UNITS.map((u) => h("option", { key: u.key, value: u.key }, u.label)))),
          h(Field, { label: "เตียง", required: true }, h("input", { value: form.bed, onChange: (e) => set("bed", e.target.value), style: inputStyle, placeholder: "เช่น 7" }))
        ),
        h("div", { style: { background: T.greenSoft, borderRadius: 10, padding: 10, fontSize: 12.5, color: T.inkSoft } }, "ระบบจะปกปิดชื่อผู้ป่วยอัตโนมัติ — จะบันทึกเฉพาะชื่อที่ปิดบังแล้วเท่านั้น"),
        h(Row2, null,
          h(Field, { label: "คำนำหน้า" }, h("select", { value: form.prefix, onChange: (e) => set("prefix", e.target.value), style: inputStyle }, Object.keys(PREFIXES).map((p) => h("option", { key: p, value: p }, p)))),
          h(Field, { label: "ชื่อ", required: true }, h("input", { value: form.firstName, onChange: (e) => set("firstName", e.target.value), style: inputStyle, placeholder: "ชื่อจริง" }))
        ),
        h(Field, { label: "นามสกุล" }, h("input", { value: form.lastName, onChange: (e) => set("lastName", e.target.value), style: inputStyle, placeholder: "นามสกุล" })),
        h("div", { style: { fontSize: 13, fontFamily: T.mono, color: T.primaryDark, background: T.goldSoft, borderRadius: 8, padding: "8px 10px" } }, `ตัวอย่างที่จะบันทึก: ${preview || "—"}`),
        h(Field, { label: "ประเภทสิ่งส่งตรวจ" }, h("select", { value: form.specimen, onChange: (e) => set("specimen", e.target.value), style: inputStyle }, SPECIMENS.map((s) => h("option", { key: s, value: s }, s)))),
        form.specimen === "อื่นๆ" ? h(Field, { label: "ระบุประเภทสิ่งส่งตรวจ" }, h("input", { value: form.specimenOther, onChange: (e) => set("specimenOther", e.target.value), style: inputStyle, placeholder: "ระบุ เช่น Tissue C/S" })) : null,
        h(Field, { label: "เชื้อที่พบ" }, h("input", { value: form.organism, onChange: (e) => set("organism", e.target.value), style: inputStyle, placeholder: "เช่น Klebsiella pneumoniae" })),
        h(Field, { label: "ผลดื้อยา (ถ้ามี)" }, h("input", { value: form.resistance, onChange: (e) => set("resistance", e.target.value), style: inputStyle, placeholder: "เช่น CRAB, MDR, CRE" })),
        h(Row2, null,
          h(Field, { label: "วันที่เก็บสิ่งส่งตรวจ" }, h("input", { type: "date", value: form.date, onChange: (e) => set("date", e.target.value), style: inputStyle })),
          h(Field, { label: "จัดประเภท HAI" }, h("select", { value: form.classification, onChange: (e) => set("classification", e.target.value), style: inputStyle }, CLASS_TYPES.map((c) => h("option", { key: c.key, value: c.key }, `${c.label} — ${c.full}`))))
        ),
        h(Field, { label: "ชื่อผู้ลงข้อมูล" }, h("input", { value: form.reportedBy, onChange: (e) => set("reportedBy", e.target.value), style: inputStyle, placeholder: "ชื่อ-สกุล ผู้บันทึก" })),
        h(Field, { label: "หมายเหตุ" }, h("textarea", { value: form.note, onChange: (e) => set("note", e.target.value), style: { ...inputStyle, minHeight: 60, resize: "vertical" } }))
      )
    ),
    h("div", { style: { display: "flex", gap: 8 } },
      h("button", { type: "button", onClick: onCancel, style: btnStyle("ghost") }, "ยกเลิก"),
      h("button", { type: "submit", style: btnStyle("primary") }, form.id ? "บันทึกการแก้ไข" : "บันทึกรายงาน")
    )
  );
}

function DeviceRowInputs(props) {
  const { label, value, onChange } = props;
  return h("div", { style: { marginBottom: 10 } },
    h("div", { style: { fontSize: 12.5, fontWeight: 600, marginBottom: 6 } }, label),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
      h("div", { style: { background: T.bg, borderRadius: 8, padding: 8 } },
        h("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 4 } }, "< 7 วัน — จำนวนคน / วัน"),
        h("div", { style: { display: "flex", gap: 6 } },
          h("input", { type: "number", min: "0", value: value.lt7.count, onChange: (e) => onChange({ ...value, lt7: { ...value.lt7, count: e.target.value } }), style: { ...inputStyle, padding: "6px 8px" }, placeholder: "คน" }),
          h("input", { type: "number", min: "0", value: value.lt7.days, onChange: (e) => onChange({ ...value, lt7: { ...value.lt7, days: e.target.value } }), style: { ...inputStyle, padding: "6px 8px" }, placeholder: "วัน" })
        )
      ),
      h("div", { style: { background: T.bg, borderRadius: 8, padding: 8 } },
        h("div", { style: { fontSize: 10.5, color: T.inkSoft, marginBottom: 4 } }, "> 7 วัน — จำนวนคน / วัน"),
        h("div", { style: { display: "flex", gap: 6 } },
          h("input", { type: "number", min: "0", value: value.gt7.count, onChange: (e) => onChange({ ...value, gt7: { ...value.gt7, count: e.target.value } }), style: { ...inputStyle, padding: "6px 8px" }, placeholder: "คน" }),
          h("input", { type: "number", min: "0", value: value.gt7.days, onChange: (e) => onChange({ ...value, gt7: { ...value.gt7, days: e.target.value } }), style: { ...inputStyle, padding: "6px 8px" }, placeholder: "วัน" })
        )
      )
    )
  );
}

function DeviceFormView(props) {
  const { unit, setUnit, month, setMonth, form, setForm, onSubmit } = props;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return h("form", { onSubmit, style: { display: "flex", flexDirection: "column", gap: 14 } },
    h(Card, { title: "IC ประจำเดือน — คีย์ข้อมูล device-days" },
      h(Row2, null,
        h(Field, { label: "วอร์ด" }, h("select", { value: unit, onChange: (e) => { setUnit(e.target.value); set("unit", e.target.value); }, style: inputStyle }, UNITS.map((u) => h("option", { key: u.key, value: u.key }, u.label)))),
        h(Field, { label: "เดือน" }, h("input", { type: "month", value: month, onChange: (e) => { setMonth(e.target.value); set("month", e.target.value); }, style: inputStyle }))
      ),
      h("div", { style: { marginTop: 12 } },
        h(Row2, null,
          h(Field, { label: "วันนอน (patient-days)" }, h("input", { type: "number", min: "0", value: form.patientDays, onChange: (e) => set("patientDays", e.target.value), style: inputStyle })),
          h(Field, { label: "จำหน่าย (คน)" }, h("input", { type: "number", min: "0", value: form.discharged, onChange: (e) => set("discharged", e.target.value), style: inputStyle }))
        )
      ),
      h("div", { style: { marginTop: 14 } },
        DEVICE_FIELDS.map((f) => h(DeviceRowInputs, { key: f.key, label: f.label, value: form[f.key], onChange: (v) => set(f.key, v) })),
        h("div", { style: { marginBottom: 10 } },
          h("div", { style: { fontSize: 12.5, fontWeight: 600, marginBottom: 6 } }, "ได้รับสารน้ำ"),
          h("div", { style: { display: "flex", gap: 6 } },
            h("input", { type: "number", min: "0", value: form.fluid.count, onChange: (e) => set("fluid", { ...form.fluid, count: e.target.value }), style: inputStyle, placeholder: "คน" }),
            h("input", { type: "number", min: "0", value: form.fluid.days, onChange: (e) => set("fluid", { ...form.fluid, days: e.target.value }), style: inputStyle, placeholder: "วัน" })
          )
        ),
        h("div", { style: { background: T.goldSoft, borderRadius: 10, padding: 10, marginTop: 4 } },
          h(Row2, null,
            h(Field, { label: "Phlebitis (ราย)" }, h("input", { type: "number", min: "0", value: form.phlebitisCount, onChange: (e) => set("phlebitisCount", e.target.value), style: inputStyle })),
            h(Field, { label: "Extravasation (ราย)" }, h("input", { type: "number", min: "0", value: form.extravasationCount, onChange: (e) => set("extravasationCount", e.target.value), style: inputStyle }))
          )
        )
      ),
      h("div", { style: { marginTop: 12 } }, h(Field, { label: "ชื่อผู้บันทึกข้อมูล" }, h("input", { value: form.recordedBy, onChange: (e) => set("recordedBy", e.target.value), style: inputStyle, placeholder: "ชื่อ-สกุล ทีม IC" })))
    ),
    h("button", { type: "submit", style: btnStyle("primary") }, "บันทึกข้อมูลเดือนนี้")
  );
}

function SummaryRow(props) {
  const { label, classKey, count, countUnit, days, personCount, rate } = props;
  const c = CLASS_COLORS[classKey] || { color: T.primaryDark, bg: T.greenSoft };
  return h("div", { style: { display: "grid", gridTemplateColumns: "1.3fr 0.9fr 1.1fr 0.9fr", gap: 6, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.line}`, fontSize: 12.5 } },
    h("div", { style: { fontWeight: 700, color: c.color } }, label),
    h("div", { style: { fontFamily: T.mono, textAlign: "right" } }, `${count} ${countUnit || "ราย"}`),
    h("div", { style: { fontFamily: T.mono, textAlign: "right", color: T.inkSoft } }, days == null ? "—" : `${days} วัน${personCount != null ? ` / ${personCount} คน` : ""}`),
    h("div", { style: { fontFamily: T.mono, textAlign: "right", fontWeight: 700, background: rate == null ? "transparent" : c.bg, color: rate == null ? T.inkSoft : c.color, borderRadius: 6, padding: "2px 6px" } }, rate == null ? "—" : `${rate.toFixed(2)}‰`)
  );
}

function SummaryView(props) {
  const { unit, setUnit, month, setMonth, summaryFor } = props;
  const [copied, setCopied] = useState(false);
  const s = summaryFor(unit, month);
  const unitLabel = (UNITS.find((u) => u.key === unit) || {}).label || unit;
  const fmtRate = (r) => (r == null ? "ไม่สามารถคำนวณได้ (ยังไม่มีข้อมูล device-days)" : `${r.toFixed(2)} ครั้ง/1,000 device-days`);
  const summaryText = [
    `รายงานสรุป IC ประจำเดือน ${month} — ${unitLabel}`, ``,
    `[ข้อมูลพื้นฐาน]`, `วันนอนรวม: ${s.patientDays} วัน`, `จำหน่าย: ${s.discharged} คน`, ``,
    `[การติดเชื้อที่สัมพันธ์กับอุปกรณ์]`,
    `VAP: ${s.vapCount} ราย (ใช้เครื่องช่วยหายใจ ${s.ventDays} วัน / ${s.ventCount} คน) — อัตรา ${fmtRate(s.vapRate)}`,
    `CLABSI: ${s.clabsiCount} ราย (On CVC ${s.cvcDays} วัน / ${s.cvcCount} คน) — อัตรา ${fmtRate(s.clabsiRate)}`,
    `CAUTI: ${s.cautiCount} ราย (คาสายสวนปัสสาวะ ${s.foleyDays} วัน / ${s.foleyCount} คน) — อัตรา ${fmtRate(s.cautiRate)}`, ``,
    `[ภาวะแทรกซ้อนจากสารน้ำ/IV]`, `ได้รับสารน้ำ: ${s.fluidDays} วัน / ${s.fluidCount} คน`,
    `Phlebitis: ${s.phlebitisCount} ราย`, `Extravasation: ${s.extravasationCount} ราย`,
  ].join("\n");
  const copy = async () => { try { await navigator.clipboard.writeText(summaryText); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch (e) {} };
  return h("div", { style: { display: "flex", flexDirection: "column", gap: 14 } },
    h("div", { className: "print-title", style: { marginBottom: 4 } },
      h("div", { style: { fontSize: 18, fontWeight: 700 } }, `รายงาน IC ประจำเดือน — ${unitLabel}`),
      h("div", { style: { fontSize: 12, color: T.inkSoft } }, `เดือน ${month} · พิมพ์เมื่อ ${new Date().toLocaleDateString("th-TH")}`),
      h("div", { style: { height: 1, background: T.line, margin: "10px 0" } })
    ),
    h("div", { className: "no-print" }, h(Row2, null,
      h("select", { value: unit, onChange: (e) => setUnit(e.target.value), style: inputStyle }, UNITS.map((u) => h("option", { key: u.key, value: u.key }, u.label))),
      h("input", { type: "month", value: month, onChange: (e) => setMonth(e.target.value), style: inputStyle })
    )),
    h(Card, { title: `สรุปรายเดือน — ${unitLabel}` },
      h("div", { style: { fontSize: 11.5, color: T.inkSoft, marginBottom: 4 } }, `วันนอนรวม ${s.patientDays} วัน · จำหน่าย ${s.discharged} คน`),
      h("div", { style: { display: "grid", gridTemplateColumns: "1.3fr 0.9fr 1.1fr 0.9fr", gap: 6, fontSize: 10.5, color: T.inkSoft, padding: "4px 0", borderBottom: `1px solid ${T.line}` } },
        h("div", null, "รายการ"), h("div", { style: { textAlign: "right" } }, "เคส"), h("div", { style: { textAlign: "right" } }, "device-days"), h("div", { style: { textAlign: "right" } }, "อัตรา/1000วัน")
      ),
      h(SummaryRow, { classKey: "VAP", label: "VAP", count: s.vapCount, days: s.ventDays, personCount: s.ventCount, rate: s.vapRate }),
      h(SummaryRow, { classKey: "CLABSI", label: "CLABSI", count: s.clabsiCount, days: s.cvcDays, personCount: s.cvcCount, rate: s.clabsiRate }),
      h(SummaryRow, { classKey: "CAUTI", label: "CAUTI", count: s.cautiCount, days: s.foleyDays, personCount: s.foleyCount, rate: s.cautiRate }),
      h(SummaryRow, { classKey: "FLUID", label: "สารน้ำ", count: s.fluidCount, countUnit: "คน", days: s.fluidDays, personCount: null, rate: null }),
      h(SummaryRow, { classKey: "PHLEBITIS", label: "Phlebitis", count: s.phlebitisCount, days: null, personCount: null, rate: null }),
      h(SummaryRow, { classKey: "EXTRAVASATION", label: "Extravasation", count: s.extravasationCount, days: null, personCount: null, rate: null })
    ),
    h(Card, { title: "สรุปแบบอ่านง่าย (แยกเป็นส่วนๆ)" },
      h("pre", { style: { whiteSpace: "pre-wrap", fontFamily: "'Sarabun', sans-serif", fontSize: 12.5, background: T.bg, borderRadius: 10, padding: 12, margin: 0, lineHeight: 1.6 } }, summaryText),
      h("div", { className: "no-print", style: { display: "flex", gap: 8, marginTop: 10 } },
        h("button", { onClick: copy, style: btnStyle(copied ? "primary" : "ghost") }, `${copied ? ICONS.check : ICONS.copy} ${copied ? "คัดลอกแล้ว" : "คัดลอกข้อความ"}`),
        h("button", { onClick: () => window.print(), style: btnStyle("primary") }, `${ICONS.download} ส่งออกเป็น PDF`)
      )
    )
  );
}

function App() {
  const [tab, setTab] = useState("dashboard");
  const [unit, setUnit] = useState("SX");
  const [cases, setCases] = useState([]);
  const [deviceData, setDeviceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [icMode, setIcMode] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [month, setMonth] = useState(thisMonthISO());
  const [caseForm, setCaseForm] = useState(emptyCaseForm("SX"));
  const [deviceForm, setDeviceForm] = useState(emptyMonthlyDevice("SX", thisMonthISO()));

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };
  const configured = APPS_SCRIPT_URL && !APPS_SCRIPT_URL.includes("PASTE_YOUR");

  const loadAll = useCallback(async () => {
    if (!configured) { setLoading(false); return; }
    try {
      const data = await apiGet();
      if (!data.ok) throw new Error(data.error || "load failed");
      setCases(data.cases || []);
      setDeviceData((data.device || []).map(unflattenDevice));
      setError(null);
    } catch (e) { setError("โหลดข้อมูลไม่สำเร็จ ตรวจสอบ APPS_SCRIPT_URL และการเชื่อมต่อ"); }
    finally { setLoading(false); }
  }, [configured]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { if (tab !== "dashboard") return; const t = setInterval(loadAll, 20000); return () => clearInterval(t); }, [tab, loadAll]);

  const submitCase = async (e) => {
    e.preventDefault();
    if (!caseForm.bed.trim() || !caseForm.firstName.trim()) { showToast("กรุณากรอกเตียงและชื่อผู้ป่วย"); return; }
    const nameUnchanged = caseForm.id && caseForm.firstName === caseForm.originalMaskedName && !caseForm.lastName.trim();
    const maskedName = nameUnchanged ? caseForm.originalMaskedName : buildMaskedName(caseForm.prefix, caseForm.firstName, caseForm.lastName);
    const record = {
      id: caseForm.id || uid(), unit: caseForm.unit, bed: caseForm.bed, maskedName,
      specimen: caseForm.specimen, specimenOther: caseForm.specimen === "อื่นๆ" ? caseForm.specimenOther : "",
      organism: caseForm.organism, resistance: caseForm.resistance,
      classification: caseForm.classification, date: caseForm.date, note: caseForm.note,
      reportedBy: caseForm.reportedBy, createdAt: caseForm.id ? caseForm.createdAt : new Date().toISOString(),
    };
    try {
      const res = await apiPost(caseForm.id ? "updateCase" : "addCase", record);
      if (!res.ok) { showToast("บันทึกไม่สำเร็จ: " + (res.error || "ไม่ทราบสาเหตุ")); return; }
      showToast(caseForm.id ? "แก้ไขรายงานแล้ว" : "บันทึกรายงานแล้ว");
      setCaseForm(emptyCaseForm(unit)); setTab("dashboard"); loadAll();
    } catch (err) {
      showToast("เชื่อมต่อไม่สำเร็จ: " + err.message);
    }
  };

  const editCase = (r) => {
    setCaseForm({ id: r.id, unit: r.unit, bed: r.bed, prefix: "", firstName: r.maskedName, lastName: "", originalMaskedName: r.maskedName, createdAt: r.createdAt,
      specimen: r.specimen, specimenOther: r.specimenOther || "", organism: r.organism, resistance: r.resistance || "",
      classification: r.classification, date: r.date, note: r.note || "", reportedBy: r.reportedBy || "" });
    setTab("case-form");
  };
  const deleteCase = async (id) => {
    const res = await apiPost("deleteCase", { id });
    setConfirmDelete(null);
    if (res.ok) { showToast("ลบรายการแล้ว"); loadAll(); } else showToast("ลบไม่สำเร็จ");
  };

  const submitDevice = async (e) => {
    e.preventDefault();
    const res = await apiPost("upsertDevice", flattenDevice(deviceForm));
    if (res.ok) { showToast("บันทึกข้อมูล IC ประจำเดือนแล้ว"); loadAll(); } else showToast("บันทึกไม่สำเร็จ");
  };

  useEffect(() => {
    const found = deviceData.find((d) => d.unit === unit && d.month === month);
    setDeviceForm(found ? JSON.parse(JSON.stringify(found)) : emptyMonthlyDevice(unit, month));
  }, [unit, month, deviceData.length]);

  const monthCases = (u, m) => cases.filter((c) => c.unit === u && c.createdAt && String(c.createdAt).slice(0, 7) === m);
  const currentUnitCases = monthCases(unit, month);
  const classCount = (u, m, key) => monthCases(u, m).filter((c) => c.classification === key).length;

  const byClassThisMonth = useMemo(() =>
    CLASS_TYPES.map((t) => ({ name: t.label, key: t.key, count: currentUnitCases.filter((c) => c.classification === t.key).length })),
    [currentUnitCases]);

  const summaryFor = (u, m) => {
    const d = deviceData.find((x) => x.unit === u && x.month === m) || emptyMonthlyDevice(u, m);
    const rate = (count, days) => (days > 0 ? (count / days) * 1000 : null);
    const vapCount = classCount(u, m, "VAP"), clabsiCount = classCount(u, m, "CLABSI"), cautiCount = classCount(u, m, "CAUTI");
    const ventDays = deviceTotalDays(d.vent), ventCount = deviceTotalCount(d.vent);
    const cvcDays = deviceTotalDays(d.cvc), cvcCount = deviceTotalCount(d.cvc);
    const foleyDays = deviceTotalDays(d.foley), foleyCount = deviceTotalCount(d.foley);
    const fluidDays = num(d.fluid.days), fluidCount = num(d.fluid.count);
    return { unit: u, month: m, patientDays: num(d.patientDays), discharged: num(d.discharged),
      vapCount, ventDays, ventCount, vapRate: rate(vapCount, ventDays),
      clabsiCount, cvcDays, cvcCount, clabsiRate: rate(clabsiCount, cvcDays),
      cautiCount, foleyDays, foleyCount, cautiRate: rate(cautiCount, foleyDays),
      fluidCount, fluidDays, phlebitisCount: num(d.phlebitisCount), extravasationCount: num(d.extravasationCount) };
  };

  return h("div", { style: { fontFamily: "'Sarabun', sans-serif", background: T.bg, minHeight: "100vh", color: T.ink, paddingBottom: 88 } },
    h("header", { className: "no-print", style: { background: UNIT_COLORS[unit] && UNIT_COLORS[unit].grad, color: "#fff", padding: "18px 16px 14px" } },
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
        h("div", null,
          h("div", { style: { fontSize: 16, fontWeight: 700 } }, "IC Surveillance"),
          h("div", { style: { fontSize: 11.5, opacity: 0.85 } }, "ICU Trauma — ระบบเฝ้าระวังการติดเชื้อ")
        ),
        h("button", { onClick: () => icMode ? setIcMode(false) : setShowLogin(true), style: { display: "flex", alignItems: "center", gap: 5, background: icMode ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 999, padding: "6px 11px", fontSize: 11.5, cursor: "pointer" } },
          `${icMode ? ICONS.logout : ICONS.lock} ${icMode ? "ทีม IC" : "เข้าสู่ระบบทีม IC"}`)
      ),
      h("div", { style: { display: "flex", gap: 6, marginTop: 14 } },
        UNITS.map((u) => h("button", { key: u.key, onClick: () => setUnit(u.key), style: { flex: 1, padding: "8px 6px", borderRadius: 10, border: "none", cursor: "pointer", background: unit === u.key ? "#fff" : "rgba(255,255,255,0.18)", color: unit === u.key ? UNIT_COLORS[u.key].solid : "#fff", fontWeight: 700, fontSize: 12.5 } }, u.label))
      )
    ),
    h("main", { style: { padding: 14, maxWidth: 640, margin: "0 auto" } },
      !configured ? h("div", { style: { background: T.amberSoft, color: T.amber, padding: 12, borderRadius: 10, marginBottom: 12, fontSize: 13 } }, "ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL ในไฟล์ index.html — แก้ค่าคงที่ที่ด้านบนของสคริปต์ก่อนใช้งาน") : null,
      error ? h("div", { style: { background: T.amberSoft, color: T.amber, padding: 12, borderRadius: 10, marginBottom: 12, fontSize: 13 } }, error) : null,
      loading ? h("div", { style: { textAlign: "center", padding: 40, color: T.inkSoft } }, "กำลังโหลดข้อมูล...") :
      tab === "dashboard" ? h(Dashboard, { unit, month, setMonth, list: currentUnitCases, byClassThisMonth, onRefresh: loadAll, onEdit: editCase, onDelete: setConfirmDelete }) :
      tab === "case-form" ? h(CaseFormView, { form: caseForm, setForm: setCaseForm, onSubmit: submitCase, onCancel: () => { setCaseForm(emptyCaseForm(unit)); setTab("dashboard"); } }) :
      tab === "device-form" ? (icMode ? h(DeviceFormView, { unit, setUnit, month, setMonth, form: deviceForm, setForm: setDeviceForm, onSubmit: submitDevice }) : h(LoginPrompt, { onLogin: () => setShowLogin(true) })) :
      h(SummaryView, { unit, setUnit, month, setMonth, summaryFor })
    ),
    h("nav", { className: "no-print", style: { position: "fixed", bottom: 0, left: 0, right: 0, background: T.surface, borderTop: `1px solid ${T.line}`, display: "flex", justifyContent: "space-around", padding: "8px 0 10px" } },
      h(NavBtn, { active: tab === "dashboard", onClick: () => setTab("dashboard"), icon: ICONS.dash, label: "ภาพรวม" }),
      h(NavBtn, { active: tab === "case-form", onClick: () => { setCaseForm(emptyCaseForm(unit)); setTab("case-form"); }, icon: ICONS.plus, label: "รายงานเคส", primary: true }),
      h(NavBtn, { active: tab === "device-form", onClick: () => setTab("device-form"), icon: ICONS.month, label: "IC ประจำเดือน" }),
      h(NavBtn, { active: tab === "summary", onClick: () => setTab("summary"), icon: ICONS.summary, label: "สรุป" })
    ),
    toast ? h("div", { style: { position: "fixed", bottom: 78, left: "50%", transform: "translateX(-50%)", background: T.primaryDark, color: "#fff", padding: "9px 18px", borderRadius: 999, fontSize: 13.5, zIndex: 50 } }, toast) : null,
    showLogin ? h(LoginModal, { onClose: () => setShowLogin(false), onSuccess: () => { setIcMode(true); setShowLogin(false); showToast("เข้าสู่ระบบทีม IC แล้ว"); } }) : null,
    confirmDelete ? h("div", { style: { position: "fixed", inset: 0, background: "rgba(19,42,40,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 60 } },
      h("div", { style: { background: "#fff", borderRadius: 14, padding: 20, maxWidth: 320, width: "100%" } },
        h("div", { style: { fontWeight: 700, marginBottom: 6 } }, "ลบรายการนี้?"),
        h("div", { style: { fontSize: 13.5, color: T.inkSoft, marginBottom: 16 } }, "ข้อมูลจะถูกลบถาวรและไม่สามารถกู้คืนได้"),
        h("div", { style: { display: "flex", gap: 8 } },
          h("button", { onClick: () => setConfirmDelete(null), style: btnStyle("ghost") }, "ยกเลิก"),
          h("button", { onClick: () => deleteCase(confirmDelete), style: btnStyle("danger") }, "ลบ")
        )
      )
    ) : null
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(h(App));
</script>
</body>
</html>
