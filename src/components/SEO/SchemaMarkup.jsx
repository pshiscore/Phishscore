import { useEffect } from "react";

/**
 * Injects a JSON-LD structured data block into document.head.
 * Safely removed on unmount — safe for SPA route transitions.
 */
export default function SchemaMarkup({ schema }) {
  useEffect(() => {
    if (!schema) return;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "schema-markup-" + (schema["@type"] || "generic");
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
    return () => {
      const existing = document.getElementById(script.id);
      if (existing) document.head.removeChild(existing);
    };
  }, [schema]);

  return null;
}
