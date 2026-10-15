# What is public and what stays with you

The default site contains application code and two original sample works. Adding a book reads it with the browser File API and saves it to that browser's IndexedDB. Notes, reading places, preferences and spoiler boundaries are also in IndexedDB. No import or annotation request is made to a server. The application has no analytics, remote fonts, third-party scripts or map requests.

This is local browser storage, not encrypted vault storage. Someone using your browser profile or compromised same-origin code may access it. The host serves the application and may keep ordinary access logs. Extensions and the device's security remain relevant. Do not imply the repository's private setting or the application's noindex header is access control.

The application and original samples are cached for offline use. Imported books stay in IndexedDB, outside the public service-worker manifest. Browsers can evict or clear both stores. The offline indicator verifies the application cache; it is not a backup or a promise of indefinite retention. Keep original files and export your notes. The export contains exact quotations and personal comments and belongs somewhere private.

Automatic device sync is not implemented. On a second device, import the original/prepared books again and restore an annotation backup. Current-device places are retained and missing places are recovered; spoiler boundaries remain explicit on that device. Opening an installed web app may use a different browser storage area than a tab, depending on the platform.

Never commit personal source, conversions, extracts, annotation fixtures, screenshots, intake notes, keys or configuration. Use ignored `.reader/` for local agent work, but remember that ignores do not scrub past commits. The public audit checks all reachable commits and the exact index/working files. Review the complete history before pushing. If private material was committed, stop publication and repair the boundary; deleting it in the next commit is insufficient.

To host books themselves, implement and test real access control first. Every raw asset, download, source map, alternate domain, preview, old deployment and content API needs the same policy. Client-side hiding and passwords embedded in JavaScript do not protect a static book URL. Do not cache private hosted responses in a public worker without a separate authenticated-cache design. See [deployment](DEPLOYMENT.md).
