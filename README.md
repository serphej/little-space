# Lau’s Little Space

A personal React + Vite to-do dashboard made for Lau, with an Electron desktop companion named Mochi. Organize tasks, track focus sessions, switch between light and dark themes, and save locally. On Windows, the animated pixel-art dog walks beside your work, opens the dashboard, and shows interactive speech bubbles and task reminders.

## Requirements and setup

For development, use Node.js 22.12 or newer (Node.js 24 LTS is suitable), npm, and Git. Build and verify the Windows desktop version on a supported x64 Windows computer. The installed app does not require Node.js or VS Code. Internet access is needed to install dependencies and download Electron/packaging tools.

From the cloned project folder:

```powershell
npm ci
```

The committed `package-lock.json` pins dependency versions; `npm ci` installs those versions. Use `npm install` when intentionally changing dependencies.

## Command reference

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite web development server with automatic React updates. |
| `npm run build` | Build the web app and generate its offline service worker in `dist/`. |
| `npm run preview` | Preview the production web build locally. |
| `npm run desktop:dev` | Build React, then open Electron using bundled local files. Quit and restart after edits. |
| `npm run desktop:start` | Open Electron using the existing `dist/` build. |
| `npm run desktop:dist` | Build React and create the Windows NSIS x64 installer in `release/`. |
| `npm run lint` | Check JavaScript and React source with ESLint. |
| `npm test` | Run data, desktop geometry, and reminder logic tests. |
| `npm run desktop:test` | Build and run isolated Electron and web/PWA integration tests. |
| `npm run desktop:test:packaged` | Test the already packaged executable in `release/win-unpacked/`. |
| `node scripts/check-pwa.mjs` | Validate PWA assets and offline caching after a production build. |

Desktop integration tests use temporary profiles, briefly open windows, and on Windows move the mouse for one real bubble-button click before restoring its position. Avoid interacting with the desktop during that short test. They do not access your personal task profile.

## Windows installation

```powershell
npm ci
npm run desktop:dist
```

Quit any running copy from its tray menu, then double-click `release/Lau-Little-Space-Setup-1.0.0-x64.exe` and follow the installation wizard. Launch **Lau’s Little Space** from the Start menu or desktop shortcut. The installer bundles the dashboard, dog animations, and speech bubbles; everyday use needs no development server. This repository contains source and required assets; installers are generated locally and excluded from Git.

The installer is unsigned and may display a Windows unknown-publisher prompt. Keep the app ID and storage directory stable when packaging updates. Normal updates preserve tasks; export a JSON backup before installing an update. Automatic update delivery is not configured. Installation, uninstall, startup/reboot, and upgrade behavior still need manual verification on the target Windows computer.

## Local data and public source

Task lists and preferences are stored locally rather than in this repository. Browser/PWA storage and Electron storage are separate: use **Settings → Export JSON / Import JSON** to move tasks. Electron stores its profile under `%APPDATA%\LauLittleSpace`, outside the project. Never commit that profile or exported backups. The ignore rules exclude builds, installers, dependencies, environment files, credentials, known app-storage files, and common backup filenames; check new files before committing, especially backups saved under arbitrary names.

## Run while learning

```powershell
npm install
npm run dev
```

Use the Local address printed by Vite. Editing a component updates the page automatically. Development deliberately does not register the offline service worker.

## Build and try the actual installable app

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Open **http://localhost:4173** on this computer. Keep using this exact address: browser storage belongs to an origin (protocol, hostname, and port). `localhost:5173`, `localhost:4173`, and `127.0.0.1:4173` have separate data. Export from the old address and import at the new one to move tasks. Closing the terminal stops the preview server; this command is for testing the production build, not permanent hosting.

## Everyday use on Lau’s devices

1. Run `npm run build`. The build creates `dist/`, including the generated offline service worker.
2. Upload the **entire contents of `dist/`** to a static web host that serves HTTPS. Configure it at the domain root, not in a subfolder. This app's manifest and asset paths assume `/`.
3. Open its HTTPS address on Lau’s device while online. In Settings, wait for “Offline app files are ready on this device.”
4. In supported Chrome/Edge browsers, use **Install Lau** in Settings if offered, or the browser's install menu. On iPhone/iPad, open in Safari and choose **Share → Add to Home Screen**. Some browsers do not offer app installation.
5. Open Lau from the home screen or app launcher. After the first online preparation it can reopen offline, even when the host is temporarily unavailable.

HTTPS is necessary outside localhost. A plain HTTP address on your local Wi-Fi is not a reliable way to install a PWA on a phone. See [MDN’s installation guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

Updates download when you visit online. Close all Lau windows/tabs and reopen to let a waiting update activate. Offline caching keeps one complete version together, including its hashed CSS and JavaScript. It does not force a reload during a focus session.

## What you can do

- Add and edit tasks with optional due dates, priority, category, notes, and checkbox subtasks.
- Check off tasks or use the options menu to move between To do, Doing, and Done. List and Board share the same tasks.
- Drag a task by its grip to reorder. Drop onto a board column to move it; drop onto a card to insert before that card. The task options menu also provides move/reorder controls for keyboard and touch use.
- Search titles, notes, and subtasks. Open Filters for status, category, and priority.
- Delete a task and undo the latest deletion using the notification or the list footer. Undo remains available for the current tab session until another delete or an import.
- Explicitly mark tasks “Plan for today”. The daily ring uses all tasks planned for today's local calendar date, including completed ones. Plans from previous dates are retained on tasks, but don't count toward today.
- Pick a random unfinished task and start a focus session. A default 25-minute focus leads to a ready 5-minute break; neither automatically starts the next phase nor completes your task.
- Start, pause/resume, reset, or change timer mode. Timer modes/reset replace the current countdown. Changing durations in Settings applies to the next session or reset.
- Focus uses an end timestamp, so switching tabs or reopening the app keeps the remaining time accurate. If focus ends while the app is closed, it is recorded once at its scheduled completion time when the app next opens. Audio/notifications do not run after closing the app.
- Explore dated completion history and the focus journal. Reopening a task clears its current completion timestamp; completing it again records a new one. This is a current completion history, not a permanent log of every toggle.
- Set an accent, emoji categories, focus durations, optional sound, and messages from Rej. Messages save when you leave the message field. Subtle milestone effects respect reduced-motion preferences.
- Use “Done for today” to view a recap, then continue whenever you like. It doesn't change unfinished tasks.
- Use **N** for a new task, **Enter** to save from the title, and **Esc** to close dialogs. Shortcuts don't run while typing.

## Saving & backups

Tasks, settings, sessions, and the timer save to `localStorage` in this browser profile. There is no backend, account, or sync between devices. Clearing site data, changing the site address, or switching browser profiles can make tasks unavailable. Use **Settings → Export JSON** for a backup and **Import JSON** on the destination. Imports are validated and require confirmation before replacement; imported timers start idle so old sessions aren't replayed.

The old `lau-tasks-v1` list is read once when no new dashboard data exists, upgraded in memory, then saved under `lau-dashboard-v2`. The old key is left untouched. Previously completed tasks keep their completed state; because the old app didn't record dates, they appear under “Earlier tasks · date unknown”.

Invalid saved data does not get overwritten automatically. Settings lets you export the original raw storage, import a valid backup, or explicitly confirm a fresh start. If saving fails, export your current data before closing. Use one app tab/window when making edits: automatic conflict resolution between simultaneous tabs is not implemented.

## Where the React pieces live

- `src/App.jsx`: connects navigation, filters, menus, feedback, and the shared dashboard state.
- `src/components/`: smaller pieces for task editing/cards, focus, history, settings, and accessible native dialog windows.
- `src/data.js`: task migration, validation, date calculations, board moves, and timestamp-based timer calculations. These are plain functions so they can be checked without a browser.
- `src/hooks.js`: React state and browser saving. `useState` holds data; `useEffect` synchronizes it with browser storage.
- `src/index.css`: shared inputs, buttons, typography, and reduced-motion rules.
- `src/App.css`: desktop/window layout and responsive styles.
- `public/`: wallpaper, manifest, and app icons.
- `scripts/build-service-worker.mjs`: caches the exact files produced by each build. No additional runtime packages are needed.

React renders a new view when state changes. Arrays are replaced with `map`, `filter`, or a copied array, rather than mutating the existing state. The timer calculates time left from its saved end time, instead of assuming interval callbacks happen on schedule.

## Verification

```powershell
npm run lint
npm test
npm run build
node scripts/check-pwa.mjs
```

Automated checks cover legacy migration, invalid storage recovery, full backup round trips, malformed imports, board transitions, daily-plan counting, paused/running countdowns, one-time focus recording, break transitions, and local date/week calculations. The PWA check validates real icon sizes and the generated precache, and simulates offline navigation, asset requests, and scoped cache cleanup.

Browser automation is unavailable in the implementation environment. Before everyday use, manually check:

1. Add/edit a task and subtasks, plan it for today, complete/reopen it, and check the ring/history.
2. Drag between board columns; use the menu to reorder; delete and undo.
3. Search/filter and check an empty result. Try a narrow phone screen and keyboard-only navigation/dialogs.
4. Customize messages, categories, and colors; refresh to check persistence.
5. Export/import a backup; cancel replacement, confirm it, and try an invalid JSON file.
6. Set focus to one minute. Start/pause/resume, switch tabs until it ends, and refresh. Verify exactly one session and an idle break, with no automatic task completion.
7. Visit the production HTTPS app online until offline-ready, install it, close it, disconnect, and reopen. Verify the shell, tasks, and settings still work.

A build and simulated cache check cannot prove installation or layout on a particular browser; the device checks above complete that verification.

## Light and dark mode

Open Settings, then Appearance, and choose Light mode or Dark mode. The choice saves automatically with your other preferences and is included in backups. Older backups open in light mode. Dark mode also covers task dialogs, settings, history, and the focus timer.

## Windows desktop app with Mochi

The same React dashboard now runs in Electron, with an original pixel-art desktop dog named **Mochi**. The browser/PWA version still works through the original Vite commands.

### Run desktop development

```powershell
npm install
npm run desktop:dev
```

This builds React and launches Electron from bundled files. There is no development server to manage. After changing React or Electron code, quit using the tray menu and run the command again. For an existing build, `npm run desktop:start` launches it without rebuilding.

Click Mochi to open/focus the dashboard. Drag him to reposition; a movement of six logical pixels counts as a drag and doesn't open tasks. Right-click for **Open tasks**, **Pause/Resume walking**, **Hide dog**, and **Quit**. The system tray can open tasks or show the dog again, even while he is hidden. A second launch focuses the existing dashboard instead of creating another dog.

Mochi stays above normal windows and walks slowly inside the current monitor’s usable area. He rests between strolls, sleeps during a running focus session, and briefly hops happily when you complete a task. Walking stops while dragging, while a menu is open, during focus, and during happy feedback. Focus resumes its sleeping animation after happy feedback. Breaks don't put him to sleep.

Windows receives clicks only inside the animated pixel shapes, not the transparent area around them. The dog window is small: 72×60, 96×80, or 128×107 logical pixels, depending on the selected size. Movement uses Windows display-independent coordinates; work areas exclude the taskbar. Resolution, scaling, and monitor changes clamp both windows back onto an available display.

**Settings → Mochi, your desktop dog** contains visibility, walking pause, size, and **Launch when Windows starts**. Startup defaults to off and is enabled only after you explicitly opt in from the installed Windows app. It is disabled in development so you don't accidentally register Electron's development executable. Uninstall removes the startup entry.

Closing the dashboard hides its window and leaves the dog/tray running. The dashboard remains loaded so an active focus timer can continue; completing a focus session still does not mark its task complete. **Quit** fully exits, including the background timer. A running focus session can be recovered by its timestamp the next time you open the app.

### Build the Windows installer

On a Windows computer with Node.js/npm:

```powershell
npm install
npm run desktop:dist
```

The x64 installer is written to:

```text
release/Lau-Little-Space-Setup-1.0.0-x64.exe
```

Run that installer and follow its per-user installation wizard. Open **Lau’s Little Space** from the Start menu or desktop shortcut. The installed app needs neither VS Code, Node.js, nor a development server. All dashboard files and dog assets are bundled. You can send the installer to Lau; he only needs to run it on a supported x64 Windows system.

For future releases, increase `package.json`'s version and rerun the same build command. Install the new version over the previous one while the app is closed. Keep the app ID and storage directory unchanged. This project doesn't automatically download updates.

The generated installer is **unsigned** because no signing certificate is configured. Windows can show an unknown-publisher/SmartScreen prompt. A signed release requires a Windows code-signing certificate; a successful package build does not mean the installer is signed. Electron-builder's [NSIS documentation](https://www.electron.build/docs/nsis/) explains the installer configuration.

### Move your existing tasks into desktop

Browser/PWA storage and Electron storage are **separate**:

1. In your existing browser app, open Settings and **Export JSON**.
2. Open the desktop dashboard through Mochi or the tray.
3. Open Settings and **Import JSON**, review the replacement confirmation, then confirm.

Nothing moves automatically, and the original browser tasks are left untouched. You can export from desktop and import back into the browser too. Imports include task details, settings, completion dates, and focus sessions; imported timers start idle.

Desktop storage lives under **`%APPDATA%\LauLittleSpace`**, outside the installation directory. `browser/` contains Chromium's persistent dashboard data for the stable `lau://app/` origin. `desktop-preferences.json` stores dog settings and position. This location is shared by desktop development and the installed app, so use the isolated test command for test data. Installer updates and normal uninstallation preserve this directory. Back up through JSON before updating or clearing this directory.

### How the Electron pieces work

React still manages tasks, filters, focus, and saving. The desktop layer adds:

- `electron/main.cjs`: native windows, tray, single-instance lock, display changes, startup integration, local file serving, and desktop preference storage.
- `electron/core.cjs`: validated preferences, screen bounds, click/drag detection, animation state, and safe asset paths; these functions are tested without opening windows.
- `electron/dashboard-preload.cjs`: a small `window.lauDesktop` bridge for dog preferences, focus state, and completion feedback.
- `electron/dog-preload.cjs`: a separate bridge for gestures, menu requests, and dog animation state.
- `electron/pet/`: transparent canvas renderer and original idle/walk/sleep/happy pixel-art sprite strips. `scripts/create-desktop-dog.mjs` regenerates the committed assets and icons.
- `src/components/DesktopSettings.jsx`: controls rendered only when the desktop bridge exists.

All desktop renderers use **context isolation, sandboxing, and disabled Node integration**. React doesn't import Electron. The preload scripts expose specific methods rather than arbitrary IPC, file access, or command execution. Main verifies the sending window/frame/origin and validates values. External windows/navigation, webviews, and permission requests are blocked; bundled pages receive a Content Security Policy. Local assets are served only from the allowed app, pet, and bubble directories. See [Electron’s security guidance](https://www.electronjs.org/docs/latest/tutorial/security).

Electron uses its own bundled files and skips PWA service-worker registration. The ordinary web version retains its production service worker and install flow.

### Desktop verification and limits

**Publication checks (2026-10-11):** lint, all 27 logic tests, production build, and PWA validation passed. The current Windows integration check timed out at the real OS mouse click on the bubble's Open tasks button on two attempts in this environment. The earlier successful integration results below are historical; this native interaction needs verification on the target desktop. App behavior was not changed during repository preparation.

```powershell
npm run lint
npm test
npm run desktop:test
```

`desktop:test` rebuilds, starts real Electron windows with an **isolated temporary profile**, and exits automatically. It briefly opens the test dashboard. It never reads your personal task profile. Test profiles are retained under the Windows temporary directory for inspection.

Verified during implementation:

- All 27 data/desktop/reminder logic tests, lint, production build, and generated PWA checks.
- Actual bundled React loading with restricted renderer APIs and no Node access.
- Adding/completing a task through the React UI; sleep/happy transitions and return to sleeping during focus.
- Transparent dog pixels, native always-on-top/nonfocusable flags, hidden dog/tray survival, and dashboard close/reopen without destroying it.
- Boundary repair with a deliberately off-screen dog; tested negative monitor coordinates and size/scaling geometry.
- Duplicate instance exits; preferences and real dashboard data persist across two Electron processes.
- Ordinary web rendering without a preload, absence of desktop controls, task completion, actual service-worker installation, and offline dashboard reload in Chromium.
- Windows NSIS x64 installer generation.

**Not tested:** physical mouse clicks/drags on the desktop dog, clicking native tray/menu items, real monitor unplugging/scaling changes, keyboard focus alongside other programs, Windows startup registration/reboot, running the installation wizard/uninstaller, or installing an update over an older release. These need a manual check on Lau’s Windows desktop. The automated gesture and boundary checks cover their underlying logic, but don't substitute for those native OS interactions. This unsigned installer should also be checked on the target Windows version before sharing widely.

After building the installer, run `npm run desktop:test:packaged` to repeat the isolated runtime checks against the bundled executable in `release/win-unpacked`. This verifies the packaged app and its ASAR assets without running the installer or changing your real desktop data. Test mode requires an isolated profile and never registers Windows startup.


### Interactive Mochi reminders

Run the updated desktop app with `npm run desktop:dev` (quit any older running copy from its tray first). In Settings, open **Mochi's reminders**. Reminders default to 30 minutes, pause during a running focus session, and have sound off. Select a task in the Focus panel; Mochi asks about exactly that unfinished task. Done uses React's existing completion/save flow even with the dashboard closed. Still working waits another interval; Remind me later snoozes that task for 15 minutes. No selected unfinished task produces a general check-in with Open tasks. Focus completion produces a break message.

Set a daily local reminder time for date-only due tasks. Unfinished tasks due today or earlier appear together, once per task/date each day. Quiet hours support crossing midnight. Reminders stop when Mochi is hidden, and bubbles close after 15 seconds. The dog rests while a bubble is displayed so its buttons stay steady.

**One-minute test:** enable reminders, disable quiet hours, and save. If a focus timer is running, turn off Pause reminders and save (or pause the timer). Select an unfinished task, then press **Try one-minute reminders**. Close the dashboard and wait about one minute. Test Done, Still working, snooze, and the dismiss button. Test mode automatically ends after ten minutes, can be stopped in settings, and does not persist across restart. Snoozes always remain 15 minutes. With no selected unfinished task, test Open tasks.

Reminder scheduling lives in `electron/reminders.cjs` in the main process; settings, selection, snoozes, due notifications, and pending completion requests save to `%APPDATA%\LauLittleSpace\reminders.json`. The hidden React dashboard remains alive to apply commands through its existing task state. Commands retry and acknowledge only after saving. Sleeping/restarting skips overdue check-ins instead of replaying them. The separate isolated bubble renderer exposes only read, action, and size methods; transparent corners and margins are excluded from Windows hit regions. The web/PWA does not load these desktop APIs.

Build a fresh Windows installer with `npm run desktop:dist`; the previous installer does not contain source changes until rebuilt. Reminder tests run with `npm test`; `npm run desktop:test` also exercises real bubble dismissal and task completion while the dashboard is hidden. Windows Open tasks is now tested with a real OS mouse click: the test briefly moves the pointer and restores it. Windows bubbles allow mouse interaction and use showInactive so appearing reminders do not activate the window. Clicking a bubble is an intentional interaction; Open tasks focuses the dashboard. Other physical mouse/focus behavior, audible sound, real sleep/resume and monitor changes, and installer/update behavior require manual Windows verification.
