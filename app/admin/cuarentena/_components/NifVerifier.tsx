"use client";

// ============================================================================
// app/admin/cuarentena/_components/NifVerifier.tsx
//
// @role: Agente de Frontend (Client Component)
// @spec: RGPD — Verificador de Registros de Borrado Anonimizados
//
// Permite al Superusuario introducir un NIF/CIF para comprobar si existe
// un registro FORGET en los logs anonimizados (hash SHA-256).
// No revela ningún dato personal — solo confirma existencia del hash.
// ============================================================================

import { useState, useTransition } from "react";
import { Search, ShieldCheck, ShieldOff, Loader2, Info, ChevronDown } from "lucide-react";
import { verifyNifDeletion } from "@/lib/actions/rgpd.actions";

const FISCAL_ID_TIPOS = [
  "NIF", "NIE", "DNI", "PASAPORTE",
  "VAT", "TIE", "REGISTRO_EXTRANJERO", "CODIGO_SOPORTE",
] as const;

type VerifyResult = Awaited<ReturnType<typeof verifyNifDeletion>>;

export function NifVerifier() {
  const [isPending, startTransition] = useTransition();
  const [nif, setNif] = useState("");
  const [tipo, setTipo] = useState<typeof FISCAL_ID_TIPOS[number]>("NIF");
  const [showHowTo, setShowHowTo] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  function handleSearch() {
    if (!nif.trim()) return;
    setResult(null);
    setCallError(null);
    startTransition(async () => {
      try {
        const r = await verifyNifDeletion(nif.trim().toUpperCase(), tipo);
        if ("error" in r) {
          setCallError(r.error);
        } else {
          setResult(r);
        }
      } catch (err) {
        setCallError(err instanceof Error ? err.message : "Error desconocido");
      }
    });
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Search className="h-4 w-4 text-zinc-500" />
        <h3 className="text-sm font-semibold text-zinc-300">Verificador de Registro de Borrado</h3>
        <span className="ml-auto rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          RGPD Art.17
        </span>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-zinc-500">
        Comprueba si existe un certificado de borrado anonimizado para un identificador fiscal.
        No se revela ningún dato personal — solo se verifica la existencia del hash SHA-256.
      </p>

      <div className="flex gap-2">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as typeof FISCAL_ID_TIPOS[number])}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-2 text-xs text-zinc-300 outline-none focus:border-zinc-500"
        >
          {FISCAL_ID_TIPOS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          type="text"
          value={nif}
          onChange={(e) => setNif(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Introduce el NIF / CIF…"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-zinc-500"
        />
        <button
          onClick={handleSearch}
          disabled={isPending || !nif.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-600 disabled:opacity-40"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Verificar
        </button>
      </div>

      {callError && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-950/20 p-3 text-xs text-red-400">
          <span className="font-semibold">Error:</span> {callError}
        </div>
      )}

      {/* ── Verificación independiente ── */}
      <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/30">
        <button
          type="button"
          onClick={() => setShowHowTo((v) => !v)}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <Info className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
          <span className="flex-1">¿Cómo puede verificarlo el interesado sin acceder al sistema?</span>
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${showHowTo ? "rotate-180" : ""}`} />
        </button>

        {showHowTo && (
          <div className="border-t border-zinc-800 px-3 py-3 space-y-4 text-[11px] leading-relaxed text-zinc-400">

            {/* — Qué ocurre durante el ciclo de vida — */}
            <div>
              <p className="mb-2 font-semibold text-zinc-300">¿Qué ocurre desde que se crea un contacto hasta que se borra?</p>
              <ol className="space-y-2 list-none">
                <li className="flex gap-2">
                  <span className="shrink-0 font-bold text-zinc-500">1.</span>
                  <span>
                    <strong className="text-zinc-300">Durante la vida del contacto</strong> — cada acción
                    (alta, modificación, archivado) queda registrada en un historial interno con todos los
                    datos: nombre, NIF, fecha, quién lo hizo. Esto es obligatorio por ley para cualquier
                    empresa (art. 30 Código de Comercio).
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 font-bold text-zinc-500">2.</span>
                  <span>
                    <strong className="text-zinc-300">En el momento del borrado (Pass Away)</strong> — antes
                    de eliminar el contacto, el sistema toma su NIF y calcula una{" "}
                    <strong className="text-zinc-300">huella digital</strong> (hash SHA-256): una cadena de
                    64 caracteres que representa el NIF de forma irreversible. Nadie puede recuperar el NIF
                    a partir de esa huella. A continuación, el contacto y todos sus datos personales son
                    borrados. Solo queda la huella, la fecha, y la base legal del borrado.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="shrink-0 font-bold text-zinc-500">3.</span>
                  <span>
                    <strong className="text-zinc-300">Lo que queda tras el borrado</strong> — el historial
                    previo (pasos, modificaciones) sigue existiendo por obligación legal, pero sin que el
                    sistema pueda relacionarlo con ninguna persona identificable. El único vínculo es la
                    huella del NIF, que no revela la identidad.
                  </span>
                </li>
              </ol>
            </div>

            {/* — Qué prueba el verificador — */}
            <div className="rounded border border-zinc-700/50 bg-zinc-800/30 px-2.5 py-2.5">
              <p className="mb-1 font-semibold text-zinc-300">¿Qué demuestra exactamente el verificador?</p>
              <p>
                Cuando el interesado introduce su NIF aquí, el sistema recalcula la misma huella digital y
                comprueba si existe en el registro de borrados. Si aparece:{" "}
                <strong className="text-zinc-200">en la fecha indicada existía en este sistema un contacto
                con ese NIF, y fue borrado de forma definitiva</strong>. El sistema no puede mostrar más
                datos porque ya no los tiene.
              </p>
            </div>

            {/* — Cómo verificarlo fuera del sistema — */}
            <div>
              <p className="mb-2 font-semibold text-zinc-300">¿Cómo puede comprobarlo el interesado sin depender de nuestro sistema?</p>
              <p className="mb-2">
                La huella SHA-256 es un estándar matemático público (FIPS 180-4). Cualquier herramienta
                del mundo produce exactamente el mismo resultado para los mismos datos. La fórmula es:{" "}
                <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-300">NIF|TIPO</code>{" "}
                en mayúsculas, sin espacios (p. ej.{" "}
                <code className="rounded bg-zinc-800 px-1 font-mono text-zinc-300">12345678A|NIF</code>).
                El resultado debe coincidir exactamente con el hash del certificado.
              </p>

              <div className="space-y-2">
                <div>
                  <p className="text-zinc-500 mb-0.5">Web — sin instalar nada (buscar "SHA-256 online"):</p>
                  <p className="text-zinc-400">Pegar el texto <code className="rounded bg-zinc-800 px-1 font-mono text-zinc-300">NIF|TIPO</code> en el campo de entrada y comparar el resultado con el hash del certificado.</p>
                </div>
                <div>
                  <p className="text-zinc-500 mb-0.5">Terminal Linux / macOS:</p>
                  <code className="block rounded bg-zinc-800 px-2 py-1.5 font-mono text-[10px] text-emerald-400">
                    {"echo -n \"12345678A|NIF\" | sha256sum"}
                  </code>
                </div>
                <div>
                  <p className="text-zinc-500 mb-0.5">PowerShell (Windows):</p>
                  <code className="block rounded bg-zinc-800 px-2 py-1.5 font-mono text-[10px] text-blue-400">
                    {"[System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes(\"12345678A|NIF\"))).Replace(\"-\",\"\").ToLower()"}
                  </code>
                </div>
                <div>
                  <p className="text-zinc-500 mb-0.5">Python 3:</p>
                  <code className="block rounded bg-zinc-800 px-2 py-1.5 font-mono text-[10px] text-yellow-400">
                    {"import hashlib; print(hashlib.sha256(b\"12345678A|NIF\").hexdigest())"}
                  </code>
                </div>
              </div>
            </div>

            <p className="rounded border border-zinc-700/50 bg-zinc-800/40 px-2.5 py-2 text-zinc-500">
              Este mecanismo cumple con el <strong className="text-zinc-400">RGPD Art.17 (derecho al olvido)</strong>:
              los datos personales han sido eliminados, y existe una constancia verificable e independiente
              de que así fue, sin que esa constancia revele ningún dato personal.
            </p>
          </div>
        )}
      </div>

      {result && (
        <div className={`mt-4 rounded-lg border p-4 ${
          result.found
            ? "border-emerald-500/20 bg-emerald-950/20"
            : "border-zinc-700/40 bg-zinc-900/40"
        }`}>
          {result.found ? (
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-emerald-300">
                  Registro de borrado encontrado
                </p>
                <p className="mt-0.5 text-xs text-emerald-600">
                  Se encontraron {result.count} registro(s) FORGET para este identificador.
                </p>
                <div className="mt-3 space-y-2">
                  {result.entries.map((entry) => (
                    <div key={entry.id} className="rounded border border-zinc-800 bg-zinc-900/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <code className="truncate font-mono text-[10px] text-emerald-400">
                          {entry.hash_identificador}
                        </code>
                        <time className="shrink-0 text-[10px] tabular-nums text-zinc-600">
                          {new Date(entry.created_at).toLocaleString("es-ES")}
                        </time>
                      </div>
                      {entry.base_legal && (
                        <p className="mt-1 text-[10px] text-zinc-500">{entry.base_legal}</p>
                      )}
                      {entry.meta_counts != null && (
                        <p className="mt-0.5 font-mono text-[10px] text-zinc-600">
                          {JSON.stringify(entry.meta_counts)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <ShieldOff className="h-4 w-4 shrink-0 text-zinc-500" />
              <p className="text-sm text-zinc-500">
                No se encontró ningún registro de borrado para este identificador.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
