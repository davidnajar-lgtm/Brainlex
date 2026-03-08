// ============================================================================
// app/contactos/_modules/ficha/PlacesAutocompleteInput.tsx
//
// @role: Agente de Frontend (Client Component)
// @spec: Micro-Spec 2.7 — Campo Calle con Google PlaceAutocompleteElement
//
// Arquitectura:
//  UI     → gmp-place-autocomplete es el ÚNICO input visible.
//  FORM   → <input type="hidden"> lleva name/value al form (no es visible).
//  SHADOW → modo 'closed'. Styling via globals.css ::part(input) + herencia.
//  DATOS  → gmp-select (API weekly) → placePrediction.toPlace() → fetchFields → setters.
// ============================================================================
"use client";

import { useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

// ─── Tipos internos ───────────────────────────────────────────────────────────

type AnyAddressComp = {
  types:       string[];
  longText?:   string | null;
  shortText?:  string | null;
  long_name?:  string;
  short_name?: string;
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Nombre del campo en FormData (para el input hidden) */
  name?:            string;
  id?:              string;
  required?:        boolean;
  defaultValue?:    string;
  placeholder?:     string;
  /** Clases Tailwind que se aplican al host gmp-place-autocomplete */
  className?:       string;
  /** Setters individuales — el componente los llama al seleccionar una sugerencia */
  setCiudad:        (v: string) => void;
  setCodigoPostal:  (v: string) => void;
  setProvincia:     (v: string) => void;
  setPais:          (v: string) => void;
}

// ─── Helper de extracción ─────────────────────────────────────────────────────

function getComponent(comps: AnyAddressComp[], type: string, short = false): string {
  const comp = comps.find((c) => Array.isArray(c.types) && c.types.includes(type));
  if (!comp) return "";
  if (short) return comp.shortText ?? comp.short_name ?? "";
  return comp.longText ?? comp.long_name ?? "";
}

// ─── Constante de API key ─────────────────────────────────────────────────────

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// ─── Componente ───────────────────────────────────────────────────────────────

export function PlacesAutocompleteInput({
  name, id, required, defaultValue, placeholder, className,
  setCiudad, setCodigoPostal, setProvincia, setPais,
}: Props) {
  const mountRef  = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  // apiAvailable: false cuando no hay API key o cuando la carga de la librería falla.
  // En ese caso se renderiza un <input type="text"> manual en su lugar.
  const [apiAvailable, setApiAvailable] = useState(!!apiKey);

  useEffect(() => {
    if (!apiKey || !mountRef.current) {
      setApiAvailable(false);
      return;
    }

    // setOptions dentro de useEffect → evita el warning en Fast Refresh.
    // El flag en window sobrevive a re-evaluaciones del módulo (HMR).
    if (!(window as { __gmpOpts?: boolean }).__gmpOpts) {
      (window as { __gmpOpts?: boolean }).__gmpOpts = true;
      setOptions({ key: apiKey, v: "weekly" });
    }

    type PlacesLibraryWithPAE = google.maps.PlacesLibrary & {
      PlaceAutocompleteElement: typeof google.maps.places.PlaceAutocompleteElement;
    };

    // Flag de cancelación: si el cleanup corre antes de que la Promise resuelva
    // (React Strict Mode monta dos veces), evita montar el primer elemento.
    let cancelled = false;
    let gmpEl: google.maps.places.PlaceAutocompleteElement | undefined;

    (importLibrary("places") as Promise<PlacesLibraryWithPAE>)
      .catch((err: unknown) => {
        console.error("[Places] importLibrary('places') FAILED:", err);
        setApiAvailable(false);
      })
      .then((lib) => {
        if (!lib) return; // capturado en el .catch anterior
        const { PlaceAutocompleteElement } = lib;
        if (cancelled || !mountRef.current) return;

        const el = new PlaceAutocompleteElement({ types: ["address"] });
        gmpEl = el;

        // Clases Tailwind al host → fondo/borde/radio via globals.css
        (el as HTMLElement).className = className ?? "";
        // color es propiedad heredada → cascada en shadow DOM
        (el as HTMLElement).style.color = "white";
        if (id)          (el as HTMLElement).id = id;
        if (placeholder) el.setAttribute("placeholder", placeholder);

        mountRef.current.appendChild(el);

        // Valor inicial en modo edición
        if (defaultValue) {
          try {
            (el as HTMLElement & { value?: string }).value = String(defaultValue);
          } catch { /* no-op */ }
        }

        // ── Evento de selección ──────────────────────────────────────────────
        // API weekly: el evento es "gmp-select" y lleva `placePrediction`,
        // no `place`. Se convierte con .toPlace() y luego fetchFields().
        el.addEventListener("gmp-select", async (evt: Event) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const prediction = (evt as any).placePrediction;
          if (!prediction) {
            console.warn("[Places] gmp-select sin placePrediction", evt);
            return;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const place: google.maps.places.Place = (prediction as any).toPlace();

          let comps: AnyAddressComp[] = [];
          try {
            await place.fetchFields({ fields: ["addressComponents", "formattedAddress"] });
            comps = (place.addressComponents ?? []) as AnyAddressComp[];
          } catch {
            // fetchFields puede fallar si Places API (New) no está habilitada en GCP
          }

          // ── Extraer campos ────────────────────────────────────────────────
          const route  = getComponent(comps, "route");
          const num    = getComponent(comps, "street_number");
          const calle  = route
            ? `${route}${num ? `, ${num}` : ""}`
            : (place.formattedAddress?.split(",")[0] ?? "");

          const ciudad = getComponent(comps, "locality") || getComponent(comps, "postal_town");
          const prov   = getComponent(comps, "administrative_area_level_2")
                      || getComponent(comps, "administrative_area_level_1");
          const cp     = getComponent(comps, "postal_code");
          const pais   = getComponent(comps, "country", /* short= */ true);

          // Actualizar hidden input (FormData.get("calle"))
          if (hiddenRef.current) hiddenRef.current.value = calle;

          // Llamar setters solo si hay valor — no sobreescribir con string vacío
          // (Google no siempre devuelve postal_code para calles sin número)
          if (ciudad) setCiudad(ciudad);
          if (cp)     setCodigoPostal(cp);
          if (prov)   setProvincia(prov);
          if (pais)   setPais(pais);
        });
      },
    );

    return () => { cancelled = true; gmpEl?.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback manual: API no disponible (sin key o carga fallida)
  if (!apiAvailable) {
    return (
      <input
        type="text"
        name={name}
        id={id}
        required={required}
        defaultValue={String(defaultValue ?? "")}
        placeholder={placeholder ?? "Calle y número"}
        className={className}
      />
    );
  }

  return (
    <>
      {/* display:contents → sin espacio en layout; gmp ocupa el slot directamente */}
      <div ref={mountRef} style={{ display: "contents" }} />

      {/* Input hidden: lleva name + value al FormData. NO es visible. */}
      <input
        ref={hiddenRef}
        type="hidden"
        name={name}
        required={required}
        defaultValue={String(defaultValue ?? "")}
      />
    </>
  );
}
