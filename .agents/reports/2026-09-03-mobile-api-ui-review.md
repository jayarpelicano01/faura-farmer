# Mobile API and web-aligned UI review

- Worktree/branch: `main`, `C:\Users\LENOVO\Documents\jayar\Projects\faura-farmer`.
- Production touched: no.

Static review result: pass for local/staging handoff.

- Every root, auth, tab, data, and modal screen is inside the `SafeAreaProvider` and uses the shared safe-area screen primitive; the status bar is explicitly light-surface/dark-content.
- The same web favicon is used as native icon metadata and the in-app mark. Albert Sans is used for body and controls, while Unbounded is used for display hierarchy.
- Light-mode colors, radius, card border/shadow treatment, fields, buttons, and touch targets originate from a single native token layer aligned to the web app's default palette.
- Login/register errors distinguish no mobile URL, invalid URL, inaccessible local server, production URL, and disabled server gate. Local logout remains safe when the server cannot be reached.
- Native lists retain scroll behavior; forms use native modal presentation, Pressable controls, and keyboard-friendly scroll containers.

Release acceptance remaining: confirm all display/cutout behavior and authenticated lifecycle flows on an Android development build using a deliberately provisioned staging account. This is an external acceptance requirement, not an observed implementation defect.
