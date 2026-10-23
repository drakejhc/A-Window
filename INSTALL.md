# Installing A Window

Download the installer for your computer from the **Releases** page of this project on GitHub
(the newest release is at the top, under *Assets*).

| Your computer | Download |
| --- | --- |
| Mac with Apple silicon (M1, M2, M3, M4…) | `A-Window-<version>-mac-arm64.dmg` |
| Mac with an Intel processor | `A-Window-<version>-mac-x64.dmg` |
| Windows 10 or 11 | `A-Window-<version>-win-x64.exe` |
| Linux | `A-Window-<version>-linux-x86_64.AppImage` |

Not sure which Mac you have? Apple menu → **About This Mac**. "Chip: Apple M…" means Apple silicon.

## Mac

1. Open the `.dmg` and drag **A Window** into **Applications**.
2. The first time, **right-click** (or Control-click) A Window in Applications and choose **Open**, then **Open** again.
   macOS asks this once because the app isn't from the App Store or a registered Apple developer.
   - If it says the app "can't be opened", go to **System Settings → Privacy & Security**, scroll down, and click **Open Anyway**.
   - If it says the app "is damaged", open Terminal and run `xattr -cr "/Applications/A Window.app"`, then open it again.
3. To see what's playing in Spotify or Apple Music, allow A Window when macOS asks to let it control the music app.

## Windows

1. Run the `.exe` installer.
2. If Windows shows "Windows protected your PC", click **More info → Run anyway**.
   Windows shows this for apps without a paid code-signing certificate.
3. A Window starts in the system tray (bottom-right, near the clock) as well as in its own window.

## Linux

1. Make the AppImage executable: `chmod +x A-Window-*.AppImage`
2. Run it. On some systems you may need `libfuse2` (`sudo apt install libfuse2`).

## What the desktop app adds

- **Live wallpaper.** Settings → Live wallpaper shows the window behind your desktop icons, even with the app closed
  (it lives in the menu bar or tray). On Windows this is experimental: if it can't attach to the desktop, it turns
  itself off and says so.
- **Open at login.** Starts quietly in the menu bar or tray, with the wallpaper if it's on.
- **What's playing.** When Spotify (Mac and Windows) or Apple Music (Mac) plays, a record player appears on the sill
  with the album art spinning on it, the lamp takes on the album's colour, a small player shows in the corner, and the
  window's own ambience turns down so it doesn't compete with your music.
- **Reminders** five minutes before each block, if you turn them on.
- **Use with Claude.** Let your own Claude (Claude Code or the Claude desktop app) see and change your plan. Turn on
  Settings → *Use with Claude*, then copy the line it shows:
  - **Claude Code:** paste the `claude mcp add …` line into a terminal and press Enter.
  - **Claude desktop app:** Settings → Developer → Edit Config, paste the snippet into `claude_desktop_config.json`
    (merge it into `mcpServers` if you already have one), save, and restart Claude.

  Then ask Claude something like "What's on today?" or "Add a 30 minute walk at 5pm". A Window has to be open (it can
  be hidden in the tray). Every change Claude makes shows in the app with Undo. If you move or reinstall the app, copy
  the line again.

## Your data

Everything you plan stays on your computer. The app only goes online to fetch the weather and to search for cities
(Open-Meteo, which receives a city name or its coordinates), and to look up album art. Settings → *Export a backup*
saves everything to one file you can import on another computer.

## Uninstalling

- **Mac:** drag A Window from Applications to the Trash. Your data is in `~/Library/Application Support/A Window`.
- **Windows:** Settings → Apps → A Window → Uninstall.
- **Linux:** delete the AppImage. Your data is in `~/.config/A Window`.
