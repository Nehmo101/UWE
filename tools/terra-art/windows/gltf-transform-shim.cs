// Startprogramm fuer die glTF-Transform-CLI unter Windows.
//
// tools/terra-art/cli.mjs startet externe Werkzeuge mit spawnSync(name, args)
// ohne shell:true. Node ab Version 20 fuehrt auf Windows keine .cmd-Dateien
// mehr direkt aus (ENOENT ueber den Namen, EINVAL ueber den vollen Pfad).
// Ein global per npm installiertes gltf-transform liegt aber nur als .cmd,
// .ps1 und Shell-Skript vor und wird deshalb nie erkannt.
//
// Dieses Programm ist eine echte .exe, reicht alle Argumente an
// node.exe <cli.js> weiter und gibt den Exit-Code unveraendert zurueck.
// Bauen und einrichten: tools/terra-art/windows/setup.ps1
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;

static class Shim
{
    static int Main(string[] args)
    {
        string node = Resolve("TERRA_SHIM_NODE", NodeCandidates());
        if (node == null)
        {
            Console.Error.WriteLine("gltf-transform-shim: node.exe nicht gefunden.");
            return 127;
        }

        string cli = Resolve("TERRA_SHIM_CLI", CliCandidates());
        if (cli == null)
        {
            Console.Error.WriteLine("gltf-transform-shim: @gltf-transform/cli nicht gefunden. "
                + "Erst `npm install -g @gltf-transform/cli` ausfuehren.");
            return 127;
        }

        var arguments = new StringBuilder();
        arguments.Append('"').Append(cli).Append('"');
        foreach (var value in args)
        {
            arguments.Append(" \"").Append(value.Replace("\"", "\\\"")).Append('"');
        }

        var start = new ProcessStartInfo(node, arguments.ToString());
        start.UseShellExecute = false;
        using (var process = Process.Start(start))
        {
            process.WaitForExit();
            return process.ExitCode;
        }
    }

    // Umgebungsvariable schlaegt Suchreihenfolge; erster vorhandener Pfad gewinnt.
    static string Resolve(string variable, IEnumerable<string> candidates)
    {
        string configured = Environment.GetEnvironmentVariable(variable);
        if (!string.IsNullOrEmpty(configured) && File.Exists(configured)) return configured;
        foreach (var candidate in candidates)
        {
            if (!string.IsNullOrEmpty(candidate) && File.Exists(candidate)) return candidate;
        }
        return null;
    }

    static IEnumerable<string> NodeCandidates()
    {
        string path = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var directory in path.Split(';'))
        {
            if (directory.Length == 0) continue;
            string candidate;
            try { candidate = Path.Combine(directory.Trim('"'), "node.exe"); }
            catch (ArgumentException) { continue; }
            yield return candidate;
        }
        yield return @"C:\Program Files\nodejs\node.exe";
    }

    static IEnumerable<string> CliCandidates()
    {
        const string Entry = @"node_modules\@gltf-transform\cli\bin\cli.js";
        string appData = Environment.GetEnvironmentVariable("APPDATA");
        string localAppData = Environment.GetEnvironmentVariable("LOCALAPPDATA");
        if (!string.IsNullOrEmpty(appData)) yield return Path.Combine(appData, "npm", Entry);
        if (!string.IsNullOrEmpty(localAppData))
        {
            string pnpm = Path.Combine(localAppData, @"pnpm\global");
            if (Directory.Exists(pnpm))
            {
                foreach (var version in Directory.GetDirectories(pnpm))
                {
                    yield return Path.Combine(version, Entry);
                }
            }
        }
    }
}
