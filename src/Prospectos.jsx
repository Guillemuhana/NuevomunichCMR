import { useState } from "react";

const N8N_WEBHOOK = "https://ntg-group.app.n8n.cloud/webhook/munich-prospectos-buscar";

const PRIORIDAD_COLOR = {
  ALTA: { bg: "#fee2e2", text: "#dc2626", border: "#fca5a5" },
  MEDIA: { bg: "#fef9c3", text: "#ca8a04", border: "#fde047" },
  BAJA: { bg: "#f0fdf4", text: "#16a34a", border: "#86efac" },
};

export default function Prospectos() {
  const [busqueda, setBusqueda] = useState("");
  const [zona, setZona] = useState("Córdoba Centro");
  const [cargando, setCargando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [error, setError] = useState(null);
  const [busquedaHecha, setBusquedaHecha] = useState(false);
  const [filtro, setFiltro] = useState("TODOS");
  const [vendedorAsignado, setVendedorAsignado] = useState({});

  const ZONAS = ["Córdoba Centro","Nueva Córdoba","Güemes","Palermo","Alta Córdoba","Villa Cabrera","Cerro de las Rosas","Villa Allende","Río Ceballos","Villa Carlos Paz","La Calera","Jesús María","Bell Ville","Río Cuarto"];
  const RUBROS = ["Fiambrería","Almacén","Restaurante","Sandwichería","Vinoteca","Dietética","Rotisería","Bar","Café","Mercado gourmet","Panadería","Supermercado"];
  const VENDEDORES = ["Sin asignar","Cristian","Vendedor 1","Vendedor 2","Vendedor 3"];

  const buscar = async () => {
    if (!busqueda.trim()) return;
    setCargando(true); setError(null); setResultados([]); setBusquedaHecha(false);
    try {
      const res = await fetch(N8N_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ busqueda: busqueda.trim(), zona, query_completo: `${busqueda.trim()} en ${zona} Argentina` }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const lista = Array.isArray(data) ? data : data.resultados || data.leads || [];
      setResultados(lista); setBusquedaHecha(true);
    } catch {
      setError("No se pudo conectar con n8n. Verificá que el workflow esté activo.");
    } finally { setCargando(false); }
  };

  const filtrados = resultados.filter(r => filtro === "TODOS" || r.prioridad === filtro);
  const conteo = { TODOS: resultados.length, ALTA: resultados.filter(r=>r.prioridad==="ALTA").length, MEDIA: resultados.filter(r=>r.prioridad==="MEDIA").length, BAJA: resultados.filter(r=>r.prioridad==="BAJA").length };

  const exportarCSV = () => {
    if (!filtrados.length) return;
    const headers = ["Prioridad","Score","Nombre","Dirección","Teléfono","Email","Web","Productos sugeridos","Enfoque de venta","Vendedor"];
    const rows = filtrados.map(r => [r.prioridad||"",r.lead_score||"",`"${r.nombre||""}"`,`"${r.direccion||""}"`,r.telefono||"",Array.isArray(r.email)?r.email.join("|"):(r.email||""),r.sitio_web||"",`"${r.productos_sugeridos||""}"`,`"${r.enfoque_venta||""}"`,vendedorAsignado[r.place_id]||"Sin asignar"]);
    const csv = [headers.join(","),...rows.map(r=>r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `prospectos_${busqueda}_${new Date().toLocaleDateString("es-AR").replace(/\//g,"-")}.csv`; a.click();
  };

  return (
    <div style={{padding:"24px",maxWidth:1100,margin:"0 auto",fontFamily:"Inter,sans-serif"}}>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:26,fontWeight:800,color:"#1e293b",marginBottom:4}}>🔍 Búsqueda de Prospectos</h1>
        <p style={{color:"#64748b",fontSize:14}}>Buscá negocios en cualquier zona. La IA los analiza y los organiza como hoja de ruta para los vendedores.</p>
      </div>

      <div style={{background:"#fff",borderRadius:16,padding:24,boxShadow:"0 1px 3px rgba(0,0,0,0.1)",marginBottom:24,border:"1px solid #e2e8f0"}}>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16}}>
          <div style={{flex:2,minWidth:220}}>
            <label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:6}}>RUBRO O TIPO DE NEGOCIO</label>
            <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} onKeyDown={e=>e.key==="Enter"&&buscar()} placeholder="Ej: fiambrería, restaurante, almacén..." style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"1px solid #e2e8f0",fontSize:15,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div style={{flex:1,minWidth:180}}>
            <label style={{fontSize:12,fontWeight:600,color:"#64748b",display:"block",marginBottom:6}}>ZONA</label>
            <select value={zona} onChange={e=>setZona(e.target.value)} style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"1px solid #e2e8f0",fontSize:15,outline:"none",background:"#fff",boxSizing:"border-box"}}>
              {ZONAS.map(z=><option key={z}>{z}</option>)}
            </select>
          </div>
          <div style={{display:"flex",alignItems:"flex-end"}}>
            <button onClick={buscar} disabled={cargando||!busqueda.trim()} style={{padding:"11px 28px",borderRadius:10,border:"none",background:cargando?"#94a3b8":"#c8001a",color:"#fff",fontWeight:700,fontSize:15,cursor:cargando?"not-allowed":"pointer"}}>
              {cargando?"Buscando...":"🔍 Buscar"}
            </button>
          </div>
        </div>
        <div>
          <span style={{fontSize:12,fontWeight:600,color:"#94a3b8",marginRight:10}}>ACCESO RÁPIDO:</span>
          {RUBROS.map(r=>(
            <button key={r} onClick={()=>setBusqueda(r)} style={{margin:"2px 4px 2px 0",padding:"5px 12px",borderRadius:20,border:"1px solid #e2e8f0",background:busqueda===r?"#c8001a":"#f8fafc",color:busqueda===r?"#fff":"#475569",fontSize:12,fontWeight:500,cursor:"pointer"}}>{r}</button>
          ))}
        </div>
      </div>

      {cargando && (
        <div style={{textAlign:"center",padding:"60px 0"}}>
          <div style={{fontSize:48,marginBottom:16}}>🤖</div>
          <div style={{fontSize:18,fontWeight:700,color:"#1e293b",marginBottom:8}}>Buscando prospectos...</div>
          <div style={{fontSize:14,color:"#64748b"}}>La IA está analizando negocios en {zona}. Puede tardar 1-2 minutos.</div>
        </div>
      )}

      {error && <div style={{background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:12,padding:"16px 20px",color:"#dc2626",marginBottom:20}}>⚠️ {error}</div>}

      {busquedaHecha && !cargando && (
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,marginBottom:20}}>
            <div style={{display:"flex",gap:8}}>
              {["TODOS","ALTA","MEDIA","BAJA"].map(f=>(
                <button key={f} onClick={()=>setFiltro(f)} style={{padding:"7px 16px",borderRadius:20,border:"1px solid",borderColor:filtro===f?"#c8001a":"#e2e8f0",background:filtro===f?"#c8001a":"#fff",color:filtro===f?"#fff":"#475569",fontWeight:600,fontSize:13,cursor:"pointer"}}>
                  {f} ({conteo[f]})
                </button>
              ))}
            </div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:13,color:"#64748b"}}>{filtrados.length} negocios</span>
              {filtrados.length>0&&<button onClick={exportarCSV} style={{padding:"7px 16px",borderRadius:20,border:"1px solid #e2e8f0",background:"#fff",color:"#475569",fontWeight:600,fontSize:13,cursor:"pointer"}}>📥 Exportar CSV</button>}
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {filtrados.map((r,i)=>{
              const pColor = PRIORIDAD_COLOR[r.prioridad]||PRIORIDAD_COLOR.BAJA;
              const emails = Array.isArray(r.email)?r.email:(r.email?[r.email]:[]);
              const web = r.sitio_web||r.website;
              const gmaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((r.nombre||"")+" "+(r.direccion||""))}`;
              return (
                <div key={r.place_id||i} style={{background:"#fff",borderRadius:14,border:"1px solid #e2e8f0",overflow:"hidden",boxShadow:"0 1px 2px rgba(0,0,0,0.05)"}}>
                  <div style={{display:"flex"}}>
                    <div style={{width:5,background:pColor.text,flexShrink:0}}/>
                    <div style={{flex:1,padding:"18px 20px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8,marginBottom:12}}>
                        <div>
                          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                            <span style={{fontSize:17,fontWeight:800,color:"#1e293b"}}>{r.nombre}</span>
                            <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:pColor.bg,color:pColor.text,border:`1px solid ${pColor.border}`}}>{r.prioridad} · Score {r.lead_score}/10</span>
                            {r.calificacion>0&&<span style={{fontSize:13,color:"#64748b"}}>⭐ {r.calificacion} ({r.num_resenas} reseñas)</span>}
                          </div>
                          <div style={{fontSize:13,color:"#64748b",marginTop:4}}>{r.tipo_negocio||r.tipos_negocio||"Negocio"} · {r.ciudad||zona}</div>
                        </div>
                        <select value={vendedorAsignado[r.place_id]||"Sin asignar"} onChange={e=>setVendedorAsignado(prev=>({...prev,[r.place_id]:e.target.value}))} style={{padding:"6px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,color:"#475569",background:"#f8fafc",cursor:"pointer"}}>
                          {VENDEDORES.map(v=><option key={v}>{v}</option>)}
                        </select>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:10,marginBottom:14}}>
                        {r.direccion&&<a href={gmaps} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"flex-start",gap:7,fontSize:13,color:"#3b82f6",textDecoration:"none"}}><span>📍</span><span>{r.direccion}</span></a>}
                        {r.telefono&&r.telefono!=="No disponible"&&<a href={`tel:${r.telefono}`} style={{display:"flex",alignItems:"center",gap:7,fontSize:13,color:"#1e293b",textDecoration:"none"}}><span>📞</span>{r.telefono}</a>}
                        {emails.length>0&&emails[0]!=="No disponible"&&<a href={`mailto:${emails[0]}`} style={{display:"flex",alignItems:"center",gap:7,fontSize:13,color:"#1e293b",textDecoration:"none"}}><span>✉️</span>{emails.slice(0,2).join(" · ")}</a>}
                        {web&&web!=="No disponible"&&<a href={web.startsWith("http")?web:`https://${web}`} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:7,fontSize:13,color:"#3b82f6",textDecoration:"none"}}><span>🌐</span>{web.replace(/^https?:\/\//,"").split("/")[0]}</a>}
                      </div>
                      {(r.productos_sugeridos||r.enfoque_venta)&&(
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                          {r.productos_sugeridos&&r.productos_sugeridos!=="N/A"&&<div style={{background:"#f0f9ff",borderRadius:8,padding:"10px 14px",border:"1px solid #bae6fd"}}><div style={{fontSize:11,fontWeight:700,color:"#0369a1",marginBottom:4}}>🛒 PRODUCTOS SUGERIDOS</div><div style={{fontSize:12,color:"#0c4a6e",lineHeight:1.5}}>{r.productos_sugeridos}</div></div>}
                          {r.enfoque_venta&&r.enfoque_venta!=="N/A"&&<div style={{background:"#fefce8",borderRadius:8,padding:"10px 14px",border:"1px solid #fde047"}}><div style={{fontSize:11,fontWeight:700,color:"#854d0e",marginBottom:4}}>💬 ENFOQUE DE VENTA</div><div style={{fontSize:12,color:"#713f12",lineHeight:1.5}}>{r.enfoque_venta}</div></div>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!busquedaHecha&&!cargando&&(
        <div style={{textAlign:"center",padding:"60px 0",color:"#94a3b8"}}>
          <div style={{fontSize:56,marginBottom:16}}>🗺️</div>
          <div style={{fontSize:18,fontWeight:700,color:"#cbd5e1",marginBottom:8}}>Listo para buscar</div>
          <div style={{fontSize:14}}>Escribí un rubro arriba y elegí la zona para encontrar prospectos</div>
        </div>
      )}
    </div>
  );
}
