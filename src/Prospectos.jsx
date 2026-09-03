import { useState } from "react";
import { Download, Map, Printer, Share2 } from "lucide-react";

const N8N_WEBHOOK = "https://ntg-group.app.n8n.cloud/webhook/munich-prospectos-buscar";

const PRIORIDAD_COLOR = {
  ALTA: { bg: "#fee2e2", text: "#dc2626", border: "#fca5a5" },
  MEDIA: { bg: "#fef9c3", text: "#ca8a04", border: "#fde047" },
  BAJA: { bg: "#f0fdf4", text: "#16a34a", border: "#86efac" },
};

const LOCALIDADES_POR_PROVINCIA = {
  "Buenos Aires": ["La Plata", "Mar del Plata", "Bahía Blanca", "Tandil", "Quilmes", "San Isidro", "Pilar", "Luján", "Olavarría"],
  "Catamarca": ["San Fernando del Valle de Catamarca", "Andalgalá", "Belén", "Tinogasta"],
  "Chaco": ["Resistencia", "Presidencia Roque Sáenz Peña", "Villa Ángela", "Charata"],
  "Chubut": ["Rawson", "Comodoro Rivadavia", "Puerto Madryn", "Trelew", "Esquel"],
  "CABA": ["Ciudad Autónoma de Buenos Aires"],
  "Córdoba": ["Córdoba Centro", "Nueva Córdoba", "Alta Córdoba", "Villa Allende", "Río Ceballos", "Villa Carlos Paz", "La Calera", "Jesús María", "Bell Ville", "Río Cuarto"],
  "Corrientes": ["Corrientes", "Goya", "Paso de los Libres", "Curuzú Cuatiá"],
  "Entre Ríos": ["Paraná", "Concordia", "Gualeguaychú", "Concepción del Uruguay", "La Paz"],
  "Formosa": ["Formosa", "Clorinda", "Pirané", "El Colorado"],
  "Jujuy": ["San Salvador de Jujuy", "Palpalá", "San Pedro", "Libertador General San Martín"],
  "La Pampa": ["Santa Rosa", "General Pico", "Toay", "Realicó"],
  "La Rioja": ["La Rioja", "Chilecito", "Aimogasta", "Chamical"],
  "Mendoza": ["Mendoza", "Godoy Cruz", "Guaymallén", "Las Heras", "San Rafael", "Luján de Cuyo", "Maipú"],
  "Misiones": ["Posadas", "Puerto Iguazú", "Oberá", "Eldorado", "Apóstoles"],
  "Neuquén": ["Neuquén", "Centenario", "Plottier", "San Martín de los Andes", "Villa La Angostura", "Zapala"],
  "Río Negro": ["Viedma", "San Carlos de Bariloche", "General Roca", "Cipolletti", "Villa Regina", "El Bolsón"],
  "Salta": ["Salta", "San Ramón de la Nueva Orán", "Tartagal", "Cafayate", "Metán"],
  "San Juan": ["San Juan", "Rawson", "Rivadavia", "Pocito", "Caucete"],
  "San Luis": ["San Luis", "Villa Mercedes", "Merlo", "La Punta"],
  "Santa Cruz": ["Río Gallegos", "Caleta Olivia", "El Calafate", "Puerto Deseado", "Pico Truncado"],
  "Santa Fe": ["Santa Fe", "Rosario", "Rafaela", "Venado Tuerto", "Reconquista", "Villa Gobernador Gálvez"],
  "Santiago del Estero": ["Santiago del Estero", "La Banda", "Termas de Río Hondo", "Añatuya"],
  "Tierra del Fuego": ["Ushuaia", "Río Grande", "Tolhuin"],
  "Tucumán": ["San Miguel de Tucumán", "Yerba Buena", "Tafí Viejo", "Concepción", "Aguilares"],
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
    a.download = `clientes-potenciales_${busqueda}_${new Date().toLocaleDateString("es-AR").replace(/\//g,"-")}.csv`; a.click();
  };

  const crearHojaRuta = () => {
    if (!filtrados.length) return;
    const escapar = (valor) => String(valor || "").replace(/[&<>"']/g, caracter => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[caracter]);
    const filas = filtrados.map((r, indice) => `
      <tr><td>${indice + 1}</td><td><strong>${escapar(r.nombre || "Sin nombre")}</strong><br>${escapar(r.direccion || "Sin dirección")}</td>
      <td>${escapar(r.telefono || "Sin teléfono")}</td><td>${escapar(vendedorAsignado[r.place_id] || "Sin asignar")}</td><td></td></tr>`).join("");
    const ventana = window.open("", "_blank", "noopener,noreferrer");
    if (!ventana) return;
    ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Hoja de ruta - ${escapar(zona)}</title>
      <style>body{font-family:Arial,sans-serif;color:#1e293b;padding:32px}h1{margin:0 0 6px;color:#9b1c1c}p{color:#64748b}.acciones{display:flex;gap:8px}.acciones button{border:0;border-radius:6px;padding:9px 14px;background:#9b1c1c;color:#fff;cursor:pointer}.acciones button.secundario{background:#334155}table{border-collapse:collapse;width:100%;margin-top:24px}th,td{border:1px solid #cbd5e1;padding:10px;text-align:left;vertical-align:top}th{background:#f1f5f9}td:first-child{width:38px;text-align:center}td:last-child{width:100px;height:34px}@media print{body{padding:0}.acciones{display:none}}</style></head>
      <body><h1>Hoja de ruta</h1><p>Clientes potenciales · ${escapar(zona)} · ${new Date().toLocaleDateString("es-AR")}</p>
      <div class="acciones"><button onclick="compartir()">↗ Compartir</button><button class="secundario" onclick="descargar()">↓ Descargar</button><button class="secundario" onclick="window.print()">▣ Imprimir</button></div>
      <table><thead><tr><th>#</th><th>Negocio y dirección</th><th>Teléfono</th><th>Vendedor</th><th>Visitado</th></tr></thead><tbody>${filas}</tbody></table>
      <script>function contenido(){return document.body.innerText}function compartir(){if(navigator.share){navigator.share({title:"Hoja de ruta",text:contenido()})}else{navigator.clipboard.writeText(contenido()).then(function(){alert("Hoja de ruta copiada para compartir")})}}function descargar(){var archivo=new Blob(["<!doctype html>"+document.documentElement.outerHTML],{type:"text/html;charset=utf-8"});var enlace=document.createElement("a");enlace.href=URL.createObjectURL(archivo);enlace.download="hoja-de-ruta.html";enlace.click();URL.revokeObjectURL(enlace.href)}</script></body></html>`);
    ventana.document.close();
  };

  return (
    <div style={{padding:"24px",maxWidth:1100,margin:"0 auto",fontFamily:"Inter,sans-serif"}}>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:26,fontWeight:800,color:"#1e293b",marginBottom:4}}>🔍 Búsqueda de Clientes potenciales</h1>
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
              <option>Toda Argentina</option>
              {Object.entries(LOCALIDADES_POR_PROVINCIA).map(([provincia, localidades])=>(
                <optgroup key={provincia} label={provincia}>
                  <option value={`Toda ${provincia}`}>Toda la provincia</option>
                  {localidades.map(localidad=><option key={`${provincia}-${localidad}`}>{localidad}</option>)}
                </optgroup>
              ))}
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

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:18,flexWrap:"wrap",padding:"16px 18px",marginBottom:24,background:"linear-gradient(135deg,#fff7ed,#fff)",border:"1px solid #fed7aa",borderRadius:14,boxShadow:"0 2px 8px rgba(154,52,18,.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:10,display:"grid",placeItems:"center",background:"#9b1c1c",color:"#fff"}}><Map size={20}/></div>
          <div><div style={{fontWeight:800,color:"#1e293b",fontSize:14}}>Acciones de la hoja de ruta</div><div style={{fontSize:12,color:"#64748b",marginTop:3}}>{filtrados.length ? `${filtrados.length} clientes listos para organizar` : "Realizá una búsqueda para habilitar estas acciones"}</div></div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={crearHojaRuta} disabled={!filtrados.length} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 16px",borderRadius:8,border:"none",background:filtrados.length?"#9b1c1c":"#cbd5e1",color:"#fff",fontWeight:800,fontSize:13,cursor:filtrados.length?"pointer":"not-allowed",boxShadow:filtrados.length?"0 3px 8px rgba(155,28,28,.2)":"none"}}><Map size={16}/> Crear hoja de ruta</button>
          <button onClick={exportarCSV} disabled={!filtrados.length} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:8,border:"1px solid #cbd5e1",background:filtrados.length?"#fff":"#f8fafc",color:filtrados.length?"#334155":"#94a3b8",fontWeight:700,fontSize:13,cursor:filtrados.length?"pointer":"not-allowed"}}><Download size={16}/> Descargar CSV</button>
          <button disabled style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#94a3b8",fontWeight:700,fontSize:13,cursor:"not-allowed"}} title="Disponible al abrir la hoja de ruta"><Share2 size={16}/> Compartir</button>
          <button disabled style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#94a3b8",fontWeight:700,fontSize:13,cursor:"not-allowed"}} title="Disponible al abrir la hoja de ruta"><Printer size={16}/> Imprimir</button>
        </div>
      </div>

      {cargando && (
        <div style={{textAlign:"center",padding:"60px 0"}}>
          <div style={{fontSize:48,marginBottom:16}}>🤖</div>
          <div style={{fontSize:18,fontWeight:700,color:"#1e293b",marginBottom:8}}>Buscando clientes potenciales...</div>
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
            <span style={{fontSize:13,color:"#64748b"}}>{filtrados.length} negocios encontrados</span>
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
          <div style={{fontSize:14}}>Escribí un rubro arriba y elegí la zona para encontrar clientes potenciales</div>
        </div>
      )}
    </div>
  );
}
