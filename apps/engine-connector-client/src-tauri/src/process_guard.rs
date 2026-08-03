//! Bindet alle Kindprozesse des Command Centers an ein Windows Job Object mit
//! `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`.
//!
//! Warum: die gehosteten Dienste (`next start` für Studio/Portal/Brain/Family/
//! Landing) und `cloudflared` werden bewusst abgekoppelt gestartet (`detached` +
//! `unref`), damit sie das kurzlebige Node-CLI überleben, das sie startet.
//! Genau dadurch überlebten sie bisher aber auch das Command Center selbst:
//! uweanddragons.org blieb öffentlich erreichbar, während die Steuerungs-App
//! längst beendet oder abgestürzt war. Der geordnete Weg räumt beim Beenden auf
//! (siehe `exit_app`); dieses Job Object ist die Absicherung für die Fälle, in
//! denen kein Code mehr läuft: Absturz, `taskkill`, harter Abbruch.
//!
//! Windows räumt Job-Mitglieder auf, sobald das letzte Handle auf den Job
//! geschlossen wird. Das Handle bleibt darum absichtlich für die gesamte
//! Prozesslebensdauer offen (geleakt) — es wird erst vom Kernel freigegeben,
//! wenn der Command-Center-Prozess verschwindet. Genau dann sollen die Dienste
//! mitgehen.
//!
//! Ein Job mit `KILL_ON_JOB_CLOSE` erfasst per Vererbung *alle* Nachfahren, also
//! auch solche, die nicht sterben sollen — vor allem der Browser hinter „Im
//! Browser öffnen" (`cmd /c start "" <url>`). Deshalb erlaubt der Job
//! `BREAKAWAY_OK`, und die entsprechenden Aufrufe lösen sich mit
//! `CREATE_BREAKAWAY_FROM_JOB` aus dem Job heraus (siehe
//! `configure_breakaway_process`).

/// `CREATE_BREAKAWAY_FROM_JOB` — der Kindprozess (und sein Teilbaum) gehört
/// nicht zum Job des Elternprozesses und stirbt daher nicht mit dem Command
/// Center. Nur für Prozesse, die den Nutzer überleben sollen: geöffnete Browser
/// und Explorer-Fenster.
#[cfg(target_os = "windows")]
pub const CREATE_BREAKAWAY_FROM_JOB: u32 = 0x0100_0000;

#[cfg(target_os = "windows")]
mod windows_job {
    use std::ffi::c_void;

    type Handle = *mut c_void;

    // JOBOBJECT_BASIC_LIMIT_INFORMATION::LimitFlags
    const JOB_OBJECT_LIMIT_BREAKAWAY_OK: u32 = 0x0000_0800;
    const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: u32 = 0x0000_2000;
    /// `JOBOBJECTINFOCLASS::JobObjectExtendedLimitInformation`
    const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION: i32 = 9;

    #[repr(C)]
    #[derive(Default)]
    struct IoCounters {
        read_operation_count: u64,
        write_operation_count: u64,
        other_operation_count: u64,
        read_transfer_count: u64,
        write_transfer_count: u64,
        other_transfer_count: u64,
    }

    #[repr(C)]
    #[derive(Default)]
    struct JobObjectBasicLimitInformation {
        per_process_user_time_limit: i64,
        per_job_user_time_limit: i64,
        limit_flags: u32,
        minimum_working_set_size: usize,
        maximum_working_set_size: usize,
        active_process_limit: u32,
        affinity: usize,
        priority_class: u32,
        scheduling_class: u32,
    }

    #[repr(C)]
    #[derive(Default)]
    struct JobObjectExtendedLimitInformation {
        basic_limit_information: JobObjectBasicLimitInformation,
        io_info: IoCounters,
        process_memory_limit: usize,
        job_memory_limit: usize,
        peak_process_memory_used: usize,
        peak_job_memory_used: usize,
    }

    extern "system" {
        fn CreateJobObjectW(attributes: *const c_void, name: *const u16) -> Handle;
        fn SetInformationJobObject(
            job: Handle,
            info_class: i32,
            info: *const c_void,
            info_len: u32,
        ) -> i32;
        fn AssignProcessToJobObject(job: Handle, process: Handle) -> i32;
        fn GetCurrentProcess() -> Handle;
        fn CloseHandle(handle: Handle) -> i32;
    }

    /// Legt den Job an und hängt den laufenden Prozess hinein. Fehlschläge sind
    /// nicht fatal: dann fehlt nur die Absicherung gegen Abstürze, der geordnete
    /// Weg über `exit_app` räumt weiterhin auf.
    pub fn install() -> Result<(), String> {
        // SAFETY: reine Win32-Aufrufe mit selbst gehaltenen, gültigen Zeigern.
        // Das Job-Handle wird bewusst nicht geschlossen (siehe Modulkommentar);
        // nur auf dem Fehlerpfad geben wir es zurück, damit kein Job ohne
        // Mitglieder mit `KILL_ON_JOB_CLOSE` zurückbleibt.
        unsafe {
            let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if job.is_null() {
                return Err("Job Object konnte nicht erstellt werden.".to_string());
            }

            let mut limits = JobObjectExtendedLimitInformation::default();
            limits.basic_limit_information.limit_flags =
                JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_BREAKAWAY_OK;

            let ok = SetInformationJobObject(
                job,
                JOB_OBJECT_EXTENDED_LIMIT_INFORMATION,
                &limits as *const _ as *const c_void,
                std::mem::size_of::<JobObjectExtendedLimitInformation>() as u32,
            );
            if ok == 0 {
                CloseHandle(job);
                return Err("Job-Object-Grenzen konnten nicht gesetzt werden.".to_string());
            }

            if AssignProcessToJobObject(job, GetCurrentProcess()) == 0 {
                CloseHandle(job);
                return Err(
                    "Command Center konnte dem Job Object nicht zugeordnet werden.".to_string(),
                );
            }
        }
        Ok(())
    }
}

/// Sorgt dafür, dass Kindprozesse dieses Prozesses beim Verschwinden des Command
/// Centers mit aufgeräumt werden. Auf Nicht-Windows ein No-op: dort übernimmt
/// der geordnete Teardown, und die POSIX-Variante von `stopProcess` schießt
/// bereits die ganze Prozessgruppe ab.
pub fn install_child_process_guard() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        windows_job::install()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}
