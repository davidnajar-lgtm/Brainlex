// ============================================================================
// lib/i18n/contactos.ts — Diccionario i18n para el módulo de Contactos
//
// Soporta ES · EN · FR. Exporta `getContactosLabels(locale)`.
// Diseñado para migración directa a next-intl: sustituir `getContactosLabels`
// por `useTranslations("contactos")` cuando se instale la librería.
// ============================================================================

export type AppLocale = "es" | "en" | "fr";

export interface ContactosLabels {
  sections: {
    identidad:          string;
    canalesContacto:    string;
    direcciones:        string;
    canalesAdicionales: string;
  };
  fields: {
    tipo:           string;
    nombre:         string;
    razonSocial:    string;
    fiscalId:       string;
    emailPrincipal: string;
    telefonoMovil:  string;
    telefonoFijo:   string;
    websiteUrl:     string;
    linkedinUrl:    string;
  };
  /** Etiquetas para el enum CanalTipo de Prisma. */
  canalTipo: Record<string, string>;
  badges: {
    preferido:       string;
    personaFisica:   string;
    personaJuridica: string;
  };
  emptyStates: {
    noDirecciones:      string;
    noCanales:          string;
    noCanalesDirectos:  string;
    noExpedientes:      string;
    noAuditLogs:        string;
  };
  direccionTipo: Record<string, string>;
  /** TabAdmin — Ciclo de vida y AuditLog */
  admin: {
    cicloDeVida:            string;
    motivoCuarentena:       string;
    plazoConservacion:      string;
    historialAuditoria:     string;
    registros:              string;
    registro:               string;
    statusDesc: {
      ACTIVE:     string;
      QUARANTINE: string;
      FORGOTTEN:  string;
    };
    statusLabel: {
      ACTIVE:     string;
      QUARANTINE: string;
      FORGOTTEN:  string;
    };
    auditAction: {
      CREATE:     string;
      READ:       string;
      UPDATE:     string;
      QUARANTINE: string;
      RESTORE:    string;
      FORGET:     string;
    };
  };
  /** TabOperativa — Expedientes */
  operativa: {
    sinExpedientes:       string;
    sinExpedientesDesc:   string;
    expedientesVinculados: string; // "{n} expediente(s) vinculado(s)"
    verExpediente:        string;
    fueraDeCuota:         string;
  };
  /** RestoreButton */
  restore: {
    label:            string;
    confirmTitle:     string;
    confirmDesc:      string;
    confirmYes:       string;
    confirmNo:        string;
    restoring:        string;
  };
  /** @Knowledge-Librarian — Ayuda contextual para usuario final */
  help: {
    telefonoFormato:     string;
    canalPreferido:      string;
    buscarRazonSocial:   string;
    emailPrincipal:      string;
    sinNifExplicacion:   string;
    direccionTipo:       string;
    linkedinFormato:     string;
    websiteFormato:      string;
  };
  /** Bóveda — Descarga ZIP */
  boveda: {
    descargarTodo:    string;
    descargarCarpeta: string;
    generando:        string;
    errorDescarga:    string;
    bovedaVacia:      string;
    sinAcceso:        string;
    docPermanente:    string;
    docPermanenteDesc: string;
    mirrorSynced:     string;
  };
  /** Relaciones */
  relaciones: {
    titulo:           string;
    sinRelaciones:    string;
    sinRelacionesDesc: string;
    nuevaRelacion:    string;
    tipoRelacion:     string;
    buscarContacto:   string;
    cargo:            string;
    notas:            string;
  };
}

// ─── ES ───────────────────────────────────────────────────────────────────────

const ES: ContactosLabels = {
  sections: {
    identidad:          "Identidad y Datos Base",
    canalesContacto:    "Canales de Contacto",
    direcciones:        "Direcciones Registradas",
    canalesAdicionales: "Canales Adicionales",
  },
  fields: {
    tipo:           "Tipo",
    nombre:         "Nombre",
    razonSocial:    "Razón Social",
    fiscalId:       "ID Fiscal",
    emailPrincipal: "Email Principal",
    telefonoMovil:  "Móvil",
    telefonoFijo:   "Fijo",
    websiteUrl:     "Sitio Web",
    linkedinUrl:    "LinkedIn",
  },
  canalTipo: {
    TELEFONO: "Teléfono",
    EMAIL:    "Email",
    WEB:      "Web",
    LINKEDIN: "LinkedIn",
    WHATSAPP: "WhatsApp",
    FAX:      "Fax",
  },
  badges: {
    preferido:       "Preferido",
    personaFisica:   "Persona Física",
    personaJuridica: "Persona Jurídica",
  },
  emptyStates: {
    noDirecciones:      "No hay direcciones adicionales registradas.",
    noCanales:          "No hay canales adicionales registrados.",
    noCanalesDirectos:  "No hay datos de contacto directo registrados.",
    noExpedientes:      "Sin expedientes vinculados",
    noAuditLogs:        "Sin registros de auditoría todavía.",
  },
  direccionTipo: {
    FISCAL:           "Fiscal",
    DOMICILIO_SOCIAL: "Domicilio Social",
    WORKPLACE:        "Workplace / Obra",
    OTRO:             "Otro",
  },
  admin: {
    cicloDeVida:        "Ciclo de Vida",
    motivoCuarentena:   "Motivo de cuarentena",
    plazoConservacion:  "Plazo de conservación hasta",
    historialAuditoria: "Historial de Auditoría",
    registros:          "registros",
    registro:           "registro",
    statusLabel: {
      ACTIVE:     "Activo",
      QUARANTINE: "En Cuarentena",
      FORGOTTEN:  "Olvidado (RGPD)",
    },
    statusDesc: {
      ACTIVE:     "El contacto está operativo y visible en el directorio.",
      QUARANTINE: "El contacto está archivado. No aparece en búsquedas y está pendiente de revisión legal.",
      FORGOTTEN:  "Crypto-shredding ejecutado. Solo se conservan NIF y Razón Social por obligación tributaria.",
    },
    auditAction: {
      CREATE:     "Alta",
      READ:       "Consulta",
      UPDATE:     "Modificación",
      QUARANTINE: "Cuarentena",
      RESTORE:    "Restauración",
      FORGET:     "Borrado RGPD",
    },
  },
  operativa: {
    sinExpedientes:        "Sin expedientes vinculados",
    sinExpedientesDesc:    "Los expedientes se crearán desde el módulo de Operativa y quedarán automáticamente vinculados a este contacto.",
    expedientesVinculados: "expediente(s) vinculado(s)",
    verExpediente:         "Ver expediente completo",
    fueraDeCuota:          "FUERA DE CUOTA",
  },
  restore: {
    label:        "Restaurar a ACTIVO",
    confirmTitle: "¿Confirmar restauración?",
    confirmDesc:  "El contacto volverá a estar ACTIVO. Se registrará en el AuditLog. Esta acción es reversible.",
    confirmYes:   "Sí, restaurar",
    confirmNo:    "Cancelar",
    restoring:    "Restaurando…",
  },
  help: {
    telefonoFormato:     "Incluye el prefijo del país. Ej: +34 600 123 456. Selecciona la bandera para cambiar de país.",
    canalPreferido:      "Indica si este contacto prefiere que le contactes por Email o por Móvil. No afecta al envío, solo es informativo.",
    buscarRazonSocial:   "Pulsa el botón de Google para buscar la empresa y rellenar automáticamente el nombre y la dirección.",
    emailPrincipal:      "El email principal se usa para comunicaciones oficiales. Puedes añadir más emails en Canales Adicionales.",
    sinNifExplicacion:   "Este contacto no tiene datos fiscales. No podrá recibir facturas oficiales hasta que se complete el NIF/CIF.",
    direccionTipo:       "Fiscal = dirección de facturación. Domicilio Social = sede legal. Workplace = centro de trabajo u obra.",
    linkedinFormato:     "Pega la URL completa del perfil. Ej: https://linkedin.com/in/nombre-usuario",
    websiteFormato:      "Se añade https:// automáticamente si no lo escribes. Ej: www.empresa.com",
  },
  boveda: {
    descargarTodo:    "Descargar todo (.zip)",
    descargarCarpeta: "Descargar carpeta (.zip)",
    generando:        "Generando...",
    errorDescarga:    "Error al generar el archivo ZIP.",
    bovedaVacia:      "La bóveda está vacía. No hay carpetas para descargar.",
    sinAcceso:        "No hay carpetas accesibles para descargar.",
    docPermanente:    "Documentación Permanente",
    docPermanenteDesc: "NIF, Escrituras, Poderes — compartida con todo el Holding.",
    mirrorSynced:     "Sincronizado con espejo",
  },
  relaciones: {
    titulo:            "Relaciones",
    sinRelaciones:     "Sin relaciones",
    sinRelacionesDesc: "Añade vínculos con otros contactos: socios, administradores, representantes legales.",
    nuevaRelacion:     "Nueva relación",
    tipoRelacion:      "Tipo de relación",
    buscarContacto:    "Buscar contacto...",
    cargo:             "Cargo / Rol",
    notas:             "Notas",
  },
};

// ─── EN ───────────────────────────────────────────────────────────────────────

const EN: ContactosLabels = {
  sections: {
    identidad:          "Identity & Basic Data",
    canalesContacto:    "Contact Channels",
    direcciones:        "Registered Addresses",
    canalesAdicionales: "Additional Channels",
  },
  fields: {
    tipo:           "Type",
    nombre:         "Name",
    razonSocial:    "Company Name",
    fiscalId:       "Tax ID",
    emailPrincipal: "Primary Email",
    telefonoMovil:  "Mobile",
    telefonoFijo:   "Landline",
    websiteUrl:     "Website",
    linkedinUrl:    "LinkedIn",
  },
  canalTipo: {
    TELEFONO: "Phone",
    EMAIL:    "Email",
    WEB:      "Web",
    LINKEDIN: "LinkedIn",
    WHATSAPP: "WhatsApp",
    FAX:      "Fax",
  },
  badges: {
    preferido:       "Preferred",
    personaFisica:   "Individual",
    personaJuridica: "Company",
  },
  emptyStates: {
    noDirecciones:      "No additional addresses registered.",
    noCanales:          "No additional channels registered.",
    noCanalesDirectos:  "No direct contact data registered.",
    noExpedientes:      "No linked matters",
    noAuditLogs:        "No audit records yet.",
  },
  direccionTipo: {
    FISCAL:           "Tax Address",
    DOMICILIO_SOCIAL: "Registered Office",
    WORKPLACE:        "Workplace / Site",
    OTRO:             "Other",
  },
  admin: {
    cicloDeVida:        "Lifecycle",
    motivoCuarentena:   "Quarantine reason",
    plazoConservacion:  "Retention period until",
    historialAuditoria: "Audit History",
    registros:          "records",
    registro:           "record",
    statusLabel: {
      ACTIVE:     "Active",
      QUARANTINE: "In Quarantine",
      FORGOTTEN:  "Forgotten (GDPR)",
    },
    statusDesc: {
      ACTIVE:     "The contact is operational and visible in the directory.",
      QUARANTINE: "The contact is archived. It does not appear in searches and is pending legal review.",
      FORGOTTEN:  "Crypto-shredding executed. Only Tax ID and Company Name are retained for accounting obligations.",
    },
    auditAction: {
      CREATE:     "Created",
      READ:       "Viewed",
      UPDATE:     "Updated",
      QUARANTINE: "Quarantined",
      RESTORE:    "Restored",
      FORGET:     "GDPR Deletion",
    },
  },
  operativa: {
    sinExpedientes:        "No linked matters",
    sinExpedientesDesc:    "Matters will be created from the Operations module and automatically linked to this contact.",
    expedientesVinculados: "linked matter(s)",
    verExpediente:         "View full matter",
    fueraDeCuota:          "OUT OF SCOPE",
  },
  restore: {
    label:        "Restore to ACTIVE",
    confirmTitle: "Confirm restoration?",
    confirmDesc:  "The contact will be set back to ACTIVE. This will be recorded in the Audit Log. This action is reversible.",
    confirmYes:   "Yes, restore",
    confirmNo:    "Cancel",
    restoring:    "Restoring…",
  },
  help: {
    telefonoFormato:     "Include the country code. E.g.: +34 600 123 456. Select the flag to change country.",
    canalPreferido:      "Indicates whether this contact prefers to be reached by Email or Mobile. Informational only — does not affect sending.",
    buscarRazonSocial:   "Click the Google button to search for the company and auto-fill the name and address.",
    emailPrincipal:      "The primary email is used for official communications. You can add more emails in Additional Channels.",
    sinNifExplicacion:   "This contact has no tax data. They cannot receive official invoices until a Tax ID is provided.",
    direccionTipo:       "Tax = billing address. Registered Office = legal headquarters. Workplace = work site or office.",
    linkedinFormato:     "Paste the full profile URL. E.g.: https://linkedin.com/in/username",
    websiteFormato:      "https:// is added automatically if omitted. E.g.: www.company.com",
  },
  boveda: {
    descargarTodo:    "Download all (.zip)",
    descargarCarpeta: "Download folder (.zip)",
    generando:        "Generating...",
    errorDescarga:    "Error generating the ZIP file.",
    bovedaVacia:      "The vault is empty. No folders to download.",
    sinAcceso:        "No accessible folders to download.",
    docPermanente:    "Permanent Documentation",
    docPermanenteDesc: "Tax ID, Deeds, Powers of Attorney — shared across the entire Holding.",
    mirrorSynced:     "Synced with mirror",
  },
  relaciones: {
    titulo:            "Relationships",
    sinRelaciones:     "No relationships",
    sinRelacionesDesc: "Add links to other contacts: partners, directors, legal representatives.",
    nuevaRelacion:     "New relationship",
    tipoRelacion:      "Relationship type",
    buscarContacto:    "Search contact...",
    cargo:             "Position / Role",
    notas:             "Notes",
  },
};

// ─── FR ───────────────────────────────────────────────────────────────────────

const FR: ContactosLabels = {
  sections: {
    identidad:          "Identité et Données de Base",
    canalesContacto:    "Canaux de Contact",
    direcciones:        "Adresses Enregistrées",
    canalesAdicionales: "Canaux Supplémentaires",
  },
  fields: {
    tipo:           "Type",
    nombre:         "Nom",
    razonSocial:    "Raison Sociale",
    fiscalId:       "Identifiant Fiscal",
    emailPrincipal: "Email Principal",
    telefonoMovil:  "Mobile",
    telefonoFijo:   "Fixe",
    websiteUrl:     "Site Web",
    linkedinUrl:    "LinkedIn",
  },
  canalTipo: {
    TELEFONO: "Téléphone",
    EMAIL:    "Email",
    WEB:      "Web",
    LINKEDIN: "LinkedIn",
    WHATSAPP: "WhatsApp",
    FAX:      "Fax",
  },
  badges: {
    preferido:       "Préféré",
    personaFisica:   "Personne Physique",
    personaJuridica: "Personne Morale",
  },
  emptyStates: {
    noDirecciones:      "Aucune adresse supplémentaire enregistrée.",
    noCanales:          "Aucun canal supplémentaire enregistré.",
    noCanalesDirectos:  "Aucune donnée de contact direct enregistrée.",
    noExpedientes:      "Aucun dossier lié",
    noAuditLogs:        "Aucun enregistrement d'audit pour l'instant.",
  },
  direccionTipo: {
    FISCAL:           "Adresse Fiscale",
    DOMICILIO_SOCIAL: "Siège Social",
    WORKPLACE:        "Site / Chantier",
    OTRO:             "Autre",
  },
  admin: {
    cicloDeVida:        "Cycle de Vie",
    motivoCuarentena:   "Motif de mise en quarantaine",
    plazoConservacion:  "Période de conservation jusqu'au",
    historialAuditoria: "Historique d'Audit",
    registros:          "enregistrements",
    registro:           "enregistrement",
    statusLabel: {
      ACTIVE:     "Actif",
      QUARANTINE: "En Quarantaine",
      FORGOTTEN:  "Oublié (RGPD)",
    },
    statusDesc: {
      ACTIVE:     "Le contact est opérationnel et visible dans le répertoire.",
      QUARANTINE: "Le contact est archivé. Il n'apparaît pas dans les recherches et est en attente de révision légale.",
      FORGOTTEN:  "Crypto-shredding exécuté. Seuls le NIF et la Raison Sociale sont conservés par obligation comptable.",
    },
    auditAction: {
      CREATE:     "Création",
      READ:       "Consultation",
      UPDATE:     "Modification",
      QUARANTINE: "Mise en quarantaine",
      RESTORE:    "Restauration",
      FORGET:     "Suppression RGPD",
    },
  },
  operativa: {
    sinExpedientes:        "Aucun dossier lié",
    sinExpedientesDesc:    "Les dossiers seront créés depuis le module Opérations et automatiquement liés à ce contact.",
    expedientesVinculados: "dossier(s) lié(s)",
    verExpediente:         "Voir le dossier complet",
    fueraDeCuota:          "HORS FORFAIT",
  },
  restore: {
    label:        "Restaurer en ACTIF",
    confirmTitle: "Confirmer la restauration ?",
    confirmDesc:  "Le contact sera remis en état ACTIF. Cela sera enregistré dans le journal d'audit. Cette action est réversible.",
    confirmYes:   "Oui, restaurer",
    confirmNo:    "Annuler",
    restoring:    "Restauration en cours…",
  },
  help: {
    telefonoFormato:     "Inclure l'indicatif du pays. Ex : +34 600 123 456. Sélectionnez le drapeau pour changer de pays.",
    canalPreferido:      "Indique si ce contact préfère être contacté par Email ou par Mobile. Informatif uniquement.",
    buscarRazonSocial:   "Cliquez sur le bouton Google pour rechercher l'entreprise et remplir automatiquement le nom et l'adresse.",
    emailPrincipal:      "L'email principal est utilisé pour les communications officielles. Vous pouvez ajouter d'autres emails dans les Canaux Supplémentaires.",
    sinNifExplicacion:   "Ce contact n'a pas de données fiscales. Il ne peut pas recevoir de factures officielles tant qu'un identifiant fiscal n'est pas fourni.",
    direccionTipo:       "Fiscale = adresse de facturation. Siège Social = siège juridique. Site = lieu de travail ou chantier.",
    linkedinFormato:     "Collez l'URL complète du profil. Ex : https://linkedin.com/in/nom-utilisateur",
    websiteFormato:      "https:// est ajouté automatiquement si omis. Ex : www.entreprise.com",
  },
  boveda: {
    descargarTodo:    "Tout télécharger (.zip)",
    descargarCarpeta: "Télécharger le dossier (.zip)",
    generando:        "Génération en cours...",
    errorDescarga:    "Erreur lors de la génération du fichier ZIP.",
    bovedaVacia:      "Le coffre est vide. Aucun dossier à télécharger.",
    sinAcceso:        "Aucun dossier accessible à télécharger.",
    docPermanente:    "Documentation Permanente",
    docPermanenteDesc: "NIF, Actes, Procurations — partagée avec tout le Holding.",
    mirrorSynced:     "Synchronisé avec le miroir",
  },
  relaciones: {
    titulo:            "Relations",
    sinRelaciones:     "Aucune relation",
    sinRelacionesDesc: "Ajoutez des liens avec d'autres contacts : associés, administrateurs, représentants légaux.",
    nuevaRelacion:     "Nouvelle relation",
    tipoRelacion:      "Type de relation",
    buscarContacto:    "Rechercher un contact...",
    cargo:             "Poste / Rôle",
    notas:             "Notes",
  },
};

// ─── Lookup ───────────────────────────────────────────────────────────────────

const DICT: Record<AppLocale, ContactosLabels> = { es: ES, en: EN, fr: FR };

export function getContactosLabels(locale: AppLocale = "es"): ContactosLabels {
  return DICT[locale] ?? ES;
}
