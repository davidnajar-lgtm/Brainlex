// ============================================================================
// app/contactos/_modules/ficha/DirectChannelsEditModal.tsx
//
// @role: @Frontend-UX (Client Component)
// @spec: Fase 9.1 — Modal de edición de canales directos del contacto
//
// Edita: email_principal, telefono_movil, telefono_fijo,
//        website_url, linkedin_url, canal_preferido.
// Patrón: <dialog> + useActionState (igual que DireccionFormModal).
// ============================================================================
"use client";

import { useRef, useEffect, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Mail, Smartphone, Phone, Globe, Link2 } from "lucide-react";
import { updateDirectChannels } from "@/lib/modules/entidades/actions/identity.actions";
import { useTenant } from "@/lib/context/TenantContext";
import { inputCls, labelCls } from "@/lib/utils/formHelpers";
import { CustomPhoneInput } from "@/components/ui/CustomPhoneInput";

// ─── Props ───────────────────────────────────────────────────────────────────

export type DirectChannelsInitialData = {
  id:              string;
  email_principal: string | null;
  telefono_movil:  string | null;
  telefono_fijo:   string | null;
  website_url:     string | null;
  linkedin_url:    string | null;
  canal_preferido: string | null;
};

type Props = {
  contacto: DirectChannelsInitialData;
  onClose?: () => void;
  /** Pre-fill phone from Google Places detection */
  prefillPhone?: { value: string; type: "movil" | "fijo" } | null;
  /** Pre-fill website from Google Places detection */
  prefillWebsite?: string | null;
};

// ─── Component ───────────────────────────────────────────────────────────────

export function DirectChannelsEditModal({
  contacto,
  onClose,
  prefillPhone,
  prefillWebsite,
}: Props) {
  const dialogRef       = useRef<HTMLDialogElement>(null);
  const formRef         = useRef<HTMLFormElement>(null);
  const backdropDownRef = useRef(false);
  const router          = useRouter();
  const { tenant }      = useTenant();

  const [state, formAction, isPending] = useActionState(updateDirectChannels, null);
  const [showErrors, setShowErrors] = useState(false);

  // Controlled state for phone inputs (CustomPhoneInput is controlled)
  const [telefonoMovil, setTelefonoMovil] = useState(
    prefillPhone?.type === "movil" ? prefillPhone.value : (contacto.telefono_movil ?? "")
  );
  const [telefonoFijo, setTelefonoFijo] = useState(
    prefillPhone?.type === "fijo" ? prefillPhone.value : (contacto.telefono_fijo ?? "")
  );
  const [websiteUrl, setWebsiteUrl] = useState(
    prefillWebsite ?? contacto.website_url ?? ""
  );
  const [linkedinUrl, setLinkedinUrl] = useState(contacto.linkedin_url ?? "");
  const [canalPreferido, setCanalPreferido] = useState<"EMAIL" | "MOVIL">(
    (contacto.canal_preferido as "EMAIL" | "MOVIL") ?? "EMAIL"
  );

  // Open dialog on mount
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // Propagate native close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose?.();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  // Success: close + refresh
  useEffect(() => {
    if (state?.ok === true) {
      dialogRef.current?.close();
      router.refresh();
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  function closeDialog() {
    dialogRef.current?.close();
  }

  const errors = showErrors && state?.ok === false ? (state.fieldErrors ?? {}) : {};

  return (
    <dialog
      ref={dialogRef}
      onMouseDown={(e) => { backdropDownRef.current = e.target === e.currentTarget; }}
      onClick={(e)     => { if (backdropDownRef.current && e.target === e.currentTarget) closeDialog(); }}
      className="m-auto w-full max-w-lg overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 p-0 shadow-2xl backdrop:bg-black/70"
    >
      <form
        ref={formRef}
        action={formAction}
        onSubmit={() => setShowErrors(true)}
      >
        <input type="hidden" name="contactoId" value={contacto.id} />
        <input type="hidden" name="companyId" value={tenant.id} />
        <input type="hidden" name="telefono_movil" value={telefonoMovil} />
        <input type="hidden" name="telefono_fijo" value={telefonoFijo} />
        <input type="hidden" name="canal_preferido" value={canalPreferido} />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-100">
              Editar Canales de Comunicación
            </h2>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            className="rounded-lg p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">

          {/* Global error — only when no field-level errors */}
          {state?.ok === false && state.error && !state.fieldErrors && (
            <p className="rounded-lg bg-red-100 px-3 py-2 text-xs text-red-800 ring-1 ring-red-300 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-800/30">
              {state.error}
            </p>
          )}

          {/* Field-level error summary */}
          {state?.ok === false && state.fieldErrors && Object.keys(state.fieldErrors).length > 0 && (
            <div className="rounded-lg bg-red-100 px-3 py-2 text-xs text-red-800 ring-1 ring-red-300 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-800/30">
              <p className="font-medium">Corrige los siguientes campos:</p>
              <ul className="mt-1 list-inside list-disc">
                {Object.entries(state.fieldErrors).map(([field, msgs]) => (
                  <li key={field}>{(msgs as string[])[0]}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Canal preferido toggle */}
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
              title="Indica si este contacto prefiere que le contactes por Email o por Móvil. No afecta al envío, solo es informativo."
            >
              Canal preferido
            </span>
            <div className="flex overflow-hidden rounded-md border border-zinc-700">
              {(["EMAIL", "MOVIL"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCanalPreferido(c)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    canalPreferido === c
                      ? "bg-orange-500/20 text-orange-400"
                      : "bg-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {c === "EMAIL" ? "Email" : "Móvil"}
                </button>
              ))}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className={labelCls} title="El email principal se usa para comunicaciones oficiales. Puedes añadir más emails en Canales Adicionales.">
              <Mail className="inline h-3 w-3 mr-1 text-zinc-600" />
              Email Principal
            </label>
            <input
              name="email_principal"
              type="email"
              defaultValue={contacto.email_principal ?? ""}
              autoFocus
              placeholder="contacto@empresa.es"
              className={inputCls(!!errors?.email_principal)}
            />
            {errors?.email_principal && <p className="mt-1 text-xs text-red-500">{errors.email_principal[0]}</p>}
          </div>

          {/* Teléfonos */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} title="Incluye el prefijo del país. Ej: +34 600 123 456. Selecciona la bandera para cambiar de país.">
                <Smartphone className="inline h-3 w-3 mr-1 text-zinc-600" />
                Teléfono Móvil
              </label>
              <CustomPhoneInput
                value={telefonoMovil}
                onChange={setTelefonoMovil}
                error={errors?.telefono_movil?.[0]}
              />
              {errors?.telefono_movil && <p className="mt-1 text-xs text-red-500">{errors.telefono_movil[0]}</p>}
            </div>
            <div>
              <label className={labelCls} title="Incluye el prefijo del país. Ej: +34 912 345 678. Selecciona la bandera para cambiar de país.">
                <Phone className="inline h-3 w-3 mr-1 text-zinc-600" />
                Teléfono Fijo
              </label>
              <CustomPhoneInput
                value={telefonoFijo}
                onChange={setTelefonoFijo}
                error={errors?.telefono_fijo?.[0]}
              />
              {errors?.telefono_fijo && <p className="mt-1 text-xs text-red-500">{errors.telefono_fijo[0]}</p>}
            </div>
          </div>

          {/* Website */}
          <div>
            <label className={labelCls} title="Se añade https:// automáticamente si no lo escribes. Ej: www.empresa.com">
              <Globe className="inline h-3 w-3 mr-1 text-zinc-600" />
              Sitio Web
            </label>
            <input
              name="website_url"
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              onBlur={() => {
                const v = websiteUrl.trim().toLowerCase();
                if (v && !/^https?:\/\//i.test(v)) setWebsiteUrl(`https://${v}`);
                else if (v) setWebsiteUrl(v);
              }}
              placeholder="https://www.empresa.com"
              className={inputCls(!!errors?.website_url)}
            />
            {errors?.website_url && <p className="mt-1 text-xs text-red-500">{errors.website_url[0]}</p>}
          </div>

          {/* LinkedIn */}
          <div>
            <label className={labelCls} title="Pega la URL completa del perfil. Ej: https://linkedin.com/in/nombre-usuario">
              <Link2 className="inline h-3 w-3 mr-1 text-zinc-600" />
              LinkedIn
            </label>
            <input
              name="linkedin_url"
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              onBlur={() => {
                const v = linkedinUrl.trim().toLowerCase();
                if (v && !/^https?:\/\//i.test(v)) setLinkedinUrl(`https://${v}`);
                else if (v) setLinkedinUrl(v);
              }}
              placeholder="https://linkedin.com/in/usuario"
              className={inputCls(!!errors?.linkedin_url)}
            />
            {errors?.linkedin_url && <p className="mt-1 text-xs text-red-500">{errors.linkedin_url[0]}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-zinc-800 px-6 py-4">
          <button
            type="button"
            onClick={closeDialog}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
          >
            {isPending ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
