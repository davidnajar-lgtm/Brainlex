// ============================================================================
// app/contactos/_modules/shared/CompanyAutocompleteInput.tsx
//
// @role: Agente de Frontend (Client Component)
// @spec: Set 3 — Búsqueda de empresa con Google Places Autocomplete
//
// Patrón de carga (sin `new Loader()`):
//   1. setOptions({ key, v }) — configura la API key una sola vez por sesión.
//   2. const { Autocomplete } = await importLibrary("places") — carga dinámica.
//   3. new Autocomplete(inputRef, { types: ["establishment"] }) — monta el widget.
//
// Al seleccionar una empresa:
//   · Extrae name, address_components, formatted_address, international_phone_number, website.
//   · Normaliza el teléfono a E.164 puro via parsed.format("E.164") (mismo parser
//     que usa Zod en el backend → garantía de validez cross-layer).
//   · Clasifica el teléfono: MOBILE → "movil", el resto → "fijo".
//   · Distribuye los datos a los callbacks del padre (nuevo/page.tsx).
// ============================================================================
"use client";

import { useEffect, useRef, useCallback } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { Search, X } from "lucide-react";

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type DetectedAddress = {
  calle:         string;
  ciudad:        string;
  provincia:     string;
  codigo_postal: string;
  pais:          string;
  /** true si falta número de portal o código postal */
  isIncomplete:  boolean;
};

interface Props {
  onNameFill:    (name: string) => void;
  onAddressFill: (addr: DetectedAddress) => void;
  onPhoneFill:   (phone: string, type: "movil" | "fijo") => void;
  onWebsiteFill: (url: string) => void;
  onClose:       () => void;
  onFillComplete:(filledFields: string[]) => void;
}

// ─── API key (module-level; solo se accede en useEffect, nunca en SSR) ────────

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// ─── Componente ───────────────────────────────────────────────────────────────

export function CompanyAutocompleteInput({
  onNameFill,
  onAddressFill,
  onPhoneFill,
  onWebsiteFill,
  onClose,
  onFillComplete,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Extrae y distribuye los datos del lugar seleccionado ──────────────────

  const processPlace = useCallback(
    (place: google.maps.places.PlaceResult) => {
      const filledFields: string[] = [];

      // ─ Razón Social ────────────────────────────────────────────────────────
      if (place.name) {
        onNameFill(place.name);
        filledFields.push("Razón Social");
      }

      // ─ Dirección ───────────────────────────────────────────────────────────
      if (place.address_components && place.address_components.length > 0) {
        let streetNumber = "";
        let route        = "";
        let city         = "";
        let province     = "";
        let postalCode   = "";
        let country      = "ES";

        for (const comp of place.address_components) {
          const types = comp.types;
          if (types.includes("street_number")) {
            streetNumber = comp.long_name;
          } else if (types.includes("route")) {
            route = comp.long_name;
          } else if (
            types.includes("locality") ||
            types.includes("postal_town")
          ) {
            city = comp.long_name;
          } else if (
            types.includes("administrative_area_level_2") ||
            types.includes("administrative_area_level_1")
          ) {
            if (!province) province = comp.long_name;
          } else if (types.includes("postal_code")) {
            postalCode = comp.short_name ?? comp.long_name;
          } else if (types.includes("country")) {
            country = comp.short_name ?? "ES";
          }
        }

        // Si Google no devuelve route (empresa en centro comercial, polígono…),
        // usar la primera parte del formatted_address como calle de referencia.
        // El flag isIncomplete avisa al usuario de que debe completarla.
        let calle = route
          ? streetNumber
            ? `${route}, ${streetNumber}`
            : route
          : "";

        if (!calle && place.formatted_address) {
          // Tomar el tramo de la dirección formateada que no es localidad/país
          // (eliminar el último segmento — suele ser país — y los dos anteriores
          //  si son CP y ciudad; lo que queda tiende a ser la vía o área).
          const parts = place.formatted_address.split(",").map((s) => s.trim());
          // Excluir el nombre de la empresa del primer tramo si coincide con name
          const firstUsable = parts.find(
            (p) => p.length > 3 && p !== (place.name ?? "")
          );
          calle = firstUsable ?? "";
        }

        const isIncomplete = !route || !streetNumber || !postalCode;

        if (calle || city || province || postalCode) {
          onAddressFill({
            calle,
            ciudad:        city,
            provincia:     province,
            codigo_postal: postalCode,
            pais:          country,
            isIncomplete,
          });
          filledFields.push("Dirección");
        }
      }

      // ─ Teléfono ─────────────────────────────────────────────────────────────
      // BUG FIX: no usar .replace(/\s/g, "") — puede generar formatos no-E.164
      // (parentheses, guiones). En su lugar, parsear con libphonenumber-js y
      // luego llamar a .format("E.164") para obtener el formato exacto que
      // también usa el validador Zod en el backend → garantía cross-layer.
      if (place.international_phone_number) {
        try {
          const parsed = parsePhoneNumberFromString(
            place.international_phone_number
          );
          if (parsed?.isValid()) {
            const normalized = parsed.format("E.164"); // ej. "+34912345678"
            const lineType   = parsed.getType();
            const phoneType: "movil" | "fijo" =
              lineType === "MOBILE" ? "movil" : "fijo"; // empresas → fijo por defecto
            onPhoneFill(normalized, phoneType);
            filledFields.push("Teléfono");
          }
        } catch {
          // Número inválido según libphonenumber-js — se omite sin error visible
        }
      }

      // ─ Sitio Web ─────────────────────────────────────────────────────────────
      if (place.website) {
        const url = /^https?:\/\//i.test(place.website)
          ? place.website
          : `https://${place.website}`;
        onWebsiteFill(url);
        filledFields.push("Sitio Web");
      }

      if (filledFields.length > 0) {
        onFillComplete(filledFields);
      }
      onClose();
    },
    [onNameFill, onAddressFill, onPhoneFill, onWebsiteFill, onClose, onFillComplete]
  );

  // ── Carga la librería Places y monta el widget Autocomplete ──────────────

  useEffect(() => {
    if (!apiKey) {
      console.error(
        "[CompanyAutocompleteInput] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY no está definida."
      );
      return;
    }

    let listener: google.maps.MapsEventListener | null = null;
    let cancelled = false;

    // setOptions debe llamarse UNA sola vez por sesión de página.
    // El flag en window sobrevive a re-evaluaciones de módulo por HMR / Turbopack.
    if (!(window as { __gmpOpts?: boolean }).__gmpOpts) {
      (window as { __gmpOpts?: boolean }).__gmpOpts = true;
      setOptions({ key: apiKey, v: "weekly" });
    }

    (importLibrary("places") as Promise<google.maps.PlacesLibrary>)
      .then(({ Autocomplete }) => {
        if (cancelled || !inputRef.current) return;

        const ac = new Autocomplete(inputRef.current, {
          types:  ["establishment"],
          fields: [
            "name",
            "address_components",
            "formatted_address",      // fallback para calle cuando no hay route
            "international_phone_number",
            "website",
          ],
        });

        listener = ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          processPlace(place);
        });

        // Auto-focus para escritura inmediata
        inputRef.current.focus();
      })
      .catch((err: unknown) => {
        console.error(
          "[CompanyAutocompleteInput] importLibrary('places') falló:", err
        );
      });

    return () => {
      cancelled = true;
      if (listener) google.maps.event.removeListener(listener);
    };
  }, [processPlace]);

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-orange-500/30 bg-zinc-900 shadow-lg shadow-black/30">

      {/* Cabecera */}
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-orange-400" />
        <p className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-orange-400">
          Buscar empresa en Google Places
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-zinc-600 transition-colors hover:text-zinc-400"
          aria-label="Cerrar buscador"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Input de búsqueda */}
      <div className="px-3 py-3">
        <input
          ref={inputRef}
          type="text"
          placeholder="Nombre de la empresa, ciudad…"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30"
        />
        <p className="mt-2 text-[10px] text-zinc-600">
          Selecciona la empresa para autocompletar razón social, dirección y datos de contacto.
        </p>
      </div>

    </div>
  );
}
