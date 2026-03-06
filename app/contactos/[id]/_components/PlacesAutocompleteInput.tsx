// ============================================================================
// app/contactos/[id]/_components/PlacesAutocompleteInput.tsx
//
// @role: Agente de Frontend (Client Component)
// @spec: Micro-Spec 2.7 — Campo Calle con Google Places Autocomplete
//
// Wrapper del input de calle que inicializa google.maps.places.Autocomplete.
// Cuando el usuario elige una sugerencia, el callback onPlaceSelect devuelve
// los componentes parseados (calle, ciudad, provincia, cp, pais ISO-2) para
// que el formulario padre rellene los campos restantes automáticamente.
//
// Requiere: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en .env
//           @googlemaps/js-api-loader  @types/google.maps
// ============================================================================
"use client";

import { forwardRef, useEffect, useRef } from "react";
import { Loader } from "@googlemaps/js-api-loader";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PlaceFields = {
  calle:         string;
  ciudad:        string;
  provincia:     string;
  codigo_postal: string;
  pais:          string; // ISO 3166-1 alpha-2 (ej: "ES")
};

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  onPlaceSelect: (fields: PlaceFields) => void;
}

// ─── Singleton Loader — se instancia una sola vez por key ────────────────────

let loaderPromise: Promise<typeof google> | null = null;

function getLoader(apiKey: string): Promise<typeof google> {
  if (!loaderPromise) {
    loaderPromise = new Loader({
      apiKey,
      version: "weekly",
      libraries: ["places"],
    }).load();
  }
  return loaderPromise;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export const PlacesAutocompleteInput = forwardRef<HTMLInputElement, Props>(
  function PlacesAutocompleteInput({ onPlaceSelect, ...inputProps }, forwardedRef) {
    const internalRef = useRef<HTMLInputElement>(null);

    // Merge refs: usamos internalRef para la lógica; forwardedRef para el padre
    function setRefs(el: HTMLInputElement | null) {
      (internalRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
      if (typeof forwardedRef === "function") forwardedRef(el);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
    }

    useEffect(() => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) return; // Sin key → input funciona como campo de texto normal

      let listener: google.maps.MapsEventListener | undefined;
      let mapsInstance: typeof google.maps | undefined;

      getLoader(apiKey).then((g) => {
        const el = internalRef.current;
        if (!el) return;

        mapsInstance = g.maps;

        const ac = new g.maps.places.Autocomplete(el, {
          types:  ["address"],
          fields: ["address_components"],
        });

        listener = ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (!place.address_components) return;

          const get = (type: string, short = false) =>
            place.address_components!.find((c) => c.types.includes(type))?.[
              short ? "short_name" : "long_name"
            ] ?? "";

          const route = get("route");
          const num   = get("street_number");

          onPlaceSelect({
            // Google ya puso el texto en el input; normalizamos la calle
            calle:         route ? `${route}${num ? `, ${num}` : ""}` : el.value,
            ciudad:        get("locality") || get("postal_town"),
            provincia:     get("administrative_area_level_2") || get("administrative_area_level_1"),
            codigo_postal: get("postal_code"),
            pais:          get("country", /* short= */ true),
          });
        });
      });

      return () => {
        if (listener && mapsInstance) {
          mapsInstance.event.removeListener(listener);
        }
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return <input ref={setRefs} {...inputProps} />;
  },
);
