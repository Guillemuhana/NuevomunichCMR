// ============================================================
// NOTAS NUEVAS — el aviso del pizarrón
// ------------------------------------------------------------
// El pizarrón de notas siempre fue compartido, pero mudo: si
// administración anotaba "el martes no hay reparto", Cristian se
// enteraba sólo si se le ocurría entrar a mirar.
//
// Cada nota lleva la lista de quiénes ya la abrieron
// (notas.leida_por). Lo que no está en esa lista, y no lo
// escribiste vos, lleva el cartel "Nueva" en la tarjeta.
//
// El globo del menú cuenta esas mismas: las que a MÍ me faltan leer.
// Es de cada uno, no del equipo. Si Boris entra y las lee, el suyo se
// apaga; el de Cristian sigue prendido hasta que entre él.
// ============================================================
import { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib";

const mismo = (a, b) => (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();

/**
 * ¿Esta nota es nueva para mí?
 *
 * Las propias no cuentan (uno ya sabe lo que escribió) y las hechas
 * tampoco: si el tema se resolvió no tiene sentido seguir avisando.
 */
export function esNotaNueva(nota, userEmail) {
  if (!nota || !userEmail || nota.hecha) return false;
  if (mismo(nota.autor_email, userEmail)) return false;
  // Si la columna todavía no existe (falta correr supabase_notas_nuevas.sql)
  // no inventamos avisos: el pizarrón sigue funcionando como antes.
  if (!Array.isArray(nota.leida_por)) return false;
  return !nota.leida_por.some((e) => mismo(e, userEmail));
}

/**
 * Da por vistas las notas que le acabo de mostrar a esta persona.
 * Es al pasar: si falla, lo único que queda mal es el contador.
 */
export async function marcarNotasVistas(notas, userEmail) {
  const pendientes = (notas || []).filter((n) => esNotaNueva(n, userEmail));
  if (!pendientes.length) return;
  const ids = pendientes.map((n) => n.id);

  const { error } = await supabase.rpc("notas_marcar_vistas", {
    p_email: userEmail, p_ids: ids,
  });
  if (!error) return;

  // Si la función no está pero la columna sí, lo hacemos a mano. Una por una,
  // porque cada nota tiene su propia lista de lectores.
  await Promise.all(pendientes.map((n) =>
    supabase.from("notas")
      .update({ leida_por: [...(n.leida_por || []), userEmail.trim().toLowerCase()] })
      .eq("id", n.id)
  ));
}

/**
 * Cuántas notas me faltan leer a mí. Es el número del menú.
 *
 * Por un tiempo contó "lo que falta hacer", igual que el globo de Chats: se
 * apagaba recién cuando la nota se marcaba como hecha. El problema es que una
 * nota hecha de a poco (o que nadie tilda nunca) dejaba el globo prendido para
 * todos, y entonces no avisaba nada: era un número de fondo.
 *
 * Vuelve a ser personal, que es lo que se pidió. Cada uno tiene el suyo: se
 * apaga al entrar al pizarrón, y al que todavía no entró le sigue prendido
 * hasta que entre. Depende de `notas.leida_por`, así que sin correr
 * supabase_notas_nuevas.sql el globo queda en cero y no molesta.
 */
export function useNotasPendientes(userEmail) {
  const [pendientes, setPendientes] = useState(0);

  const contar = useCallback(async () => {
    if (!userEmail) { setPendientes(0); return; }
    const { data, error } = await supabase
      .from("notas").select("id, hecha, autor_email, leida_por")
      .eq("hecha", false);
    if (error) { setPendientes(0); return; }
    setPendientes((data || []).filter((nota) => esNotaNueva(nota, userEmail)).length);
  }, [userEmail]);

  useEffect(() => { contar(); }, [contar]);

  // Que el número aparezca en el momento, sin recargar: es la mitad de la gracia.
  useEffect(() => {
    const ch = supabase.channel(`notas-aviso-${userEmail}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notas" }, contar)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [contar, userEmail]);

  return pendientes;
}
