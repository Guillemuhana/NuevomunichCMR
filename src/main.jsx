import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/inter-tight";
import App from "./App.jsx";

// ============================================================
// Red de seguridad
// ------------------------------------------------------------
// Cuando algo explota adentro de un componente, React desmonta el
// árbol entero: queda la página en blanco, sin un cartel ni un botón,
// y desde el celular es indistinguible de "no puedo entrar". Así se
// perdió tiempo con el panel del vendedor.
//
// Esto no arregla el error, lo hace visible: dice qué pasó y deja
// volver a intentar sin tener que cerrar la app.
// ============================================================
class Limite extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[CRM] la pantalla se cayó:", error, info?.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter Variable', system-ui, sans-serif", background: "#F7F8FA" }}>
        <div style={{ maxWidth: 420, width: "100%", background: "#fff", border: "1px solid #E6E9EF", borderRadius: 16, padding: "26px 24px", boxShadow: "0 4px 14px rgba(16,24,40,.07)" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#101828", marginBottom: 8 }}>
            Se cortó la pantalla
          </div>
          <div style={{ fontSize: 13.5, color: "#667085", lineHeight: 1.5, marginBottom: 18 }}>
            Hubo un error y la app no pudo seguir. Probá de nuevo; si vuelve a pasar,
            avisanos con el detalle de acá abajo.
          </div>
          <pre style={{ fontSize: 11.5, color: "#991B1B", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 12px", margin: "0 0 18px", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 160, overflowY: "auto" }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button onClick={() => window.location.reload()}
            style={{ width: "100%", background: "#A81F1F", color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Limite>
      <App />
    </Limite>
  </React.StrictMode>
);
