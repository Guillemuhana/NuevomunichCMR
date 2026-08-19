// ============================================================
// PROMOCIONES — campañas de WhatsApp con plantillas de Meta
// ------------------------------------------------------------
// Meta sólo deja escribirle a alguien con quien no hablás hace más
// de 24 horas usando una plantilla aprobada. Así que acá no se
// escribe el mensaje: se elige una plantilla ya aprobada, se le
// completan las variables y se manda.
//
// El envío sale desde el navegador, de a un mensaje por vez. Las
// filas se crean todas antes de arrancar, en estado "pendiente":
// si cerrás la pantalla en el medio, después se retoma donde quedó.
// ============================================================
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Megaphone, Plus, Send, Users, Check, X, AlertCircle, Play, Pause,
  Search, ChevronLeft, FileText, Trash2, RefreshCw, MessageSquare, Clock,
} from "lucide-react";
import {
  supabase, C, L, R, SH, FONT_DISPLAY, FONT_BODY,
  VENDEDORES, ESTADOS, ESTADOS_ACTIVOS,
} from "./lib";
import {
  CAMPOS_CONTACTO, resolverParametros, vistaPrevia, variablesDelCuerpo,
  buscarAudiencia, procesarPendientes,
} from "./promocionesLib";

const fecha = (v) =>
  v ? new Date(v).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";
const fechaHora = (v) =>
  v ? new Date(v).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

const ESTADO_CAMPANIA = {
  borrador:  { label: "Borrador",  color: L.muted,   bg: L.soft },
  enviando:  { label: "Enviando",  color: "#B45309", bg: "#FEF3C7" },
  pausada:   { label: "Pausada",   color: "#1D4ED8", bg: "#DBEAFE" },
  terminada: { label: "Terminada", color: "#15803D", bg: "#DCFCE7" },
};

const btn = (tono = "normal") => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
  padding: "10px 18px", borderRadius: R.sm, fontSize: 13.5, fontWeight: 600,
  fontFamily: FONT_BODY, cursor: "pointer", whiteSpace: "nowrap",
  ...(tono === "primario"
    ? { background: C.red, color: "#fff", border: "none", boxShadow: SH.xs }
    : tono === "peligro"
    ? { background: L.white, color: C.red, border: `1px solid ${C.red}` }
    : { background: L.white, color: L.muted, border: `1px solid ${L.border}` }),
});

const input = {
  width: "100%", padding: "10px 12px", borderRadius: R.sm, border: `1px solid ${L.border}`,
  fontSize: 14, fontFamily: FONT_BODY, color: L.text, background: L.white, outline: "none",
  boxSizing: "border-box",
};

const rotulo = {
  display: "block", marginBottom: 6, fontSize: 11, fontWeight: 600, color: L.muted,
  fontFamily: FONT_DISPLAY, letterSpacing: ".06em", textTransform: "uppercase",
};

// ============================================================
// PANTALLA PRINCIPAL
// ============================================================
export default function Promociones({ userEmail, isMobile }) {
  const [tab, setTab]               = useState("campanias");
  const [campanias, setCampanias]   = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [abierta, setAbierta]       = useState(null);   // campaña que se está mirando
  const [nueva, setNueva]           = useState(false);
  const [falta, setFalta]           = useState(false);  // faltan las tablas en Supabase

  const cargar = useCallback(async () => {
    const [c, p] = await Promise.all([
      supabase.from("campanias").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("plantillas_wa").select("*").order("nombre"),
    ]);
    // Si las tablas todavía no existen, lo decimos en vez de mostrar todo vacío.
    if (c.error?.message?.includes("does not exist") || p.error?.message?.includes("does not exist")) {
      setFalta(true); setCargando(false); return;
    }
    setCampanias(c.data || []);
    setPlantillas(p.data || []);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Las campañas se mueven solas mientras alguien está enviando.
  useEffect(() => {
    const ch = supabase.channel("promos-campanias")
      .on("postgres_changes", { event: "*", schema: "public", table: "campanias" }, cargar)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [cargar]);

  if (falta) return <FaltanTablas />;

  if (abierta) {
    return (
      <DetalleCampania campania={abierta} plantillas={plantillas} isMobile={isMobile}
        onVolver={() => { setAbierta(null); cargar(); }} />
    );
  }

  return (
    <div className="scroll-y" style={{ flex: 1, overflowY: "auto", background: L.bg, padding: isMobile ? "16px 14px" : "26px 30px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        {/* Encabezado */}
        <div className="barra-acciones" style={{ justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: isMobile ? 19 : 23, color: L.text, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <Megaphone size={isMobile ? 19 : 22} color={C.red} /> Promociones
            </h1>
            <div style={{ fontSize: 13, color: L.muted, marginTop: 5 }}>
              Mandá una promo a todos tus contactos y mirá quién la recibió y quién contestó.
            </div>
          </div>
          {tab === "campanias" && (
            <button onClick={() => setNueva(true)} style={btn("primario")}>
              <Plus size={16} /> <span className="solo-desktop">Nueva campaña</span>
            </button>
          )}
        </div>

        {/* Pestañas */}
        <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: `1px solid ${L.border}` }}>
          {[["campanias", "Campañas", campanias.length], ["plantillas", "Plantillas", plantillas.length]].map(([k, label, n]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{
                padding: "10px 16px", background: "none", border: "none", cursor: "pointer",
                fontFamily: FONT_DISPLAY, fontSize: 13.5, fontWeight: 700, color: tab === k ? C.red : L.muted,
                borderBottom: `2px solid ${tab === k ? C.red : "transparent"}`, marginBottom: -1,
              }}>
              {label} {n > 0 && <span style={{ opacity: .6 }}>({n})</span>}
            </button>
          ))}
        </div>

        {cargando ? (
          <div style={{ padding: 60, textAlign: "center", color: L.light, fontSize: 13.5 }}>Cargando…</div>
        ) : tab === "plantillas" ? (
          <PanelPlantillas plantillas={plantillas} onCambio={cargar} />
        ) : campanias.length === 0 ? (
          <SinCampanias tienePlantillas={plantillas.length > 0}
            onNueva={() => setNueva(true)} onPlantillas={() => setTab("plantillas")} />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {campanias.map((c) => (
              <TarjetaCampania key={c.id} campania={c} onAbrir={() => setAbierta(c)} />
            ))}
          </div>
        )}
      </div>

      {nueva && (
        <AsistenteCampania plantillas={plantillas} userEmail={userEmail}
          onCerrar={() => setNueva(false)}
          onCreada={(c) => { setNueva(false); cargar(); setAbierta(c); }}
          onIrAPlantillas={() => { setNueva(false); setTab("plantillas"); }} />
      )}
    </div>
  );
}

// ============================================================
// ESTADOS VACÍOS
// ============================================================
function FaltanTablas() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: L.bg, padding: 24 }}>
      <div style={{ maxWidth: 460, textAlign: "center", background: L.white, border: `1px solid ${L.border}`, borderRadius: R.lg, padding: 30, boxShadow: SH.sm }}>
        <AlertCircle size={30} color={C.red} />
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17, color: L.text, margin: "14px 0 8px" }}>
          Falta preparar la base
        </div>
        <div style={{ fontSize: 13.5, color: L.muted, lineHeight: 1.6 }}>
          Las tablas de Promociones todavía no existen en Supabase. Abrí el
          <strong> SQL Editor</strong> y ejecutá el archivo <strong>supabase_promociones.sql</strong> que
          está en la raíz del proyecto. Después volvé a entrar acá.
        </div>
      </div>
    </div>
  );
}

function SinCampanias({ tienePlantillas, onNueva, onPlantillas }) {
  return (
    <div style={{ background: L.white, border: `1px dashed ${L.border}`, borderRadius: R.lg, padding: "48px 30px", textAlign: "center" }}>
      <Megaphone size={30} color={L.light} />
      <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17, color: L.text, margin: "14px 0 8px" }}>
        Todavía no mandaste ninguna promo
      </div>
      <div style={{ fontSize: 13.5, color: L.muted, lineHeight: 1.6, maxWidth: 430, margin: "0 auto 20px" }}>
        {tienePlantillas
          ? "Armá una campaña, elegí a quiénes les llega y mirá acá mismo quién la recibió y quién te contestó."
          : "Primero cargá una plantilla de las que ya tenés aprobadas en Meta. Sin plantilla, WhatsApp no deja escribirle a alguien que no te habló en las últimas 24 horas."}
      </div>
      <button onClick={tienePlantillas ? onNueva : onPlantillas} style={btn("primario")}>
        {tienePlantillas ? <><Plus size={16} /> Crear la primera campaña</> : <><FileText size={16} /> Cargar una plantilla</>}
      </button>
    </div>
  );
}

// ============================================================
// TARJETA DE CAMPAÑA
// ============================================================
function TarjetaCampania({ campania: c, onAbrir }) {
  const est = ESTADO_CAMPANIA[c.estado] || ESTADO_CAMPANIA.borrador;
  const hechos = (c.enviados || 0) + (c.fallidos || 0);
  const pct = c.total ? Math.round((hechos / c.total) * 100) : 0;

  return (
    <button onClick={onAbrir}
      style={{ display: "block", width: "100%", textAlign: "left", background: L.white, border: `1px solid ${L.border}`, borderRadius: R.md, padding: "15px 17px", cursor: "pointer", fontFamily: FONT_BODY, boxShadow: SH.xs, transition: "border-color .15s, box-shadow .15s" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.boxShadow = SH.md; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = L.border; e.currentTarget.style.boxShadow = SH.xs; }}>

      <div className="barra-acciones" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15.5, color: L.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {c.nombre}
          </div>
          <div style={{ fontSize: 12, color: L.light, marginTop: 3 }}>
            {c.plantilla} · {fecha(c.created_at)}
          </div>
        </div>
        <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: "4px 11px", borderRadius: R.pill, background: est.bg, color: est.color, textTransform: "uppercase", letterSpacing: ".04em" }}>
          {est.label}
        </span>
      </div>

      <div style={{ height: 6, background: L.soft, borderRadius: 99, overflow: "hidden", marginBottom: 9 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: c.fallidos ? `linear-gradient(90deg, #22C55E ${c.total ? (c.enviados / c.total) * 100 : 0}%, #EF4444 0%)` : "#22C55E", transition: "width .3s" }} />
      </div>

      <div style={{ display: "flex", gap: 16, fontSize: 12.5, color: L.muted, flexWrap: "wrap" }}>
        <span><strong style={{ color: L.text }}>{c.total || 0}</strong> destinatarios</span>
        <span style={{ color: "#15803D" }}><strong>{c.enviados || 0}</strong> enviados</span>
        {!!c.fallidos && <span style={{ color: "#B42318" }}><strong>{c.fallidos}</strong> fallaron</span>}
      </div>
    </button>
  );
}

// ============================================================
// ASISTENTE PARA CREAR LA CAMPAÑA
// ============================================================
function AsistenteCampania({ plantillas, userEmail, onCerrar, onCreada, onIrAPlantillas }) {
  const activas = plantillas.filter((p) => p.activa);
  const [paso, setPaso]           = useState(1);
  const [nombre, setNombre]       = useState("");
  const [plantillaId, setPlantillaId] = useState(activas[0]?.id || "");
  const [estados, setEstados]     = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [soloConCharla, setSoloConCharla] = useState(false);
  const [audiencia, setAudiencia] = useState([]);
  const [buscando, setBuscando]   = useState(false);
  const [params, setParams]       = useState([]);
  const [confirmo, setConfirmo]   = useState(false);
  const [creando, setCreando]     = useState(false);
  const [error, setError]         = useState("");

  const plantilla = activas.find((p) => p.id === plantillaId);
  const numsVariables = useMemo(() => variablesDelCuerpo(plantilla?.cuerpo), [plantilla]);

  // Al cambiar de plantilla, arrancamos las variables con algo razonable:
  // la primera suele ser el nombre del cliente.
  useEffect(() => {
    setParams(numsVariables.map((n) => ({
      num: n,
      tipo: n === 1 ? "campo" : "fijo",
      valor: n === 1 ? "primer_nombre" : "",
    })));
  }, [plantillaId, numsVariables.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // La audiencia se recalcula sola cuando tocás un filtro.
  useEffect(() => {
    if (paso !== 2) return;
    let vivo = true;
    setBuscando(true);
    buscarAudiencia({ estados, vendedores, soloConCharla })
      .then((l) => { if (vivo) setAudiencia(l); })
      .catch((e) => { if (vivo) setError(e.message); })
      .finally(() => { if (vivo) setBuscando(false); });
    return () => { vivo = false; };
  }, [paso, estados, vendedores, soloConCharla]);

  const alternar = (lista, set, v) =>
    set(lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  const ejemplo = audiencia[0] || { nombre: "Juan Pérez", empresa: "Kiosco Don Pepe", vendedor: "Boris", telefono: "5493510000000" };
  const previa = vistaPrevia(plantilla?.cuerpo, resolverParametros(params, ejemplo));

  const puedeSeguir =
    paso === 1 ? !!nombre.trim() && !!plantilla :
    paso === 2 ? audiencia.length > 0 :
    params.every((p) => p.tipo === "campo" ? !!p.valor : !!String(p.valor).trim());

  const crear = async () => {
    setCreando(true); setError("");
    try {
      const { data: campania, error: e1 } = await supabase.from("campanias").insert({
        nombre: nombre.trim(),
        plantilla_id: plantilla.id,
        plantilla: plantilla.nombre,
        idioma: plantilla.idioma,
        parametros: params,
        filtros: { estados, vendedores, soloConCharla },
        estado: "borrador",
        total: audiencia.length,
        creada_por: userEmail || null,
      }).select().single();
      if (e1) throw new Error(e1.message);

      // Una fila por contacto, con las variables ya resueltas. Van de a
      // 500 porque Supabase corta los insert muy grandes.
      const filas = audiencia.map((c) => ({
        campania_id: campania.id,
        contacto_id: c.id,
        telefono: String(c.telefono).replace(/\D/g, ""),
        nombre: c.nombre || null,
        parametros: resolverParametros(params, c),
      }));
      for (let i = 0; i < filas.length; i += 500) {
        const { error: e2 } = await supabase.from("campania_envios").insert(filas.slice(i, i + 500));
        if (e2) throw new Error(e2.message);
      }
      onCreada(campania);
    } catch (e) {
      setError(e.message);
      setCreando(false);
    }
  };

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,.45)", backdropFilter: "blur(3px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 640, maxHeight: "92vh", background: L.white, borderRadius: R.xl, boxShadow: SH.xl, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: FONT_BODY }}>

        {/* Cabecera con los pasos */}
        <div style={{ padding: "18px 22px 0", borderBottom: `1px solid ${L.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17, color: L.text }}>Nueva campaña</div>
            <button onClick={onCerrar} style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: R.sm, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: L.muted }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, paddingBottom: 12 }}>
            {["Plantilla", "A quiénes", "Revisar"].map((t, i) => (
              <div key={t} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ height: 3, borderRadius: 99, background: paso >= i + 1 ? C.red : L.border, marginBottom: 6 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: paso >= i + 1 ? C.red : L.light, fontFamily: FONT_DISPLAY, textTransform: "uppercase", letterSpacing: ".05em" }}>
                  {i + 1}. {t}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="scroll-y" style={{ padding: 22, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>

          {/* ── Paso 1: plantilla ── */}
          {paso === 1 && (activas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "26px 10px" }}>
              <FileText size={26} color={L.light} />
              <div style={{ fontSize: 14, color: L.text, fontWeight: 600, margin: "12px 0 6px" }}>No hay plantillas cargadas</div>
              <div style={{ fontSize: 13, color: L.muted, lineHeight: 1.6, marginBottom: 16 }}>
                Cargá primero una de las plantillas que ya tenés aprobadas en Meta.
              </div>
              <button onClick={onIrAPlantillas} style={btn("primario")}>Ir a Plantillas</button>
            </div>
          ) : (
            <>
              <div>
                <label style={rotulo}>Nombre de la campaña</label>
                <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)}
                  placeholder="Promo de agosto" style={input} />
                <div style={{ fontSize: 11.5, color: L.light, marginTop: 5 }}>Es para vos: el cliente no lo ve.</div>
              </div>
              <div>
                <label style={rotulo}>Plantilla aprobada</label>
                <div style={{ display: "grid", gap: 8 }}>
                  {activas.map((p) => (
                    <button key={p.id} onClick={() => setPlantillaId(p.id)}
                      style={{ textAlign: "left", padding: "12px 14px", borderRadius: R.sm, border: `1px solid ${p.id === plantillaId ? C.red : L.border}`, background: p.id === plantillaId ? C.redSoft : L.white, cursor: "pointer", fontFamily: FONT_BODY }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: L.text }}>{p.nombre}</div>
                      <div style={{ fontSize: 12, color: L.muted, marginTop: 4, lineHeight: 1.5 }}>
                        {(p.cuerpo || "").slice(0, 120) || "Sin texto de referencia"}
                      </div>
                      <div style={{ fontSize: 11, color: L.light, marginTop: 5 }}>{p.idioma}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ))}

          {/* ── Paso 2: audiencia ── */}
          {paso === 2 && (
            <>
              <div style={{ background: C.redSoft, border: `1px solid ${C.red}33`, borderRadius: R.md, padding: "16px 18px", textAlign: "center" }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 800, color: C.red, lineHeight: 1 }}>
                  {buscando ? "…" : audiencia.length}
                </div>
                <div style={{ fontSize: 12.5, color: L.muted, marginTop: 5 }}>
                  {audiencia.length === 1 ? "contacto va a recibir la promo" : "contactos van a recibir la promo"}
                </div>
              </div>

              <div>
                <label style={rotulo}>Estado en el pipeline</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ESTADOS_ACTIVOS.map((e) => (
                    <Pastilla key={e} activa={estados.includes(e)} onClick={() => alternar(estados, setEstados, e)}>
                      {ESTADOS[e]?.label || e}
                    </Pastilla>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: L.light, marginTop: 6 }}>Sin elegir ninguno, entran todos.</div>
              </div>

              <div>
                <label style={rotulo}>Vendedor asignado</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {VENDEDORES.map((v) => (
                    <Pastilla key={v} activa={vendedores.includes(v)} onClick={() => alternar(vendedores, setVendedores, v)}>
                      {v}
                    </Pastilla>
                  ))}
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", background: L.soft, border: `1px solid ${L.border}`, borderRadius: R.sm, padding: "12px 14px" }}>
                <input type="checkbox" checked={soloConCharla} onChange={(e) => setSoloConCharla(e.target.checked)} style={{ marginTop: 2 }} />
                <span style={{ fontSize: 13, color: L.text, lineHeight: 1.5 }}>
                  Sólo a los que alguna vez nos escribieron
                  <span style={{ display: "block", fontSize: 11.5, color: L.muted, marginTop: 2 }}>
                    Más seguro: son contactos que ya te conocen y es menos probable que te reporten.
                  </span>
                </span>
              </label>

              {audiencia.length > 0 && (
                <div>
                  <label style={rotulo}>Algunos de los que van a recibirla</label>
                  <div style={{ border: `1px solid ${L.border}`, borderRadius: R.sm, overflow: "hidden" }}>
                    {audiencia.slice(0, 5).map((c, i) => (
                      <div key={c.id} style={{ padding: "9px 13px", fontSize: 13, color: L.text, borderTop: i ? `1px solid ${L.border}` : "none", display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nombre || "(sin nombre)"}</span>
                        <span style={{ color: L.light, flexShrink: 0 }}>{c.telefono}</span>
                      </div>
                    ))}
                    {audiencia.length > 5 && (
                      <div style={{ padding: "8px 13px", fontSize: 12, color: L.light, borderTop: `1px solid ${L.border}`, background: L.soft }}>
                        y {audiencia.length - 5} más
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Paso 3: variables y revisión ── */}
          {paso === 3 && (
            <>
              {params.length > 0 && (
                <div>
                  <label style={rotulo}>Qué va en cada hueco de la plantilla</label>
                  <div style={{ display: "grid", gap: 10 }}>
                    {params.map((p, i) => (
                      <div key={p.num} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ flexShrink: 0, width: 42, height: 34, borderRadius: R.sm, background: C.redSoft, color: C.red, fontWeight: 800, fontSize: 12.5, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY }}>
                          {`{{${p.num}}}`}
                        </span>
                        <select value={p.tipo}
                          onChange={(e) => setParams(params.map((x, j) => j === i ? { ...x, tipo: e.target.value, valor: e.target.value === "campo" ? "primer_nombre" : "" } : x))}
                          style={{ ...input, width: "auto", flexShrink: 0 }}>
                          <option value="campo">Dato del cliente</option>
                          <option value="fijo">Texto fijo</option>
                        </select>
                        {p.tipo === "campo" ? (
                          <select value={p.valor} onChange={(e) => setParams(params.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))}
                            style={{ ...input, flex: 1, minWidth: 150 }}>
                            {CAMPOS_CONTACTO.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                          </select>
                        ) : (
                          <input value={p.valor} onChange={(e) => setParams(params.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))}
                            placeholder="Ej: 20%" style={{ ...input, flex: 1, minWidth: 150 }} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label style={rotulo}>Así le va a llegar a {ejemplo.nombre || "un cliente"}</label>
                <div style={{ background: "#E7F3E4", borderRadius: R.md, padding: "13px 15px", fontSize: 13.5, color: "#111B21", lineHeight: 1.55, whiteSpace: "pre-wrap", border: "1px solid #CFE6C9" }}>
                  {previa || "La plantilla no tiene texto de referencia cargado."}
                </div>
                <div style={{ fontSize: 11.5, color: L.light, marginTop: 6 }}>
                  El texto real es el que tenés aprobado en Meta; esto es la copia que cargaste.
                </div>
              </div>

              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: R.md, padding: "13px 15px" }}>
                <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <AlertCircle size={17} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12.5, color: "#7C2D12", lineHeight: 1.55 }}>
                    Se le va a mandar a <strong>{audiencia.length} personas</strong> y no se puede deshacer.
                    Los mensajes salen de a uno, con una pausa entre cada uno.
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 11, cursor: "pointer", fontSize: 13, color: "#7C2D12", fontWeight: 600 }}>
                  <input type="checkbox" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} />
                  Entiendo, quiero crear la campaña
                </label>
              </div>
            </>
          )}

          {error && (
            <div style={{ padding: "10px 13px", borderRadius: R.sm, background: C.redSoft, color: C.redDark, fontSize: 13, border: `1px solid ${C.red}33` }}>
              {error}
            </div>
          )}
        </div>

        {/* Pie */}
        <div style={{ padding: "14px 22px", borderTop: `1px solid ${L.border}`, display: "flex", justifyContent: "space-between", gap: 10 }}>
          <button onClick={() => (paso === 1 ? onCerrar() : setPaso(paso - 1))} style={btn()}>
            {paso === 1 ? "Cancelar" : <><ChevronLeft size={15} /> Atrás</>}
          </button>
          {paso < 3 ? (
            <button onClick={() => setPaso(paso + 1)} disabled={!puedeSeguir}
              style={{ ...btn("primario"), opacity: puedeSeguir ? 1 : .45, cursor: puedeSeguir ? "pointer" : "default" }}>
              Siguiente
            </button>
          ) : (
            <button onClick={crear} disabled={!puedeSeguir || !confirmo || creando}
              style={{ ...btn("primario"), opacity: puedeSeguir && confirmo && !creando ? 1 : .45, cursor: puedeSeguir && confirmo && !creando ? "pointer" : "default" }}>
              {creando ? "Creando…" : <>Crear campaña</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Pastilla({ activa, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ padding: "6px 13px", borderRadius: R.pill, border: `1px solid ${activa ? C.red : L.border}`, background: activa ? C.redSoft : L.white, color: activa ? C.red : L.muted, fontSize: 12.5, fontWeight: 600, fontFamily: FONT_BODY, cursor: "pointer" }}>
      {children}
    </button>
  );
}

// ============================================================
// DETALLE DE LA CAMPAÑA (y motor de envío)
// ============================================================
function DetalleCampania({ campania: inicial, isMobile, onVolver }) {
  const [campania, setCampania] = useState(inicial);
  const [envios, setEnvios]     = useState([]);
  const [filtro, setFiltro]     = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [ultimo, setUltimo]     = useState("");
  const [error, setError]       = useState("");
  const seguirRef = useRef(false);

  const cargar = useCallback(async () => {
    const [c, e] = await Promise.all([
      supabase.from("campanias").select("*").eq("id", inicial.id).single(),
      supabase.from("campania_envios").select("*").eq("campania_id", inicial.id).order("created_at").limit(3000),
    ]);
    if (c.data) setCampania(c.data);
    setEnvios(e.data || []);
  }, [inicial.id]);

  useEffect(() => { cargar(); }, [cargar]);

  // Mientras sale el envío, la lista se refresca sola.
  useEffect(() => {
    const ch = supabase.channel(`camp-${inicial.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campania_envios", filter: `campania_id=eq.${inicial.id}` }, cargar)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [inicial.id, cargar]);

  // Si te vas de la pantalla, frenamos el envío en vez de dejarlo colgado.
  useEffect(() => () => { seguirRef.current = false; }, []);

  const stats = useMemo(() => ({
    total:      envios.length,
    enviados:   envios.filter((e) => e.estado === "enviado").length,
    fallidos:   envios.filter((e) => e.estado === "fallido").length,
    pendientes: envios.filter((e) => e.estado === "pendiente").length,
    respuestas: envios.filter((e) => e.respondido_at).length,
  }), [envios]);

  const arrancar = async () => {
    setError(""); setEnviando(true); seguirRef.current = true;
    await supabase.from("campanias").update({
      estado: "enviando",
      iniciada_at: campania.iniciada_at || new Date().toISOString(),
    }).eq("id", campania.id);

    try {
      await procesarPendientes(campania, () => seguirRef.current, (p) => setUltimo(p.ultimo));
    } catch (e) {
      setError(e.message);
    }

    const quedan = seguirRef.current;
    seguirRef.current = false;
    setEnviando(false);
    setUltimo("");

    const { count } = await supabase.from("campania_envios")
      .select("id", { count: "exact", head: true })
      .eq("campania_id", campania.id).eq("estado", "pendiente");

    await supabase.from("campanias").update({
      estado: count ? (quedan ? "pausada" : "pausada") : "terminada",
      terminada_at: count ? null : new Date().toISOString(),
    }).eq("id", campania.id);
    cargar();
  };

  const frenar = () => { seguirRef.current = false; };

  const lista = envios.filter((e) => {
    const porEstado =
      filtro === "todos"      ? true :
      filtro === "respuestas" ? !!e.respondido_at :
      e.estado === filtro;
    const b = busqueda.trim().toLowerCase();
    const porBusq = !b || (e.nombre || "").toLowerCase().includes(b) || (e.telefono || "").includes(b);
    return porEstado && porBusq;
  });

  const est = ESTADO_CAMPANIA[campania.estado] || ESTADO_CAMPANIA.borrador;
  const hechos = stats.enviados + stats.fallidos;
  const pct = stats.total ? Math.round((hechos / stats.total) * 100) : 0;

  return (
    <div className="scroll-y" style={{ flex: 1, overflowY: "auto", background: L.bg, padding: isMobile ? "16px 14px" : "26px 30px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        <button onClick={onVolver} style={{ ...btn(), marginBottom: 16 }}>
          <ChevronLeft size={15} /> Volver a campañas
        </button>

        {/* Encabezado */}
        <div className="barra-acciones" style={{ justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: isMobile ? 18 : 22, color: L.text, margin: 0 }}>
              {campania.nombre}
            </h1>
            <div style={{ fontSize: 12.5, color: L.muted, marginTop: 5, display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: R.pill, background: est.bg, color: est.color, textTransform: "uppercase" }}>
                {est.label}
              </span>
              <span>{campania.plantilla} · {campania.idioma}</span>
              {campania.iniciada_at && <span>Empezó {fechaHora(campania.iniciada_at)}</span>}
            </div>
          </div>

          {stats.pendientes > 0 && (
            enviando ? (
              <button onClick={frenar} style={btn("peligro")}><Pause size={16} /> Pausar</button>
            ) : (
              <button onClick={arrancar} style={btn("primario")}>
                <Play size={16} /> {hechos ? `Retomar (${stats.pendientes})` : `Comenzar envío (${stats.pendientes})`}
              </button>
            )
          )}
        </div>

        {/* Progreso mientras manda */}
        {enviando && (
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: R.md, padding: "12px 15px", marginBottom: 16, display: "flex", alignItems: "center", gap: 11 }}>
            <RefreshCw size={16} color="#B45309" style={{ animation: "mnSpin 1s linear infinite", flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: "#7C2D12", minWidth: 0 }}>
              Mandando… {ultimo && <>último: <strong>{ultimo}</strong></>}
              <span style={{ display: "block", fontSize: 11.5, marginTop: 2 }}>
                No cierres esta pantalla. Si la cerrás, la campaña queda pausada y después la retomás.
              </span>
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: "11px 14px", borderRadius: R.sm, background: C.redSoft, color: C.redDark, fontSize: 13, border: `1px solid ${C.red}33`, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Números */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? 140 : 160}px, 1fr))`, gap: 10, marginBottom: 18 }}>
          <Tarjeta icono={Users}         color={L.muted}   valor={stats.total}      titulo="Destinatarios" />
          <Tarjeta icono={Check}         color="#15803D"   valor={stats.enviados}   titulo="Entregados a Meta" />
          <Tarjeta icono={MessageSquare} color="#1D4ED8"   valor={stats.respuestas} titulo="Contestaron"
            pie={stats.enviados ? `${Math.round((stats.respuestas / stats.enviados) * 100)}% de los enviados` : null} />
          <Tarjeta icono={AlertCircle}   color="#B42318"   valor={stats.fallidos}   titulo="Fallaron" />
          {stats.pendientes > 0 && <Tarjeta icono={Clock} color="#B45309" valor={stats.pendientes} titulo="Sin mandar" />}
        </div>

        {/* Barra de avance */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: L.muted, marginBottom: 6 }}>
            <span>{hechos} de {stats.total}</span><span>{pct}%</span>
          </div>
          <div style={{ height: 8, background: L.soft, borderRadius: 99, overflow: "hidden", display: "flex" }}>
            <div style={{ width: `${stats.total ? (stats.enviados / stats.total) * 100 : 0}%`, background: "#22C55E", transition: "width .3s" }} />
            <div style={{ width: `${stats.total ? (stats.fallidos / stats.total) * 100 : 0}%`, background: "#EF4444", transition: "width .3s" }} />
          </div>
        </div>

        {/* Lista de destinatarios */}
        <div className="barra-acciones" style={{ marginBottom: 10, gap: 8 }}>
          {[["todos", "Todos", stats.total], ["enviado", "Enviados", stats.enviados],
            ["respuestas", "Contestaron", stats.respuestas], ["fallido", "Fallaron", stats.fallidos],
            ["pendiente", "Sin mandar", stats.pendientes]].map(([k, label, n]) => (
            <Pastilla key={k} activa={filtro === k} onClick={() => setFiltro(k)}>{label} ({n})</Pastilla>
          ))}
          <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
            <Search size={14} color={L.light} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar destinatario…"
              style={{ ...input, padding: "8px 12px 8px 32px", fontSize: 13 }} />
          </div>
        </div>

        <div style={{ background: L.white, border: `1px solid ${L.border}`, borderRadius: R.md, overflow: "hidden" }}>
          {lista.length === 0 ? (
            <div style={{ padding: 34, textAlign: "center", color: L.light, fontSize: 13 }}>Nada para mostrar acá.</div>
          ) : lista.slice(0, 300).map((e, i) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderTop: i ? `1px solid ${L.border}` : "none" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: L.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {e.nombre || "(sin nombre)"}
                </div>
                <div style={{ fontSize: 11.5, color: L.light, marginTop: 2 }}>
                  {e.telefono}
                  {e.enviado_at && ` · ${fechaHora(e.enviado_at)}`}
                </div>
                {e.error && (
                  <div style={{ fontSize: 11.5, color: "#B42318", marginTop: 3 }}>{e.error}</div>
                )}
              </div>
              {e.respondido_at && (
                <span title={`Contestó el ${fechaHora(e.respondido_at)}`}
                  style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: R.pill, background: "#DBEAFE", color: "#1D4ED8" }}>
                  Contestó
                </span>
              )}
              <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: R.pill,
                background: e.estado === "enviado" ? "#DCFCE7" : e.estado === "fallido" ? "#FEE4E2" : L.soft,
                color: e.estado === "enviado" ? "#15803D" : e.estado === "fallido" ? "#B42318" : L.muted }}>
                {e.estado === "enviado" ? "Enviado" : e.estado === "fallido" ? "Falló" : "Pendiente"}
              </span>
            </div>
          ))}
          {lista.length > 300 && (
            <div style={{ padding: "10px 14px", fontSize: 12, color: L.light, borderTop: `1px solid ${L.border}`, background: L.soft }}>
              Mostrando 300 de {lista.length}. Filtrá o buscá para achicar la lista.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Tarjeta({ icono: Icon, color, valor, titulo, pie }) {
  return (
    <div style={{ background: L.white, border: `1px solid ${L.border}`, borderRadius: R.md, padding: "13px 15px", boxShadow: SH.xs }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
        <Icon size={14} color={color} />
        <span style={{ fontSize: 11, fontWeight: 600, color: L.muted, fontFamily: FONT_DISPLAY, textTransform: "uppercase", letterSpacing: ".05em" }}>{titulo}</span>
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 25, fontWeight: 800, color: L.text, lineHeight: 1 }}>{valor}</div>
      {pie && <div style={{ fontSize: 11, color: L.light, marginTop: 4 }}>{pie}</div>}
    </div>
  );
}

// ============================================================
// PLANTILLAS
// ============================================================
function PanelPlantillas({ plantillas, onCambio }) {
  const [modal, setModal] = useState(null);   // {} = nueva | fila = editar

  const borrar = async (p) => {
    if (!window.confirm(`¿Borrar la plantilla "${p.nombre}"? Las campañas ya hechas no se tocan.`)) return;
    await supabase.from("plantillas_wa").delete().eq("id", p.id);
    onCambio();
  };

  return (
    <>
      <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: R.md, padding: "13px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <AlertCircle size={17} color="#1D4ED8" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12.5, color: "#1E3A8A", lineHeight: 1.55 }}>
          Las plantillas se crean y se aprueban <strong>en Meta</strong>, no acá. En esta pantalla sólo anotás
          las que ya tenés aprobadas, para que el CRM sepa cómo mandarlas. El nombre y el idioma
          tienen que coincidir <strong>exactamente</strong> con los de Meta.
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={() => setModal({})} style={btn("primario")}><Plus size={16} /> Cargar plantilla</button>
      </div>

      {plantillas.length === 0 ? (
        <div style={{ background: L.white, border: `1px dashed ${L.border}`, borderRadius: R.lg, padding: "40px 26px", textAlign: "center", color: L.muted, fontSize: 13.5 }}>
          Todavía no cargaste ninguna plantilla.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {plantillas.map((p) => (
            <div key={p.id} style={{ background: L.white, border: `1px solid ${L.border}`, borderRadius: R.md, padding: "14px 16px", boxShadow: SH.xs }}>
              <div className="barra-acciones" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14.5, color: L.text }}>
                    {p.nombre}
                    {!p.activa && <span style={{ marginLeft: 8, fontSize: 11, color: L.light, fontWeight: 600 }}>(desactivada)</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: L.light, marginTop: 3 }}>{p.idioma} · {p.categoria}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setModal(p)} style={{ ...btn(), padding: "7px 12px", fontSize: 12.5 }}>Editar</button>
                  <button onClick={() => borrar(p)} title="Borrar"
                    style={{ ...btn(), padding: "7px 10px", color: C.red }}><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ background: "#E7F3E4", border: "1px solid #CFE6C9", borderRadius: R.sm, padding: "10px 12px", fontSize: 13, color: "#111B21", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {p.cuerpo || "Sin texto de referencia"}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <ModalPlantilla plantilla={modal} onCerrar={() => setModal(null)} onGuardada={() => { setModal(null); onCambio(); }} />}
    </>
  );
}

function ModalPlantilla({ plantilla, onCerrar, onGuardada }) {
  const nueva = !plantilla?.id;
  const [nombre, setNombre]   = useState(plantilla?.nombre || "");
  const [idioma, setIdioma]   = useState(plantilla?.idioma || "es_AR");
  const [categoria, setCat]   = useState(plantilla?.categoria || "MARKETING");
  const [cuerpo, setCuerpo]   = useState(plantilla?.cuerpo || "");
  const [activa, setActiva]   = useState(plantilla?.activa ?? true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]     = useState("");

  const nums = variablesDelCuerpo(cuerpo);

  const guardar = async () => {
    if (!nombre.trim()) { setError("Poné el nombre exacto que tiene en Meta."); return; }
    setGuardando(true); setError("");
    const fila = {
      nombre: nombre.trim(), idioma: idioma.trim(), categoria,
      cuerpo: cuerpo.trim() || null,
      variables: nums.map((n) => ({ num: n })),
      activa,
    };
    const { error: e } = nueva
      ? await supabase.from("plantillas_wa").insert(fila)
      : await supabase.from("plantillas_wa").update(fila).eq("id", plantilla.id);
    setGuardando(false);
    if (e) { setError(e.message.includes("duplicate") ? "Ya cargaste una plantilla con ese nombre e idioma." : e.message); return; }
    onGuardada();
  };

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(16,24,40,.45)", backdropFilter: "blur(3px)", zIndex: 420, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 540, maxHeight: "92vh", overflowY: "auto", background: L.white, borderRadius: R.xl, boxShadow: SH.xl, fontFamily: FONT_BODY }}>
        <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${L.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16.5, color: L.text }}>
            {nueva ? "Cargar plantilla" : "Editar plantilla"}
          </div>
          <button onClick={onCerrar} style={{ background: L.soft, border: `1px solid ${L.border}`, borderRadius: R.sm, width: 32, height: 32, cursor: "pointer", color: L.muted, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={rotulo}>Nombre exacto en Meta</label>
            <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)}
              placeholder="promo_agosto" style={input} />
            <div style={{ fontSize: 11.5, color: L.light, marginTop: 5 }}>
              Tal cual figura en el Administrador de WhatsApp: todo en minúscula y con guiones bajos.
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={rotulo}>Idioma</label>
              <input value={idioma} onChange={(e) => setIdioma(e.target.value)} placeholder="es_AR" style={input} />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={rotulo}>Categoría</label>
              <select value={categoria} onChange={(e) => setCat(e.target.value)} style={input}>
                <option value="MARKETING">Marketing</option>
                <option value="UTILITY">Utilidad</option>
                <option value="AUTHENTICATION">Autenticación</option>
              </select>
            </div>
          </div>

          <div>
            <label style={rotulo}>Copia del texto</label>
            <textarea value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={5}
              placeholder={"Hola {{1}}! Esta semana tenemos {{2}} de descuento en toda la línea. Te esperamos."}
              style={{ ...input, resize: "vertical", lineHeight: 1.5 }} />
            <div style={{ fontSize: 11.5, color: L.light, marginTop: 5, lineHeight: 1.5 }}>
              Pegá el mismo texto que aprobaste, con los huecos <strong>{"{{1}}"}</strong>, <strong>{"{{2}}"}</strong>… donde
              van las variables. Sirve para la vista previa y para saber cuántos datos hay que completar.
            </div>
            {nums.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: C.red, fontWeight: 600 }}>
                Detecté {nums.length} {nums.length === 1 ? "variable" : "variables"}: {nums.map((n) => `{{${n}}}`).join(", ")}
              </div>
            )}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: 13.5, color: L.text }}>
            <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
            Disponible para usar en campañas
          </label>

          {error && (
            <div style={{ padding: "10px 13px", borderRadius: R.sm, background: C.redSoft, color: C.redDark, fontSize: 13, border: `1px solid ${C.red}33` }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: "14px 22px", borderTop: `1px solid ${L.border}`, display: "flex", justifyContent: "flex-end", gap: 9 }}>
          <button onClick={onCerrar} style={btn()}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={{ ...btn("primario"), opacity: guardando ? .6 : 1 }}>
            <Send size={15} /> {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
