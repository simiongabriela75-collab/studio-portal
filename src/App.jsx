import { useState, useEffect, useRef } from "react";
import {
  subscribeProjects,
  subscribeProject,
  saveProject,
  patchProject,
  createProject,
  deleteProject,
  uploadToCloudinary,
} from "./firebase.js";

// ─── URL Router ──────────────────────────────────────────────────────────────
// /                    → designer dashboard
// /project/:id         → client view (shareable link)
function getRoute() {
  const path = window.location.pathname;
  const m = path.match(/^\/project\/([^/]+)/);
  if (m) return { view: "client", projectId: m[1] };
  return { view: "designer" };
}

// ─── Utilities ───────────────────────────────────────────────────────────────
function uid() { return "id_" + Math.random().toString(36).slice(2, 10); }
function nowStr() {
  return new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
}
function today() {
  return new Date().toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" });
}

const STATUS_STAGE  = {
  done:    { label: "Готово",      color: "#FD6F05", bg: "rgba(253,111,5,0.12)" },
  active:  { label: "В работе",   color: "#FD6F05", bg: "rgba(253,111,5,0.06)" },
  pending: { label: "Ожидает",    color: "#888",    bg: "rgba(255,255,255,0.05)" },
};
const STATUS_RENDER = {
  approved: { label: "Одобрен",      color: "#FD6F05", bg: "rgba(253,111,5,0.12)" },
  revision: { label: "Правки",       color: "#ff6b6b", bg: "rgba(255,107,107,0.12)" },
  pending:  { label: "На проверке",  color: "#aaa",    bg: "rgba(255,255,255,0.07)" },
};

// ─── KAI Brand Palette ────────────────────────────────────────────────────────
const G = {
  // Brand
  orange: "#FD6F05", orangeDark: "#ED5707", orangeLight: "rgba(253,111,5,0.15)",
  // Darks
  dark:  "#1F1F1F", dark2: "#2A2A2A", dark3: "#333333",
  // Text
  text: "#FFFFFF", textMid: "rgba(255,255,255,0.7)", textLight: "rgba(255,255,255,0.4)",
  // Borders
  border: "rgba(255,255,255,0.08)", borderMid: "rgba(255,255,255,0.15)",
  // Danger
  red: "#ff6b6b", redLight: "rgba(255,107,107,0.12)",
  // Legacy aliases used in components
  teal: "#FD6F05", tealDark: "#ED5707", tealLight: "rgba(253,111,5,0.15)",
  blue: "#FD6F05", blueLight: "rgba(253,111,5,0.1)",
  sand: "#1F1F1F", sandDark: "#2A2A2A",
  white: "#FFFFFF",
};

const css = {
  app: {
    fontFamily: "'Futura PT','DM Sans','Helvetica Neue',sans-serif",
    background: G.dark,
    minHeight: "100vh",
    color: G.text,
  },
  topbar: {
    background: "rgba(31,31,31,0.95)",
    backdropFilter: "blur(12px)",
    borderBottom: `1px solid ${G.border}`,
    padding: "0 2rem",
    height: 60,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    position: "sticky", top: 0, zIndex: 100,
  },
  logo: {
    fontFamily: "'Futura PT','DM Sans',sans-serif",
    fontSize: 20, fontWeight: 700,
    color: G.text, letterSpacing: "0.08em", textTransform: "uppercase",
  },
  page: { maxWidth: 820, margin: "0 auto", padding: "2rem 1.5rem" },
  card: {
    background: G.dark2,
    borderRadius: 12,
    border: `1px solid ${G.border}`,
    padding: "1.5rem",
    marginBottom: "1rem",
  },
  cardTitle: {
    fontSize: 11, fontWeight: 700, color: G.textLight,
    textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "1rem",
  },
  badge: (color, bg) => ({
    display: "inline-flex", alignItems: "center",
    fontSize: 10, fontWeight: 700, color, background: bg,
    padding: "3px 10px", borderRadius: 4,
    whiteSpace: "nowrap", letterSpacing: "0.06em", textTransform: "uppercase",
  }),
  btn: (variant = "primary") => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: variant === "ghost" ? "7px 16px" : "9px 22px",
    borderRadius: 6,
    border: variant === "ghost" ? `1px solid ${G.borderMid}` : "none",
    background: variant === "primary" ? G.orange
               : variant === "danger"  ? G.redLight
               : variant === "ghost"   ? "transparent"
               : "rgba(253,111,5,0.1)",
    color: variant === "primary" ? "#fff"
          : variant === "danger"  ? G.red
          : variant === "ghost"   ? G.textMid
          : G.orange,
    fontSize: 12, fontWeight: 700, cursor: "pointer",
    transition: "opacity .15s", letterSpacing: "0.04em",
    textTransform: variant === "primary" ? "uppercase" : "none",
  }),
  input: {
    width: "100%", padding: "10px 14px", borderRadius: 6,
    border: `1px solid ${G.border}`,
    background: G.dark3, fontSize: 14, color: G.text,
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  },
  textarea: {
    width: "100%", padding: "10px 14px", borderRadius: 6,
    border: `1px solid ${G.border}`,
    background: G.dark3, fontSize: 14, color: G.text,
    outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box",
  },
  avatarCircle: (size = 40, bg = G.orangeLight, color = G.orange) => ({
    width: size, height: size, borderRadius: "50%",
    background: bg, display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.32, fontWeight: 700, color, flexShrink: 0,
    letterSpacing: "0.04em",
  }),
};
function initials(name) { return (name || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase(); }

// ─── Spinner ─────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${G.dark3}`, borderTop: `3px solid ${G.orange}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ fontSize: 13, color: G.textLight, letterSpacing: "0.1em", textTransform: "uppercase" }}>Загрузка...</div>
    </div>
  );
}

// ─── App root ────────────────────────────────────────────────────────────────
export default function App() {
  const route = getRoute();

  if (route.view === "client") {
    return <ClientApp projectId={route.projectId} />;
  }
  return <DesignerApp />;
}

// ─── DESIGNER APP ────────────────────────────────────────────────────────────
function DesignerApp() {
  const [projects, setProjects] = useState(null); // null = loading
  const [editingId, setEditingId] = useState(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    const unsub = subscribeProjects(setProjects);
    return unsub;
  }, []);

  const handleSave = (updated) => {
    setEditingId(null);        // мгновенно на главную
    saveProject(updated);      // пишем в фоне
  };

  const handleCreate = (data) => {
    setShowNew(false);         // мгновенно на главную
    createProject(data);       // пишем в фоне
  };

  const openClientPage = (id) => {
    window.open(`/project/${id}`, "_blank");
  };

  if (projects === null) return <div style={css.app}><DesignerTopbar /><Spinner /></div>;

  if (editingId) {
    const proj = projects.find(p => p.id === editingId);
    return (
      <div style={css.app}>
        <DesignerTopbar />
        <div style={css.page}>
          <ProjectEditor
            project={proj}
            onSave={handleSave}
            onCancel={() => setEditingId(null)}
            onOpenClient={() => openClientPage(editingId)}
          />
        </div>
      </div>
    );
  }

  if (showNew) {
    return (
      <div style={css.app}>
        <DesignerTopbar />
        <div style={css.page}>
          <NewProjectForm onAdd={handleCreate} onCancel={() => setShowNew(false)} />
        </div>
      </div>
    );
  }

  const totalPending  = projects.reduce((a, p) => a + (p.renders||[]).filter(r => r.status === "pending").length, 0);
  const totalRevision = projects.reduce((a, p) => a + (p.renders||[]).filter(r => r.status === "revision").length, 0);

  return (
    <div style={css.app}>
      <DesignerTopbar />
      <div style={css.page}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: "1.75rem" }}>
          {[
            { label: "Активных проектов", val: projects.length, accent: false },
            { label: "Ждут одобрения",    val: totalPending,    accent: totalPending > 0 },
            { label: "Требуют правок",    val: totalRevision,   accent: totalRevision > 0, danger: true },
          ].map(s => (
            <div key={s.label} style={{
              background: s.accent ? (s.danger ? "rgba(255,107,107,0.08)" : "rgba(253,111,5,0.08)") : G.dark2,
              borderRadius: 10, border: `1px solid ${s.accent ? (s.danger ? "rgba(255,107,107,0.2)" : "rgba(253,111,5,0.2)") : G.border}`,
              padding: "1.25rem", textAlign: "center",
            }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: s.accent ? (s.danger ? G.red : G.orange) : G.text, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 10, color: G.textLight, marginTop: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: G.textLight, letterSpacing: "0.12em", textTransform: "uppercase" }}>Проекты</div>
          <button style={css.btn("primary")} onClick={() => setShowNew(true)}>+ Новый проект</button>
        </div>

        {projects.length === 0 && (
          <div style={{ ...css.card, textAlign: "center", padding: "4rem", color: G.textLight, fontSize: 13, letterSpacing: "0.06em" }}>
            Нет проектов — создай первый
          </div>
        )}
        {projects.map(proj => (
          <ProjectCard
            key={proj.id}
            proj={proj}
            onEdit={() => setEditingId(proj.id)}
            onOpenClient={() => openClientPage(proj.id)}
            onDelete={async () => {
              if (window.confirm(`Удалить проект "${proj.clientName}"? Это действие нельзя отменить.`)) {
                await deleteProject(proj.id);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── CLIENT APP ──────────────────────────────────────────────────────────────
function ClientApp({ projectId }) {
  const [proj, setProj] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const unsub = subscribeProject(projectId, (p) => {
      if (!p) setNotFound(true);
      else setProj(p);
    });
    return unsub;
  }, [projectId]);

  if (notFound) {
    return (
      <div style={{ ...css.app, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 56, fontWeight: 700, color: G.orange, letterSpacing: "0.1em", marginBottom: 16 }}>404</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: G.text, marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>Проект не найден</div>
          <div style={{ fontSize: 13, color: G.textLight }}>Проверь ссылку или обратись к дизайнеру</div>
        </div>
      </div>
    );
  }

  if (!proj) return <div style={css.app}><ClientTopbar proj={null} /><Spinner /></div>;

  const patch = async (partial) => {
    await patchProject(proj.id, partial);
  };

  return (
    <div style={css.app}>
      <ClientTopbar proj={proj} />
      <ClientPage proj={proj} patch={patch} />
    </div>
  );
}

// ─── Designer Topbar ─────────────────────────────────────────────────────────
function DesignerTopbar() {
  return (
    <div style={css.topbar}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ ...css.logo }}>
          <span style={{ color: G.orange }}>K</span>
          <span style={{ color: G.text }}>AI</span>
        </div>
        <div style={{ width: 1, height: 18, background: G.border }} />
        <div style={{ fontSize: 11, color: G.textLight, letterSpacing: "0.1em", textTransform: "uppercase" }}>Studio Portal</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 11, color: G.textLight, letterSpacing: "0.08em", textTransform: "uppercase" }}>Дизайнер</div>
        <div style={{ ...css.avatarCircle(32, G.orange, "#fff"), fontSize: 11, fontWeight: 700 }}>ДМ</div>
      </div>
    </div>
  );
}

// ─── Client Topbar ───────────────────────────────────────────────────────────
function ClientTopbar({ proj }) {
  return (
    <div style={css.topbar}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ ...css.logo }}>
          <span style={{ color: G.orange }}>K</span>
          <span style={{ color: G.text }}>AI</span>
        </div>
        <div style={{ width: 1, height: 18, background: G.border }} />
        <div style={{ fontSize: 11, color: G.textLight, letterSpacing: "0.1em", textTransform: "uppercase" }}>Studio Portal</div>
      </div>
      {proj && (
        <div style={{ fontSize: 12, color: G.textMid, letterSpacing: "0.04em" }}>{proj.clientName}</div>
      )}
    </div>
  );
}

// ─── Project Card (Designer view) ────────────────────────────────────────────
function ProjectCard({ proj, onEdit, onOpenClient, onDelete }) {
  const pendingRenders  = (proj.renders||[]).filter(r => r.status === "pending").length;
  const revisionRenders = (proj.renders||[]).filter(r => r.status === "revision").length;
  const newComments     = (proj.comments||[]).filter(c => c.author === "client").length;
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    const link = `${window.location.origin}/project/${proj.id}`;
    navigator.clipboard.writeText(link).catch(() => {}).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ ...css.card, padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${G.border}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={css.avatarCircle(44, G.tealLight, G.tealDark)}>{initials(proj.clientName)}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{proj.clientName}</div>
              <div style={{ fontSize: 13, color: G.textMid, marginTop: 2 }}>{proj.address}</div>
              <div style={{ fontSize: 12, color: G.textLight, marginTop: 2 }}>{proj.style}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {pendingRenders > 0  && <span style={css.badge(G.blue, G.blueLight)}>{pendingRenders} на проверке</span>}
            {revisionRenders > 0 && <span style={css.badge(G.red,  G.redLight )}>{revisionRenders} правки</span>}
          </div>
        </div>
        <div style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: G.textLight, marginBottom: 6 }}>
            <span>Прогресс</span><span style={{ fontWeight: 600, color: G.text }}>{proj.progress || 0}%</span>
          </div>
          <div style={{ height: 5, background: G.sandDark, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${proj.progress || 0}%`, background: G.teal, borderRadius: 3, transition: "width .4s" }} />
          </div>
        </div>
      </div>

      <div style={{ padding: "0.875rem 1.5rem", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(proj.stages||[]).map(s => (
          <span key={s.id} style={css.badge(STATUS_STAGE[s.status]?.color || G.textLight, STATUS_STAGE[s.status]?.bg || G.dark3)}>{s.name}</span>
        ))}
      </div>

      {/* Copy link row */}
      <div style={{ padding: "0.625rem 1.5rem", borderTop: `1px solid ${G.border}`, display: "flex", alignItems: "center", gap: 10, background: "rgba(253,111,5,0.04)" }}>
        <div style={{ fontSize: 11, color: G.textLight, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>
          {window.location.origin}/project/{proj.id}
        </div>
        <button
          style={{ ...css.btn("ghost"), padding: "4px 12px", fontSize: 11, flexShrink: 0, background: copied ? G.orangeLight : "transparent", color: copied ? G.orange : G.textMid, borderColor: copied ? "rgba(253,111,5,0.3)" : G.border, transition: "all .2s" }}
          onClick={copyLink}
        >
          {copied ? "✓ Скопировано" : "Скопировать ссылку"}
        </button>
      </div>

      <div style={{ padding: "0.75rem 1.5rem", borderTop: `1px solid ${G.border}`, display: "flex", gap: 8, background: G.dark3 }}>
        <button style={css.btn("ghost")} onClick={onEdit}>Редактировать</button>
        <button style={{ ...css.btn("primary") }} onClick={onOpenClient}>Открыть для клиента</button>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {newComments > 0 && <span style={{ fontSize: 11, color: G.orange, letterSpacing: "0.04em" }}>💬 {newComments} от клиента</span>}
          <button
            style={{ ...css.btn("ghost"), padding: "7px 14px", fontSize: 11, color: G.red, borderColor: "rgba(255,107,107,0.3)" }}
            onClick={onDelete}
          >Удалить</button>
        </div>
      </div>
    </div>
  );
}

// ─── New Project Form ─────────────────────────────────────────────────────────
function NewProjectForm({ onAdd, onCancel }) {
  const [form, setForm] = useState({ clientName: "", address: "", style: "", deadline: "", designerNote: "", progress: 10 });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handle = () => {
    if (!form.clientName.trim()) return;
    onAdd({
      ...form,
      progress: Number(form.progress),
      startDate: new Date().toISOString().slice(0, 10),
      stages: [
        { id: uid(), name: "Обмеры и ТЗ",              desc: "", status: "pending", date: "" },
        { id: uid(), name: "Планировочные решения",     desc: "", status: "pending", date: "" },
        { id: uid(), name: "Концепция и стиль",         desc: "", status: "pending", date: "" },
        { id: uid(), name: "3D-визуализация",           desc: "", status: "pending", date: "" },
        { id: uid(), name: "Рабочие чертежи",           desc: "", status: "pending", date: "" },
        { id: uid(), name: "Комплектация",              desc: "", status: "pending", date: "" },
      ],
      renders: [], comments: [], files: [],
    });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem" }}>
        <button style={css.btn("ghost")} onClick={onCancel}>← Назад</button>
        <div style={{ fontSize: 20, fontWeight: 600 }}>Новый проект</div>
      </div>
      <div style={css.card}>
        {[
          { label: "Имя клиента *", key: "clientName", placeholder: "Анна Козлова" },
          { label: "Адрес / объект", key: "address",   placeholder: "ул. Садовая, 12 · 3-комн · 87 м²" },
          { label: "Стиль интерьера", key: "style",    placeholder: "Современная классика..." },
          { label: "Срок сдачи",     key: "deadline",  placeholder: "1 июля 2025" },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: G.textMid, marginBottom: 6 }}>{f.label}</div>
            <input style={css.input} placeholder={f.placeholder} value={form[f.key]} onChange={e => set(f.key, e.target.value)} />
          </div>
        ))}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: G.textMid, marginBottom: 6 }}>Заметка дизайнера</div>
          <textarea style={css.textarea} rows={3} placeholder="Краткое описание концепции..." value={form.designerNote} onChange={e => set("designerNote", e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: "1.5rem" }}>
          <button style={css.btn("ghost")} onClick={onCancel}>Отмена</button>
          <button style={css.btn("primary")} onClick={handle}>Создать проект</button>
        </div>
      </div>
    </div>
  );
}

// ─── Project Editor ───────────────────────────────────────────────────────────
function ProjectEditor({ project, onSave, onCancel, onOpenClient }) {
  const [proj, setProj] = useState(JSON.parse(JSON.stringify(project)));
  const [newRender, setNewRender] = useState({ name: "", room: "", url: "" });
  const [uploads, setUploads] = useState({}); // { tempId: { name, progress, done } }
  const fileInputRef = useRef(null);

  const setField = (k, v) => setProj(p => ({ ...p, [k]: v }));
  const setStageStatus = (sid, status) => setProj(p => ({ ...p, stages: p.stages.map(s => s.id === sid ? { ...s, status } : s) }));
  const setStageField  = (sid, k, v)   => setProj(p => ({ ...p, stages: p.stages.map(s => s.id === sid ? { ...s, [k]: v } : s) }));

  const addRender = () => {
    if (!newRender.url.trim()) return;
    setProj(p => ({ ...p, renders: [...(p.renders||[]), { id: uid(), ...newRender, status: "pending", clientComment: "" }] }));
    setNewRender({ name: "", room: "", url: "" });
  };
  const removeRender = (rid) => setProj(p => ({ ...p, renders: p.renders.filter(r => r.id !== rid) }));

  const handleFiles = async (files) => {
    const arr = Array.from(files);
    for (const file of arr) {
      if (!file.type.startsWith("image/")) continue;
      const tempId = uid();
      const name = file.name.replace(/\.[^.]+$/, "");
      setUploads(u => ({ ...u, [tempId]: { name, progress: 0 } }));
      try {
        const url = await uploadToCloudinary(file, (pct) => {
          setUploads(u => ({ ...u, [tempId]: { name, progress: pct } }));
        });
        setProj(p => ({ ...p, renders: [...(p.renders||[]), { id: uid(), name, room: "", url, status: "pending", clientComment: "" }] }));
        setUploads(u => { const next = { ...u }; delete next[tempId]; return next; });
      } catch {
        setUploads(u => { const next = { ...u }; delete next[tempId]; return next; });
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleSave = () => { onSave(proj); };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <button style={css.btn("ghost")} onClick={onCancel}>← Назад</button>
        <div style={{ fontSize: 20, fontWeight: 600, flex: 1 }}>{proj.clientName}</div>
        <button style={css.btn("blue")} onClick={onOpenClient}>👁 Страница клиента</button>
        <button style={css.btn("primary")} onClick={handleSave}>Сохранить</button>
      </div>

      <div style={css.card}>
        <div style={css.cardTitle}>Информация</div>
        {[
          { label: "Имя клиента", key: "clientName" },
          { label: "Адрес / объект", key: "address" },
          { label: "Стиль", key: "style" },
          { label: "Срок сдачи", key: "deadline" },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: "0.75rem" }}>
            <div style={{ fontSize: 12, color: G.textLight, marginBottom: 4 }}>{f.label}</div>
            <input style={css.input} value={proj[f.key]||""} onChange={e => setField(f.key, e.target.value)} />
          </div>
        ))}
        <div style={{ marginBottom: "0.75rem" }}>
          <div style={{ fontSize: 12, color: G.textLight, marginBottom: 4 }}>Заметка дизайнера</div>
          <textarea style={css.textarea} rows={2} value={proj.designerNote||""} onChange={e => setField("designerNote", e.target.value)} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: G.textLight, marginBottom: 4 }}>Прогресс: {proj.progress||0}%</div>
          <input type="range" min={0} max={100} step={5} value={proj.progress||0} onChange={e => setField("progress", Number(e.target.value))} style={{ width: "100%", accentColor: G.teal }} />
        </div>
      </div>

      <div style={css.card}>
        <div style={css.cardTitle}>Этапы</div>
        {(proj.stages||[]).map(s => (
          <div key={s.id} style={{ padding: "10px 0", borderBottom: `1px solid ${G.border}`, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <input style={{ ...css.input, fontSize: 13, padding: "6px 10px", marginBottom: 6 }} value={s.name} onChange={e => setStageField(s.id, "name", e.target.value)} />
              <input style={{ ...css.input, fontSize: 12, padding: "5px 10px", marginBottom: 4 }} placeholder="Описание" value={s.desc} onChange={e => setStageField(s.id, "desc", e.target.value)} />
              <input style={{ ...css.input, fontSize: 12, padding: "5px 10px" }} placeholder="Дата / срок" value={s.date} onChange={e => setStageField(s.id, "date", e.target.value)} />
            </div>
            <select value={s.status} onChange={e => setStageStatus(s.id, e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${G.border}`, background: STATUS_STAGE[s.status]?.bg, color: STATUS_STAGE[s.status]?.color, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <option value="pending">Ожидает</option>
              <option value="active">В работе</option>
              <option value="done">Готово</option>
            </select>
          </div>
        ))}
      </div>

      <div style={css.card}>
        <div style={css.cardTitle}>Рендеры</div>

        {/* Existing renders list */}
        {(proj.renders||[]).map(r => (
          <div key={r.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${G.border}` }}>
            <img src={r.url} alt={r.name} style={{ width: 64, height: 48, objectFit: "cover", borderRadius: 8, flexShrink: 0, background: G.sandDark }} onError={e => e.target.style.opacity = 0.3} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
              <div style={{ fontSize: 12, color: G.textLight }}>{r.room} · <span style={{ color: STATUS_RENDER[r.status]?.color }}>{STATUS_RENDER[r.status]?.label}</span></div>
              {r.clientComment && <div style={{ fontSize: 12, color: G.red, marginTop: 2 }}>«{r.clientComment}»</div>}
            </div>
            <button style={{ ...css.btn("ghost"), padding: "4px 10px", fontSize: 12 }} onClick={() => removeRender(r.id)}>✕</button>
          </div>
        ))}

        {/* Active uploads progress */}
        {Object.entries(uploads).map(([id, u]) => (
          <div key={id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${G.border}` }}>
            <div style={{ width: 64, height: 48, borderRadius: 8, background: G.sandDark, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: G.textLight }}>
              {u.progress}%
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: G.textMid, marginBottom: 6 }}>{u.name}</div>
              <div style={{ height: 4, background: G.sandDark, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${u.progress}%`, background: G.teal, borderRadius: 2, transition: "width .2s" }} />
              </div>
            </div>
          </div>
        ))}

        {/* Upload zone — drag&drop or click */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          style={{
            marginTop: "1rem",
            border: `2px dashed ${G.borderMid}`,
            borderRadius: 12,
            padding: "1.5rem",
            textAlign: "center",
            cursor: "pointer",
            background: G.sand,
            transition: "border-color .15s",
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = G.teal}
          onMouseLeave={e => e.currentTarget.style.borderColor = G.borderMid}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>🖼️</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: G.textMid }}>Перетащи фото сюда или нажми для выбора</div>
          <div style={{ fontSize: 12, color: G.textLight, marginTop: 4 }}>JPG, PNG, WEBP — можно несколько сразу</div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={e => { handleFiles(e.target.files); e.target.value = ""; }}
          />
        </div>

        {/* Manual URL input */}
        <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, color: G.textLight }}>Или добавить по ссылке (Google Drive / любая)</div>
          <input style={css.input} placeholder="Название рендера" value={newRender.name} onChange={e => setNewRender(v => ({ ...v, name: e.target.value }))} />
          <input style={css.input} placeholder="Помещение" value={newRender.room} onChange={e => setNewRender(v => ({ ...v, room: e.target.value }))} />
          <div style={{ display: "flex", gap: 8 }}>
            <input style={css.input} placeholder="Ссылка на изображение" value={newRender.url} onChange={e => setNewRender(v => ({ ...v, url: e.target.value }))} />
            <button style={{ ...css.btn("primary"), flexShrink: 0 }} onClick={addRender}>Добавить</button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button style={css.btn("ghost")} onClick={onCancel}>Отмена</button>
        <button style={css.btn("primary")} onClick={handleSave}>Сохранить изменения</button>
      </div>
    </div>
  );
}

// ─── Client Page ─────────────────────────────────────────────────────────────
function ClientPage({ proj, patch }) {
  const [commentText, setCommentText] = useState("");
  const [revisionInputs, setRevisionInputs] = useState(() => {
    const init = {};
    (proj.renders||[]).forEach(r => { if (r.clientComment) init[r.id] = r.clientComment; });
    return init;
  });
  const [sending, setSending] = useState(false);

  const approveRender = async (rid) => {
    const renders = (proj.renders||[]).map(r => r.id === rid ? { ...r, status: "approved", clientComment: "" } : r);
    await patch({ renders });
  };
  const unapproveRender = async (rid) => {
    const renders = (proj.renders||[]).map(r => r.id === rid ? { ...r, status: "pending", clientComment: "" } : r);
    await patch({ renders });
    setRevisionInputs(v => ({ ...v, [rid]: "" }));
  };
  const requestRevision = async (rid) => {
    const text = (revisionInputs[rid] || "").trim();
    if (!text) return;
    const renders = (proj.renders||[]).map(r => r.id === rid ? { ...r, status: "revision", clientComment: text } : r);
    await patch({ renders });
  };
  const sendComment = async () => {
    if (!commentText.trim() || sending) return;
    setSending(true);
    const newComment = { id: uid(), author: "client", text: commentText.trim(), time: `Сегодня, ${nowStr()}` };
    const comments = [...(proj.comments||[]), newComment];
    await patch({ comments });
    setCommentText("");
    setSending(false);
  };

  const doneStages   = (proj.stages||[]).filter(s => s.status === "done").length;
  const activeStages = (proj.stages||[]).filter(s => s.status === "active").length;
  const pendingStages= (proj.stages||[]).filter(s => s.status === "pending").length;

  return (
    <div style={css.page}>
      {/* Hero */}
      <div style={{
        borderRadius: 12, marginBottom: "1rem", overflow: "hidden",
        background: `linear-gradient(135deg, #1F1F1F 0%, #2d1a0a 50%, #1F1F1F 100%)`,
        border: `1px solid rgba(253,111,5,0.2)`,
        padding: "2rem",
        position: "relative",
      }}>
        {/* Orange accent line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${G.orangeDark}, ${G.orange}, #FFA565)` }} />

        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 8, background: G.orange, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff", flexShrink: 0, letterSpacing: "0.04em" }}>
            {initials(proj.clientName)}
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: G.text, letterSpacing: "0.02em" }}>{proj.clientName}</div>
            <div style={{ fontSize: 13, color: G.textMid, marginTop: 3 }}>{proj.address}</div>
            <div style={{ fontSize: 11, color: G.textLight, marginTop: 2, letterSpacing: "0.04em" }}>{proj.style}{proj.deadline && ` · Срок: ${proj.deadline}`}</div>
          </div>
        </div>

        {proj.designerNote && (
          <div style={{ marginTop: "1.25rem", padding: "1rem 1.125rem", background: "rgba(253,111,5,0.08)", borderRadius: 8, border: `1px solid rgba(253,111,5,0.15)`, fontSize: 13, lineHeight: 1.65, color: G.textMid }}>
            <span style={{ fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: G.orange }}>Заметка · </span>
            {proj.designerNote}
          </div>
        )}

        <div style={{ marginTop: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: G.textLight, marginBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            <span>Прогресс проекта</span>
            <span style={{ fontWeight: 700, color: G.orange }}>{proj.progress||0}%</span>
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${proj.progress||0}%`, background: `linear-gradient(90deg, ${G.orangeDark}, ${G.orange})`, borderRadius: 2, transition: "width .6s" }} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: "1.25rem" }}>
          {[{ v: doneStages, l: "Завершено", active: doneStages > 0 }, { v: activeStages, l: "В работе", active: activeStages > 0 }, { v: pendingStages, l: "Ожидает" }].map(s => (
            <div key={s.l} style={{ textAlign: "center", padding: "0.75rem", background: s.active ? "rgba(253,111,5,0.1)" : "rgba(255,255,255,0.04)", borderRadius: 8, border: `1px solid ${s.active ? "rgba(253,111,5,0.2)" : "rgba(255,255,255,0.06)"}` }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.active ? G.orange : G.textMid }}>{s.v}</div>
              <div style={{ fontSize: 10, color: G.textLight, marginTop: 2, letterSpacing: "0.08em", textTransform: "uppercase" }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stages */}
      <div style={css.card}>
        <div style={css.cardTitle}>Этапы работы</div>
        {(proj.stages||[]).map((s, i) => (
          <div key={s.id} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "12px 0", borderBottom: i < (proj.stages||[]).length-1 ? `1px solid ${G.border}` : "none" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: STATUS_STAGE[s.status]?.bg || G.sand, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginTop: 2 }}>
              {s.status === "done" ? "✓" : s.status === "active" ? "→" : "○"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{s.name}</div>
              {s.desc && <div style={{ fontSize: 13, color: G.textMid, marginTop: 3, lineHeight: 1.5 }}>{s.desc}</div>}
              {s.date && <div style={{ fontSize: 12, color: G.textLight, marginTop: 4 }}>{s.date}</div>}
            </div>
            <span style={css.badge(STATUS_STAGE[s.status]?.color||G.textLight, STATUS_STAGE[s.status]?.bg||G.sand)}>{STATUS_STAGE[s.status]?.label||s.status}</span>
          </div>
        ))}
      </div>

      {/* Renders */}
      {(proj.renders||[]).length > 0 && (
        <div style={css.card}>
          <div style={css.cardTitle}>Рендеры · Ваши действия</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
            {(proj.renders||[]).map(r => (
              <RenderCard
                key={r.id}
                render={r}
                revisionText={revisionInputs[r.id] !== undefined ? revisionInputs[r.id] : (r.clientComment||"")}
                setRevisionText={v => setRevisionInputs(rv => ({ ...rv, [r.id]: v }))}
                onApprove={() => approveRender(r.id)}
                onUnapprove={() => unapproveRender(r.id)}
                onRevision={() => requestRevision(r.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      <div style={css.card}>
        <div style={css.cardTitle}>Комментарии к проекту</div>
        <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: "1rem" }}>
          {(proj.comments||[]).length === 0 && (
            <div style={{ fontSize: 14, color: G.textLight, textAlign: "center", padding: "1rem 0" }}>Нет сообщений</div>
          )}
          {(proj.comments||[]).map(c => (
            <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: "1rem" }}>
              <div style={css.avatarCircle(34, c.author === "designer" ? G.tealLight : G.blueLight, c.author === "designer" ? G.tealDark : G.blue)}>
                {c.author === "designer" ? "Д" : initials(proj.clientName)}
              </div>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{c.author === "designer" ? "Дизайнер" : proj.clientName}</span>
                  <span style={{ fontSize: 11, color: G.textLight }}>{c.time}</span>
                </div>
                <div style={{ fontSize: 14, color: G.textMid, lineHeight: 1.55, background: G.sand, padding: "8px 12px", borderRadius: 10, borderTopLeftRadius: c.author === "designer" ? 2 : 10, borderTopRightRadius: c.author === "client" ? 2 : 10 }}>
                  {c.text}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            style={{ ...css.textarea, flex: 1, minHeight: 70 }}
            placeholder="Написать комментарий дизайнеру..."
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendComment(); }}
          />
          <button style={{ ...css.btn("primary"), padding: "12px 20px", flexShrink: 0 }} onClick={sendComment} disabled={sending}>
            {sending ? "..." : "Отправить"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: G.textLight, marginTop: 6 }}>Ctrl+Enter для быстрой отправки</div>
      </div>

      {/* Upload placeholder */}
      <div style={{ ...css.card, border: `1px dashed rgba(253,111,5,0.25)`, background: "rgba(253,111,5,0.04)", textAlign: "center", padding: "2rem" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: G.textLight, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Референсы</div>
        <div style={{ fontSize: 13, color: G.textMid }}>Загрузить фото, PDF или изображения</div>
      </div>

      <div style={{ textAlign: "center", padding: "1.5rem 0 0.5rem" }}>
        <div style={{ fontSize: 11, color: G.textLight, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          <span style={{ color: G.orange, fontWeight: 700 }}>K</span>AI Studio Portal · {today()}
        </div>
      </div>
    </div>
  );
}

// ─── Render Card ─────────────────────────────────────────────────────────────
function RenderCard({ render: r, revisionText, setRevisionText, onApprove, onUnapprove, onRevision }) {
  const [showRevision, setShowRevision] = useState(r.status === "revision");

  return (
    <div style={{ background: G.dark2, border: `1px solid ${G.border}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ position: "relative" }}>
        <img src={r.url} alt={r.name} style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
          onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="flex"; }} />
        <div style={{ display: "none", height: 160, background: G.dark3, alignItems: "center", justifyContent: "center", fontSize: 11, color: G.textLight, letterSpacing: "0.08em", textTransform: "uppercase" }}>Изображение</div>
        <div style={{ position: "absolute", top: 8, right: 8 }}>
          <span style={css.badge(STATUS_RENDER[r.status]?.color, STATUS_RENDER[r.status]?.bg)}>{STATUS_RENDER[r.status]?.label}</span>
        </div>
      </div>
      <div style={{ padding: "12px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, color: G.text }}>{r.name}</div>
        <div style={{ fontSize: 11, color: G.textLight, marginBottom: 10, letterSpacing: "0.04em" }}>{r.room}</div>

        {r.status === "approved" ? (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <div style={{ flex: 1, padding: "7px", borderRadius: 6, background: G.orangeLight, color: G.orange, fontSize: 11, fontWeight: 700, textAlign: "center", letterSpacing: "0.06em", textTransform: "uppercase" }}>✓ Одобрено</div>
            <button style={{ padding: "7px 10px", borderRadius: 6, border: `1px solid ${G.border}`, background: "transparent", color: G.textMid, fontSize: 11, cursor: "pointer" }} onClick={onUnapprove} title="Отменить">↩</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <button style={{ flex: 1, padding: "7px", borderRadius: 6, border: `1px solid rgba(253,111,5,0.3)`, background: G.orangeLight, color: G.orange, fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em" }} onClick={onApprove}>✓ Одобрить</button>
            <button style={{ flex: 1, padding: "7px", borderRadius: 6, border: `1px solid ${showRevision ? "rgba(255,107,107,0.4)" : "rgba(255,107,107,0.2)"}`, background: showRevision ? "rgba(255,107,107,0.15)" : G.redLight, color: G.red, fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em" }} onClick={() => setShowRevision(v => !v)}>✕ Правка</button>
          </div>
        )}

        <div>
          <div style={{ fontSize: 10, color: G.textLight, marginBottom: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {r.status === "revision" ? "Ваша правка:" : "Комментарий:"}
          </div>
          <textarea
            style={{ ...css.textarea, fontSize: 12, padding: "7px 10px", borderColor: r.status === "revision" ? "rgba(255,107,107,0.3)" : G.border, background: r.status === "revision" ? "rgba(255,107,107,0.08)" : G.dark3 }}
            rows={2}
            placeholder="Опишите пожелание..."
            value={revisionText}
            onChange={e => setRevisionText(e.target.value)}
          />
          {showRevision && revisionText.trim() && r.status !== "revision" && (
            <button style={{ ...css.btn("danger"), width: "100%", marginTop: 4, padding: "7px", fontSize: 12 }} onClick={() => { onRevision(); setShowRevision(false); }}>Отправить правку</button>
          )}
          {r.status === "revision" && revisionText.trim() && revisionText.trim() !== r.clientComment && (
            <button style={{ ...css.btn("danger"), width: "100%", marginTop: 4, padding: "7px", fontSize: 12 }} onClick={onRevision}>Обновить правку</button>
          )}
        </div>
      </div>
    </div>
  );
}