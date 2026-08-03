import assert from "node:assert/strict";
import { describe, it } from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;

import { InstallAppPicker } from "./InstallAppPicker";
import {
  defaultPortValues,
  isValidPort,
  portConflicts,
  portsAreValid,
  portsForSelection,
  type InstallPortValues,
} from "./install-catalog";

/**
 * Die Portwahl der Ersteinrichtung.
 *
 * Der Assistent darf mit einer Wahl, die nicht startet, gar nicht erst
 * weitergehen: zwei Bereiche auf demselben Port oder ein privilegierter Port
 * fallen sonst erst am Ende der Installation auf, wenn der Dienst nicht
 * hochkommt.
 */

function render(props: {
  apps?: Array<"studio" | "portal" | "brain" | "family" | "landing">;
  ports?: InstallPortValues;
  busy?: boolean;
}): string {
  return renderToStaticMarkup(
    <InstallAppPicker
      apps={props.apps ?? ["studio", "portal"]}
      ports={props.ports ?? defaultPortValues()}
      seedDemoContent
      busy={props.busy ?? false}
      onChangeApps={() => {}}
      onChangePort={() => {}}
      onChangeSeed={() => {}}
    />,
  );
}

describe("Portprüfung", () => {
  it("nimmt Ports von 1024 bis 65535 an", () => {
    for (const value of ["1024", "3000", "65535", " 8080 "]) {
      assert.equal(isValidPort(value), true, `abgelehnt: ${value}`);
    }
  });

  it("lehnt privilegierte, zu große und keine Zahlen ab", () => {
    for (const value of ["80", "1023", "65536", "", "-1", "30 00", "3000a", "3000.5"]) {
      assert.equal(isValidPort(value), false, `angenommen: ${value}`);
    }
  });

  it("findet beide Bereiche, die sich einen Port teilen", () => {
    const conflicts = portConflicts(["studio", "portal", "brain"], {
      studio: "3000",
      portal: "3000",
      brain: "3102",
    });

    assert.deepEqual([...conflicts].sort(), ["portal", "studio"]);
  });

  it("zählt einen Port nicht als belegt, wenn die App gar nicht gewählt ist", () => {
    const conflicts = portConflicts(["studio"], { studio: "3000", portal: "3000" });

    assert.equal(conflicts.size, 0);
  });

  it("hält die Wahl erst für gültig, wenn jeder gewählte Bereich einen eigenen Port hat", () => {
    assert.equal(portsAreValid(["studio", "portal"], { studio: "3000", portal: "3001" }), true);
    assert.equal(portsAreValid(["studio", "portal"], { studio: "3000", portal: "3000" }), false);
    assert.equal(portsAreValid(["studio", "portal"], { studio: "3000" }), false);
    assert.equal(portsAreValid(["studio"], { studio: "80" }), false);
  });

  it("gibt für die Auswahl-Datei nur gewählte Apps mit gültigem Port als Zahl weiter", () => {
    const ports = portsForSelection(["studio", "brain"], {
      studio: "4000",
      brain: "80",
      portal: "3001",
    });

    assert.deepEqual(ports, { studio: 4000 });
  });

  it("schlägt die Standardports des Katalogs vor", () => {
    assert.deepEqual(defaultPortValues(), {
      studio: "3000",
      portal: "3001",
      brain: "3102",
      family: "3004",
      landing: "3103",
    });
  });
});

describe("Portfelder im Assistenten", () => {
  it("bietet je Bereich ein beschriftetes Portfeld an", () => {
    const markup = render({});

    for (const label of ["Studio", "Portal", "Brain", "Family", "Startseite"]) {
      assert.ok(markup.includes(`Port für UWE ${label}`) || markup.includes(`Port für ${label}`),
        `kein Portfeld für ${label}`);
    }
  });

  it("sperrt den Port eines nicht gewählten Bereichs", () => {
    const markup = render({ apps: ["studio"] });
    const fields = markup.split("install-app-option");
    const portalField = fields.find((part) => part.includes("Port für Portal"));

    assert.ok(portalField?.includes("disabled"), "Portfeld einer abgewählten App ist bedienbar");
  });

  it("benennt den Konflikt, statt ihn erst beim Start auffallen zu lassen", () => {
    const markup = render({
      apps: ["studio", "portal"],
      ports: { ...defaultPortValues(), portal: "3000" },
    });

    assert.match(markup, /denselben Port/);
    assert.match(markup, /aria-invalid="true"/);
  });

  it("meldet einen unerlaubten Port mit seinen Grenzen", () => {
    const markup = render({ apps: ["studio"], ports: { studio: "80" } });

    assert.match(markup, /zwischen 1024 und 65535/);
  });
});
