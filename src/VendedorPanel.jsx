import { useState, useEffect, useCallback, useRef } from "react";
import {
  Package, Search, Clock, Check, X, Calendar,
  ChevronLeft, ChevronRight, LogOut, Bell,
  CheckCircle, AlertCircle, Phone, Download,
  MapPin, Plus, Edit2, Trash2, ShoppingBag,
  FileText, Truck, Coffee, PhoneCall, Users, UserCircle, Save,
} from "lucide-react";
import {
  supabase, C, FONT_DISPLAY, FONT_BODY, VENDEDORES_INFO, LOGO_URL, getIdentidadInterna,
} from "./lib";
import { parseDet, imprimirPedido, EP } from "./Pedidos";
import BotonMensajes from "./MensajeriaInterna";

const L = {
  bg: "#F5F6F8", white: "#FFFFFF", border: "#E4E8ED",
  text: "#0F172A", muted: "#64748B", light: "#94A3B8",
  soft: "#F1F5F9",
};

const TIPOS = [
  { k: "pedido",   label: "Pedido",   icon: <Package size={14} />,   color: "#1D4ED8", bg: "#DBEAFE" },
  { k: "visita",   label: "Visita",   icon: <Truck size={14} />,     color: "#15803D", bg: "#DCFCE7" },
  { k: "reunion",  label: "Reunión",  icon: <Users size={14} />,     color: "#B45309", bg: "#FEF3C7" },
];

function TipoBadge({ tipo }) {
  const t = TIPOS.find(t => t.k === tipo) || TIPOS[0];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, padding: "2px 8px", borderRadius: 6, background: t.bg, color: t.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, whiteSpace: "nowrap" }}>
      {t.icon} {t.label}
    </span>
  );
}

function getVendorInfo(userEmail) {
  const prefix = (userEmail || "").split("@")[0].toLowerCase();
  return VENDEDORES_INFO.find(v => v.emailPrefix === prefix) || { nombre: prefix, alias: prefix, emailPrefix: prefix };
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso + "T12:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function isHoy(iso) {
  if (!iso) return false;
  return new Date(iso + "T12:00").toDateString() === new Date().toDateString();
}
function isManiana(iso) {
  if (!iso) return false;
  const m = new Date(); m.setDate(m.getDate() + 1);
  return new Date(iso + "T12:00").toDateString() === m.toDateString();
}
function isVencido(iso) {
  if (!iso) return false;
  return new Date(iso + "T23:59:59") < new Date() && !isHoy(iso);
}

function parseDetEx(raw) {
  const base = parseDet(raw);
  try {
    const p = typeof raw === "string" ? JSON.parse(raw) : (raw || {});
    return { ...base, tipo: p.tipo || "pedido", clienteNombre: p.clienteNombre || "", clienteTel: p.clienteTel || "", observacion: p.observacion || base.notas || "", detalle_extra: p.detalle_extra || "", fecha_visita: p.fecha_visita || null };
  } catch { return { ...base, tipo: "pedido", clienteNombre: "", clienteTel: "", observacion: "", detalle_extra: "", fecha_visita: null }; }
}

// ── Mini Calendario ──────────────────────────────────────────
function MiniCalendar({ pedidos, onSelectDate, selectedDate }) {
  const [mes, setMes] = useState(new Date());
  const year = mes.getFullYear(), month = mes.getMonth();
  const firstDayRaw = new Date(year, month, 1).getDay();
  const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const byDate = {};
  pedidos.forEach(p => {
    const fe = parseDetEx(p.detalle).fecha_entrega;
    if (!fe) return;
    const d = new Date(fe + "T12:00");
    if (d.getFullYear() === year && d.getMonth() === month) {
      byDate[d.getDate()] = (byDate[d.getDate()] || 0) + 1;
    }
  });

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  return (
    <div style={{ background: L.white, border: `1px solid ${L.border}`, borderRadius: 14, padding: 16, boxShadow: "0 2px 8px rgba(0,0,0,.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button onClick={() => setMes(new Date(year, month - 1, 1))} style={{ background: "none", border: "none", cursor: "pointer", color: L.muted, padding: 4 }}><ChevronLeft size={15} /></button>
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12.5, color: L.text, textTransform: "capitalize" }}>
          {mes.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
        </span>
        <button onClick={() => setMes(new Date(year, month + 1, 1))} style={{ background: "none", border: "none", cursor: "pointer", color: L.muted, padding: 4 }}><ChevronRight size={15} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {["L","M","M","J","V","S","D"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: L.light, padding: "1px 0" }}>{d}</div>
        ))}
        {days.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const cnt = byDate[d] || 0;
          const sel = selectedDate === iso;
          const hoy = new Date().toDateString() === new Date(iso + "T12:00").toDateString();
          return (
            <button key={d} onClick={() => onSelectDate(sel ? null : iso)}
              style={{ position: "relative", textAlign: "center", padding: "4px 0", borderRadius: 6, border: "none", cursor: "pointer", background: sel ? C.red : hoy ? "#FEF2F2" : "transparent", color: sel ? "#fff" : hoy ? C.red : L.text, fontWeight: cnt ? 700 : 400, fontSize: 12 }}>
              {d}
              {cnt > 0 && !sel && <div style={{ position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: C.red }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Modal de Perfil ──────────────────────────────────────────
function PerfilModal({ vendorInfo, userEmail, onClose }) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase.from("vendedores")
        .select("nombre, telefono_whatsapp")
        .ilike("email", `${vendorInfo.emailPrefix}%`)
        .maybeSingle();
      if (data) {
        setNombre(data.nombre || vendorInfo.nombre);
        setTelefono(data.telefono_whatsapp || "");
      } else {
        setNombre(vendorInfo.nombre);
      }
    };
    cargar();
  }, [vendorInfo]);

  const guardar = async () => {
    setGuardando(true);
    await supabase.from("vendedores")
      .update({ nombre: nombre.trim() || null, telefono_whatsapp: telefono.trim() || null })
      .ilike("email", `${vendorInfo.emailPrefix}%`);
    setGuardando(false);
    setOk(true);
    setTimeout(() => { setOk(false); onClose(); }, 1200);
  };

  const inp = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 9, border: `1.5px solid ${L.border}`, fontSize: 14, fontFamily: FONT_BODY, color: L.text, outline: "none", background: L.soft };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 400 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "min(420px, 94vw)", background: L.white, borderRadius: 18, zIndex: 401, boxShadow: "0 24px 80px rgba(0,0,0,.25)", fontFamily: FONT_BODY, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px", borderBottom: `3px solid ${C.gold}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: L.white }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <UserCircle size={22} color={C.red} />
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16, color: L.text }}>Mis datos personales</span>
          </div>
          <button onClick={onClose} style={{ background: L.soft, border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: L.muted }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: "22px" }}>
          {/* Avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22, background: L.soft, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ width: 50, height: 50, borderRadius: "50%", background: C.red, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 20, flexShrink: 0 }}>
              {(nombre || vendorInfo.nombre).slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: L.text }}>{nombre || vendorInfo.nombre}</div>
              <div style={{ fontSize: 12, color: L.muted }}>{userEmail}</div>
              <div style={{ fontSize: 11, color: C.red, fontWeight: 700, marginTop: 2 }}>Vendedor · Nuevo Munich</div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: L.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7 }}>Nombre completo</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre completo" style={inp} />
          </div>
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: L.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7 }}>
              Teléfono WhatsApp
            </label>
            <input value={telefono} onChange={e => setTelefono(e.target.value.replace(/[^\d+\-\s]/g, ""))} placeholder="5491155551234" style={inp} type="tel" />
            <div style={{ fontSize: 11, color: L.light, marginTop: 5 }}>Permite identificar tus mensajes de WhatsApp automáticamente en el CRM</div>
          </div>

          <button onClick={guardar} disabled={guardando}
            style={{ width: "100%", background: ok ? "#15803D" : (guardando ? L.light : C.red), color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, cursor: guardando ? "default" : "pointer", fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: 0.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background .2s" }}>
            {ok ? <><Check size={16} /> Guardado</> : guardando ? "Guardando…" : <><Save size={16} /> Guardar cambios</>}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Formulario de nueva entrada ──────────────────────────────
const FORM_VACIO = {
  tipo: "pedido",
  clienteNombre: "", clienteTel: "", clienteDireccion: "",
  items: [{ qty: 1, desc: "" }, { qty: 1, desc: "" }, { qty: 1, desc: "" }],
  observacion: "", detalle_extra: "",
  fechaVisita: new Date().toISOString().split("T")[0],
  fechaEntrega: "",
  pago: "Efectivo", entrega: "Delivery",
  estado: "pendiente",
};

function FormModal({ vendorAlias, editando, contactosMap, onClose, onGuardado }) {
  const [form, setForm] = useState(() => {
    if (editando) {
      const det = parseDetEx(editando.detalle);
      const cont = contactosMap[editando.contacto_id] || {};
      return {
        tipo: det.tipo || "pedido",
        clienteNombre: cont.nombre || "",
        clienteTel: cont.telefono || "",
        clienteDireccion: det.direccion || cont.direccion || "",
        items: det.items.length ? det.items : FORM_VACIO.items,
        observacion: det.observacion || det.notas || "",
        detalle_extra: det.detalle_extra || "",
        fechaVisita: det.fecha_visita || new Date().toISOString().split("T")[0],
        fechaEntrega: det.fecha_entrega || "",
        pago: det.pago || "Efectivo",
        entrega: det.entrega || "Delivery",
        estado: editando.estado || "pendiente",
      };
    }
    return { ...FORM_VACIO };
  });
  const [guardando, setGuardando] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setItem = (i, k, v) => setForm(f => {
    const items = [...f.items];
    items[i] = { ...items[i], [k]: v };
    return { ...f, items };
  });
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { qty: 1, desc: "" }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const guardar = async () => {
    setGuardando(true);
    try {
      let contactoId = editando?.contacto_id || null;

      if (!editando && form.clienteTel) {
        const phone = form.clienteTel.replace(/\D/g, "");
        const { data: ex } = await supabase.from("contactos").select("id").eq("telefono", phone).maybeSingle();
        if (ex) {
          contactoId = ex.id;
        } else {
          const { data: nuevo } = await supabase.from("contactos").insert({
            telefono: phone, nombre: form.clienteNombre || null,
            direccion: form.clienteDireccion || null,
            vendedor: vendorAlias, estado: "nuevo", bot_activo: false, no_leidos: 0,
          }).select("id").maybeSingle();
          contactoId = nuevo?.id;
        }
      }

      const det = {
        tipo: form.tipo,
        clienteNombre: form.clienteNombre,
        clienteTel: form.clienteTel,
        items: form.items.filter(i => i.desc?.trim()).map(i => ({ qty: Number(i.qty) || 1, desc: i.desc, precio: 0 })),
        observacion: form.observacion,
        detalle_extra: form.detalle_extra,
        fecha_visita: form.fechaVisita,
        fecha_entrega: form.fechaEntrega || null,
        entrega: form.entrega,
        direccion: form.clienteDireccion,
        pago: form.pago,
        notas: form.observacion,
      };

      if (editando) {
        await supabase.from("pedidos").update({ detalle: JSON.stringify(det), estado: form.estado }).eq("id", editando.id);
      } else {
        await supabase.from("pedidos").insert({ contacto_id: contactoId, vendedor: vendorAlias, detalle: JSON.stringify(det), total: 0, estado: form.estado });
      }
      await onGuardado();
      onClose();
    } finally {
      setGuardando(false);
    }
  };

  const inp = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, border: `1.5px solid ${L.border}`, fontSize: 13, fontFamily: FONT_BODY, color: L.text, outline: "none", background: L.soft };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 400 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: "min(620px, 96vw)", maxHeight: "90vh",
        background: L.white, borderRadius: 18, zIndex: 401,
        boxShadow: "0 24px 80px rgba(0,0,0,.25)", fontFamily: FONT_BODY,
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `3px solid ${C.gold}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: L.white }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 16, color: L.text }}>
            {editando ? "Editar entrada" : "Cargar nueva entrada"}
          </div>
          <button onClick={onClose} style={{ background: L.soft, border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: L.muted }}>
            <X size={16} />
          </button>
        </div>

        <div className="scroll-y" style={{ flex: 1, overflowY: "auto", padding: "20px" }}>

          {/* Tipo de actividad */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: L.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Tipo de actividad</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {TIPOS.map(t => (
                <button key={t.k} onClick={() => set("tipo", t.k)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: `2px solid ${form.tipo === t.k ? t.color : L.border}`, background: form.tipo === t.k ? t.bg : L.soft, color: form.tipo === t.k ? t.color : L.muted, cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: FONT_BODY, transition: "all .15s" }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Datos del cliente */}
          <div style={{ background: L.soft, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: L.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Datos del cliente</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: L.muted, marginBottom: 5, fontWeight: 600 }}>Nombre / Razón social *</label>
                <input value={form.clienteNombre} onChange={e => set("clienteNombre", e.target.value)}
                  placeholder="Ej: Charly Dog" style={inp} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: L.muted, marginBottom: 5, fontWeight: 600 }}>Teléfono <span style={{ color: L.light, fontWeight: 400 }}>(opcional)</span></label>
                <input value={form.clienteTel} onChange={e => set("clienteTel", e.target.value)}
                  placeholder="5491155551234" style={inp} type="tel" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: 11, color: L.muted, marginBottom: 5, fontWeight: 600 }}>Dirección <span style={{ color: L.light, fontWeight: 400 }}>(opcional)</span></label>
                <input value={form.clienteDireccion} onChange={e => set("clienteDireccion", e.target.value)}
                  placeholder="Calle, número, barrio" style={inp} />
              </div>
            </div>
          </div>

          {/* Pedido / Productos — no aplica para Visita */}
          {form.tipo !== "visita" && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: L.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Productos / Pedido</label>
              <button onClick={addItem} style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                <Plus size={13} /> Agregar línea
              </button>
            </div>
            {form.items.map((it, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7, alignItems: "center" }}>
                <input value={it.qty} onChange={e => setItem(i, "qty", e.target.value)}
                  style={{ ...inp, width: 56, textAlign: "center", padding: "9px 8px" }} placeholder="Cant" type="number" min="1" />
                <input value={it.desc} onChange={e => setItem(i, "desc", e.target.value)}
                  style={{ ...inp, flex: 1 }} placeholder="Descripción del producto" />
                {form.items.length > 1 && (
                  <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", cursor: "pointer", color: L.light, padding: 4, flexShrink: 0 }}>
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          )}

          {/* Observación (+ Detalle adicional, salvo en Visita) */}
          <div style={{ display: "grid", gridTemplateColumns: form.tipo === "visita" ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: L.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Observación</label>
              <textarea value={form.observacion} onChange={e => set("observacion", e.target.value)}
                placeholder="Ej: Visité al cliente, pidió surtido de embutidos. Confirmar próxima semana."
                rows={form.tipo === "visita" ? 4 : 3} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} />
            </div>
            {form.tipo !== "visita" && (
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: L.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Detalle adicional</label>
              <textarea value={form.detalle_extra} onChange={e => set("detalle_extra", e.target.value)}
                placeholder="Condiciones especiales, descuentos pactados, persona de contacto..."
                rows={3} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} />
            </div>
            )}
          </div>

          {/* Fechas y logística — en Visita, solo el calendario de la visita */}
          {form.tipo === "visita" ? (
          <div style={{ background: L.soft, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: L.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Fecha de la visita</div>
            <input type="date" value={form.fechaVisita} onChange={e => set("fechaVisita", e.target.value)} style={{ ...inp, maxWidth: 220 }} />
          </div>
          ) : (
          <div style={{ background: L.soft, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: L.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Fechas y logística</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: L.muted, marginBottom: 5, fontWeight: 600 }}>Fecha de visita</label>
                <input type="date" value={form.fechaVisita} onChange={e => set("fechaVisita", e.target.value)} style={inp} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: L.muted, marginBottom: 5, fontWeight: 600 }}>
                  📅 Fecha entrega / seguimiento
                </label>
                <input type="date" value={form.fechaEntrega} onChange={e => set("fechaEntrega", e.target.value)} style={{ ...inp, borderColor: form.fechaEntrega ? C.red : L.border }} />
                {form.fechaEntrega && <div style={{ fontSize: 10.5, color: C.red, marginTop: 3 }}>⏰ Recibirás aviso 1 día antes</div>}
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: L.muted, marginBottom: 5, fontWeight: 600 }}>Tipo entrega</label>
                <select value={form.entrega} onChange={e => set("entrega", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                  {["Delivery", "Retiro en local", "Salón", "A definir"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: L.muted, marginBottom: 5, fontWeight: 600 }}>Forma de pago</label>
                <select value={form.pago} onChange={e => set("pago", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                  {["Efectivo", "Transferencia", "Tarjeta", "Cuenta corriente", "A definir"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>
          )}

          {/* Estado (solo lectura — lo gestiona Administración) */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: L.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Estado</label>
            {(() => {
              const ep = EP[form.estado] || EP.pendiente;
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, background: ep.bg, color: ep.color, fontWeight: 700, fontSize: 12.5 }}>
                    {ep.label}
                  </span>
                  <span style={{ fontSize: 12, color: L.light }}>El estado lo gestiona Administración.</span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${L.border}`, display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: "transparent", border: `1.5px solid ${L.border}`, borderRadius: 10, padding: 12, fontSize: 14, cursor: "pointer", color: L.muted, fontFamily: FONT_BODY, fontWeight: 600 }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando}
            style={{ flex: 2, background: guardando ? L.light : C.red, color: "#fff", border: "none", borderRadius: 10, padding: 12, fontSize: 14, cursor: guardando ? "default" : "pointer", fontFamily: FONT_DISPLAY, fontWeight: 700, letterSpacing: 0.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {guardando ? "Guardando…" : <><Check size={16} /> Guardar entrada</>}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Panel Principal ──────────────────────────────────────────
export default function VendedorDashboard({ userEmail, onLogout, vendorAliasOverride }) {
  const vendorInfo = vendorAliasOverride
    ? (VENDEDORES_INFO.find(v => v.alias === vendorAliasOverride) || { nombre: vendorAliasOverride, alias: vendorAliasOverride })
    : getVendorInfo(userEmail);

  const [pedidos, setPedidos]       = useState([]);
  const [contactos, setContactos]   = useState({});
  const [loading, setLoading]       = useState(true);
  const [busqueda, setBusqueda]     = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [selectedDate, setSelectedDate] = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [editando, setEditando]     = useState(null);
  const [notifs, setNotifs]         = useState([]);
  const [showNotifs, setShowNotifs] = useState(true);
  const [confirmElim, setConfirmElim] = useState(null);
  const [showPerfil, setShowPerfil] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const { data: peds } = await supabase
      .from("pedidos").select("*")
      .eq("vendedor", vendorInfo.alias)
      .order("created_at", { ascending: false });

    if (peds && peds.length > 0) {
      const ids = [...new Set(peds.map(p => p.contacto_id).filter(Boolean))];
      const { data: conts } = await supabase.from("contactos").select("id,nombre,telefono,empresa,direccion").in("id", ids);
      const map = {};
      (conts || []).forEach(c => { map[c.id] = c; });
      setContactos(map);
    }
    setPedidos(peds || []);
    setLoading(false);
  }, [vendorInfo.alias]);

  useEffect(() => { cargar(); }, [cargar]);

  // Tiempo real: si Administración cambia el estado de un pedido (preparando,
  // entregado, etc.), el vendedor lo ve al instante sin recargar.
  useEffect(() => {
    const ch = supabase
      .channel(`pedidos-vend-${vendorInfo.alias}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "pedidos", filter: `vendedor=eq.${vendorInfo.alias}` },
        () => cargar())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [vendorInfo.alias, cargar]);

  useEffect(() => {
    const alerts = [];
    pedidos.forEach(p => {
      const det = parseDetEx(p.detalle);
      if (!det.fecha_entrega || p.estado === "entregado" || p.estado === "cancelado") return;
      const cont = contactos[p.contacto_id] || {};
      const nombre = cont.nombre || "Cliente";
      if (isHoy(det.fecha_entrega))
        alerts.push({ id: p.id, tipo: "hoy", texto: `Entrega / reunión HOY: ${nombre}` });
      else if (isManiana(det.fecha_entrega))
        alerts.push({ id: p.id, tipo: "maniana", texto: `Mañana: ${nombre} — ${det.tipo === "reunion" ? "reunión" : "entrega"}` });
      else if (isVencido(det.fecha_entrega))
        alerts.push({ id: p.id, tipo: "vencido", texto: `Vencida: ${nombre} (${fmtDate(det.fecha_entrega)})` });
    });
    setNotifs(alerts);
  }, [pedidos, contactos]);

  const eliminar = async (id) => {
    await supabase.from("pedidos").delete().eq("id", id);
    setConfirmElim(null);
    cargar();
  };

  const lista = pedidos.filter(p => {
    const cont = contactos[p.contacto_id] || {};
    const det = parseDetEx(p.detalle);
    const porBusq = !busqueda ||
      (cont.nombre || "").toLowerCase().includes(busqueda.toLowerCase()) ||
      (cont.telefono || "").includes(busqueda) ||
      det.observacion.toLowerCase().includes(busqueda.toLowerCase()) ||
      (det.items || []).some(i => (i.desc || "").toLowerCase().includes(busqueda.toLowerCase()));
    const porEstado = filtroEstado === "todos" || p.estado === filtroEstado;
    const porTipo   = filtroTipo === "todos" || det.tipo === filtroTipo;
    const porFecha  = !selectedDate || (det.fecha_entrega && det.fecha_entrega.startsWith(selectedDate));
    return porBusq && porEstado && porTipo && porFecha;
  });

  const stats = {
    total: pedidos.length,
    enProceso: pedidos.filter(p => ["pendiente", "confirmado", "preparando", "listo"].includes(p.estado)).length,
    entregados: pedidos.filter(p => p.estado === "entregado").length,
  };

  const alertColor = {
    hoy:     { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E", icon: "#D97706" },
    maniana: { bg: "#EFF6FF", border: "#BFDBFE", text: "#1E40AF", icon: "#1D4ED8" },
    vencido: { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B", icon: C.red },
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: L.bg, fontFamily: FONT_BODY }}>

      {/* Header */}
      <div style={{ background: L.white, borderBottom: `3px solid ${C.gold}`, padding: "10px 20px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
        <img src={LOGO_URL} alt="Nuevo Munich" style={{ height: 48, objectFit: "contain" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 14, color: L.text, textTransform: "uppercase", letterSpacing: 0.4 }}>Panel de Vendedor</div>
          <div style={{ fontSize: 12, color: L.muted }}>{vendorInfo.nombre}</div>
        </div>
        {notifs.length > 0 && (
          <button onClick={() => setShowNotifs(v => !v)} style={{ display: "flex", alignItems: "center", gap: 7, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 9, padding: "6px 12px", cursor: "pointer" }}>
            <Bell size={14} color={C.red} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: C.red }}>{notifs.length}</span>
          </button>
        )}
        {userEmail && !vendorAliasOverride && <BotonMensajes self={getIdentidadInterna(userEmail)} compact />}
        <button onClick={() => setShowPerfil(true)} title="Mis datos"
          style={{ background: L.soft, border: `1.5px solid ${L.border}`, color: L.muted, borderRadius: 9, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <UserCircle size={18} />
        </button>
        <button onClick={() => { setEditando(null); setShowForm(true); }}
          style={{ background: C.red, color: "#fff", border: "none", borderRadius: 9, padding: "8px 16px", cursor: "pointer", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 10px rgba(185,28,28,.3)" }}>
          <Plus size={15} /> Cargar
        </button>
        {onLogout && (
          <button onClick={onLogout} title="Cerrar sesión"
            style={{ background: L.soft, border: `1.5px solid ${L.border}`, color: L.muted, borderRadius: 9, width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LogOut size={15} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>

        {/* Alertas */}
        {showNotifs && notifs.length > 0 && (
          <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            {notifs.map((n, i) => {
              const col = alertColor[n.tipo];
              return (
                <div key={`${n.id}-${i}`} style={{ background: col.bg, border: `1px solid ${col.border}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <Bell size={15} color={col.icon} />
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: col.text, flex: 1 }}>{n.texto}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 18 }}>
          {[
            { icon: <ShoppingBag size={17} />, label: "Total entradas", value: stats.total, color: "#1D4ED8", bg: "#EFF6FF" },
            { icon: <Clock size={17} />,       label: "En proceso",    value: stats.enProceso, color: "#D97706", bg: "#FFFBEB" },
            { icon: <CheckCircle size={17} />, label: "Entregados",    value: stats.entregados, color: "#15803D", bg: "#DCFCE7" },
          ].map(s => (
            <div key={s.label} style={{ background: L.white, border: `1px solid ${L.border}`, borderRadius: 11, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", color: s.color, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: FONT_DISPLAY, color: s.color, marginBottom: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: L.muted, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>

          {/* Lista principal */}
          <div style={{ flex: 1, minWidth: 300 }}>

            {/* Filtros */}
            <div style={{ background: L.white, border: `1px solid ${L.border}`, borderRadius: 11, padding: "10px 14px", marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
                <Search size={12} color={L.light} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar cliente, producto…"
                  style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px 7px 26px", borderRadius: 8, border: `1.5px solid ${L.border}`, fontSize: 13, fontFamily: FONT_BODY, background: L.soft, color: L.text, outline: "none" }} />
              </div>
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
                style={{ padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${filtroTipo !== "todos" ? C.red : L.border}`, fontSize: 12.5, fontFamily: FONT_BODY, background: L.white, color: filtroTipo !== "todos" ? C.red : L.text, cursor: "pointer", outline: "none", fontWeight: 600 }}>
                <option value="todos">Todos los tipos</option>
                {TIPOS.map(t => <option key={t.k} value={t.k}>{t.label}</option>)}
              </select>
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
                style={{ padding: "7px 10px", borderRadius: 8, border: `1.5px solid ${filtroEstado !== "todos" ? C.red : L.border}`, fontSize: 12.5, fontFamily: FONT_BODY, background: L.white, color: filtroEstado !== "todos" ? C.red : L.text, cursor: "pointer", outline: "none", fontWeight: 600 }}>
                <option value="todos">Todos los estados</option>
                {Object.entries(EP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              {selectedDate && (
                <button onClick={() => setSelectedDate(null)}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  <Calendar size={11} /> {fmtDate(selectedDate)} <X size={10} />
                </button>
              )}
            </div>

            {/* Tabla */}
            {loading ? (
              <div style={{ textAlign: "center", padding: 50, color: L.muted }}>Cargando…</div>
            ) : lista.length === 0 ? (
              <div style={{ textAlign: "center", padding: 50, background: L.white, borderRadius: 12, border: `1px solid ${L.border}` }}>
                <Package size={40} color={L.border} style={{ display: "block", margin: "0 auto 10px" }} />
                <div style={{ color: L.muted, fontSize: 14, fontWeight: 600 }}>Sin entradas</div>
                <button onClick={() => { setEditando(null); setShowForm(true); }}
                  style={{ marginTop: 14, background: C.red, color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", cursor: "pointer", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Plus size={14} /> Cargar primera entrada
                </button>
              </div>
            ) : lista.map(ped => {
              const cont = contactos[ped.contacto_id] || {};
              const det = parseDetEx(ped.detalle);
              const ep = EP[ped.estado] || EP.pendiente;
              const fe = det.fecha_entrega;
              const alertaFe = fe && (isHoy(fe) || isVencido(fe));
              const borderCol = isVencido(fe) ? "#FECACA" : isHoy(fe) ? "#FDE68A" : isManiana(fe) ? "#BFDBFE" : L.border;

              return (
                <div key={ped.id}
                  style={{ background: L.white, border: `1.5px solid ${borderCol}`, borderLeft: `4px solid ${TIPOS.find(t=>t.k===det.tipo)?.color || C.red}`, borderRadius: 11, marginBottom: 9, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,.04)", transition: "box-shadow .15s" }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.08)"}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.04)"}>

                  {/* Fila superior */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <TipoBadge tipo={det.tipo} />
                      <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: L.text }}>
                        {cont.nombre || det.clienteNombre || "—"}
                      </span>
                      {cont.empresa && <span style={{ fontSize: 11.5, color: L.muted }}>· {cont.empresa}</span>}
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: ep.bg, color: ep.color, fontWeight: 700, textTransform: "uppercase" }}>{ep.label}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {fe && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 7, background: alertaFe ? (isVencido(fe) ? "#FEF2F2" : "#FFFBEB") : "#EFF6FF", border: `1px solid ${alertaFe ? (isVencido(fe) ? "#FECACA" : "#FDE68A") : "#BFDBFE"}`, fontSize: 11.5, fontWeight: 700, color: alertaFe ? (isVencido(fe) ? C.red : "#D97706") : "#1D4ED8", whiteSpace: "nowrap" }}>
                          <Calendar size={11} />
                          {fmtDate(fe)}
                          {isHoy(fe) && <span style={{ background: "#FDE68A", color: "#92400E", borderRadius: 4, padding: "1px 5px", fontSize: 9.5, fontWeight: 800 }}>HOY</span>}
                          {isManiana(fe) && <span style={{ background: "#BFDBFE", color: "#1D4ED8", borderRadius: 4, padding: "1px 5px", fontSize: 9.5, fontWeight: 800 }}>MAÑANA</span>}
                          {isVencido(fe) && <span style={{ background: "#FECACA", color: C.red, borderRadius: 4, padding: "1px 5px", fontSize: 9.5, fontWeight: 800 }}>VENCIDA</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Productos */}
                  {det.items.filter(i => i.desc?.trim()).length > 0 && (
                    <div style={{ fontSize: 13, color: L.muted, marginBottom: 6, lineHeight: 1.5 }}>
                      <span style={{ color: L.light, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3, marginRight: 6 }}>Pedido:</span>
                      {det.items.filter(i => i.desc?.trim()).slice(0, 5).map((it, idx) => (
                        <span key={idx}>{idx > 0 ? " · " : ""}
                          <strong style={{ color: L.text }}>{it.qty}×</strong> {it.desc}
                        </span>
                      ))}
                      {det.items.filter(i => i.desc?.trim()).length > 5 && <span style={{ color: L.light }}> +{det.items.filter(i=>i.desc?.trim()).length - 5} más</span>}
                    </div>
                  )}

                  {/* Observación */}
                  {det.observacion && (
                    <div style={{ fontSize: 12.5, color: "#D97706", marginBottom: 6, fontStyle: "italic" }}>
                      📝 {det.observacion.slice(0, 120)}{det.observacion.length > 120 ? "…" : ""}
                    </div>
                  )}

                  {/* Meta row */}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      {cont.telefono && <span style={{ fontSize: 11.5, color: L.muted, display: "flex", alignItems: "center", gap: 3 }}><Phone size={10} /> {cont.telefono}</span>}
                      {(det.direccion || cont.direccion) && <span style={{ fontSize: 11.5, color: L.muted, display: "flex", alignItems: "center", gap: 3 }}><MapPin size={10} /> {(det.direccion || cont.direccion || "").slice(0, 30)}</span>}
                      {det.pago && det.pago !== "A definir" && <span style={{ fontSize: 11.5, color: L.muted }}>{det.pago}</span>}
                      {det.entrega && <span style={{ fontSize: 11.5, color: L.muted }}>{det.entrega}</span>}
                      <span style={{ fontSize: 11, color: L.light }}>
                        {new Date(ped.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </span>
                    </div>
                    {/* Acciones */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => { setEditando(ped); setShowForm(true); }}
                        style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontSize: 12, color: L.muted, display: "flex", alignItems: "center", gap: 4, fontFamily: FONT_BODY, fontWeight: 600 }}>
                        <Edit2 size={11} /> Editar
                      </button>
                      <button onClick={() => imprimirPedido(ped, cont)}
                        style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontSize: 12, color: L.muted, display: "flex", alignItems: "center", gap: 4, fontFamily: FONT_BODY, fontWeight: 600 }}
                        onMouseEnter={e => { e.currentTarget.style.background = C.red; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = C.red; }}
                        onMouseLeave={e => { e.currentTarget.style.background = L.soft; e.currentTarget.style.color = L.muted; e.currentTarget.style.borderColor = L.border; }}>
                        <Download size={11} /> PDF
                      </button>
                      <button onClick={() => setConfirmElim(ped.id)}
                        style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 7, padding: "4px 8px", cursor: "pointer", color: C.red, display: "flex", alignItems: "center" }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Calendario lateral */}
          <div style={{ width: 255, flexShrink: 0 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: L.text, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <Calendar size={13} color={C.red} /> Calendario
            </div>
            <MiniCalendar pedidos={pedidos} onSelectDate={setSelectedDate} selectedDate={selectedDate} />

            {selectedDate && (
              <div style={{ marginTop: 10, background: L.white, border: `1px solid ${L.border}`, borderRadius: 11, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: L.muted, marginBottom: 8, textTransform: "capitalize" }}>
                  {new Date(selectedDate + "T12:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
                </div>
                {pedidos.filter(p => parseDetEx(p.detalle).fecha_entrega?.startsWith(selectedDate)).map(p => {
                  const cont = contactos[p.contacto_id] || {};
                  const det = parseDetEx(p.detalle);
                  const ep = EP[p.estado] || EP.pendiente;
                  return (
                    <div key={p.id} style={{ padding: "7px 0", borderTop: `1px solid ${L.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <TipoBadge tipo={det.tipo} />
                        <span style={{ fontWeight: 700, color: L.text, fontSize: 12, flex: 1 }}>{cont.nombre || "—"}</span>
                        <span style={{ padding: "1px 6px", borderRadius: 5, background: ep.bg, color: ep.color, fontSize: 10, fontWeight: 700 }}>{ep.label}</span>
                      </div>
                      {det.observacion && <div style={{ fontSize: 11, color: L.muted, marginTop: 2, fontStyle: "italic" }}>{det.observacion.slice(0, 50)}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal formulario */}
      {showForm && (
        <FormModal
          vendorAlias={vendorInfo.alias}
          editando={editando}
          contactosMap={contactos}
          onClose={() => { setShowForm(false); setEditando(null); }}
          onGuardado={cargar}
        />
      )}

      {/* Modal perfil */}
      {showPerfil && (
        <PerfilModal vendorInfo={vendorInfo} userEmail={userEmail || ""} onClose={() => setShowPerfil(false)} />
      )}

      {/* Confirmar eliminación */}
      {confirmElim && (
        <>
          <div onClick={() => setConfirmElim(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 400 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: L.white, borderRadius: 14, padding: 24, zIndex: 401, width: 320, boxShadow: "0 20px 60px rgba(0,0,0,.2)", fontFamily: FONT_BODY, textAlign: "center" }}>
            <Trash2 size={32} color={C.red} style={{ margin: "0 auto 12px" }} />
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: L.text, marginBottom: 8 }}>Eliminar entrada</div>
            <div style={{ color: L.muted, fontSize: 13, marginBottom: 20 }}>¿Seguro? Esta acción no se puede deshacer.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmElim(null)} style={{ flex: 1, background: "transparent", border: `1.5px solid ${L.border}`, borderRadius: 9, padding: 11, cursor: "pointer", color: L.muted, fontWeight: 600, fontFamily: FONT_BODY }}>Cancelar</button>
              <button onClick={() => eliminar(confirmElim)} style={{ flex: 1, background: C.red, color: "#fff", border: "none", borderRadius: 9, padding: 11, cursor: "pointer", fontFamily: FONT_DISPLAY, fontWeight: 700 }}>Eliminar</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
