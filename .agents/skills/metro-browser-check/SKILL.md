---
name: metro-browser-check
description: Reproduce and validate City and Metro gameplay or display changes in a separate visible Chrome test tab using a configurable exported save. Limit browser preparation and verification to two minutes, then preserve the scene and hand off manual checks if incomplete.
---

# Metro browser check

Apply to this repository's browser debugging and post-change acceptance. Follow repository scope and instructions. Documentation-only tasks need no browser acceptance.

## Defaults and task overrides

Read [test-settings.json](test-settings.json). Resolve paths relative to the repository root. The user may override the save, URL, scenario or time budget in ordinary language for one task without changing defaults.

- Browser: prefer **Chrome for Testing** at the configured executable path; if unavailable, ordinary Google Chrome in a dedicated isolated test profile is authorized. Always use a visible independent test tab; no headless mode. A separate tab alone does not isolate saves. Report the actual browser used; do not touch the everyday player profile.
- Preview: `http://localhost:8001/`, serving the current repository root.
- Test files and scenario notes: `savedgames/test/`. The default is the copied Shanghai July 2000 export. Read `savedgames/test/README.md` for current fixture limitations.
- Browser budget: 120 seconds total; leave the scene open afterward.

## Prepare implementation checks

Read STATUS then DEVELOPMENT and inspect existing Git changes before editing or resuming work. Preserve other work. Run repository-required baseline/build checks and focused checks appropriate to the change; reuse checks already completed on unchanged files in this task. Keep computed geometry/script results distinct from browser and visual confirmation.

## Browser workflow

Start a wall-clock deadline before the first preview/browser preparation action, after implementation/build checks. Include discovery, connection, server setup, refresh, import and verification in the single 120-second budget. Bound tool waits by the remaining budget; do not restart the timer after failure or repeatedly repair missing browser dependencies. Finish earlier if blocked.

1. Verify port 8001 serves the current checkout, comparing a current source resource if practical. Reuse a correct existing service; otherwise start `python3 -m http.server 8001 --bind 127.0.0.1` from the repository root. Honor an explicit URL/port override. Do not kill an unrelated service or silently select another port.
2. Discover supported browser tools and open/reuse the dedicated test tab/profile. Check the configured Chrome for Testing executable before declaring it missing: this Mac installs it under ~/Applications, not /Applications. Installation and tool controllability are separate checks. Prefer the configured browser; if it cannot be used, ordinary Google Chrome in an isolated test profile is authorized. Report any fallback. If neither browser can be controlled within the budget, hand off without installing dependencies or repeatedly repairing tools. Use a visible browser that remains alive; avoid runners that automatically close the browser after checks.
3. Navigate/refresh the test URL to load current resources without clearing player storage. Keep the same hostname: localhost and 127.0.0.1 have separate storage origins.
4. Import the specified export read-only from disk through the game's import UI into the isolated test profile. If another supported loading mechanism is needed, inspect its actual API first rather than inventing one. Disable test-profile autosave before import/load where possible and pause after loading. Do not touch the normal player profile or overwrite the source export. If isolation cannot be established, hand off before import.
5. Verify the actual map/date and network or facility relevant to the task. If the default fixture cannot reproduce the issue, report that limitation; do not silently replace it with another save, synthesize a different scenario or claim acceptance. Explicit task overrides may select a suitable export.
6. Open the relevant panel/view and perform the smallest meaningful reproduction. Track/diagram changes may require both geographic and schematic views; dated facilities may require checks around the relevant date. Use only checks relevant to the task, not an unrelated sweep. A home page loading successfully is not sufficient acceptance.
7. Inspect new runtime/console errors and resource failures if supported. Keep the final scene open, paused where appropriate; capture a screenshot within the budget if useful. Leave the browser, test tab and preview running for user review.

## Completion and manual handoff

At the deadline stop automatic browser actions and retries. An in-flight call should already be bounded by the remaining time. Preserve any partial scene and clearly identify what is loaded. Do not claim a visual pass from script checks alone.

Report the test URL/browser, selected export, observed map/date, actual checks/results and remaining uncertainty. If incomplete, explicitly hand off to the user with concrete steps: which panel to open, which action to perform and the expected result. If no tab could be created, provide the URL and export to open manually. Do not retry browser setup after handing off unless the user requests it or supplies the missing dependency.

Update STATUS/DEVELOPMENT with actual results and pending manual checks as required by repository instructions. Preserve existing fixture files; add or replace test exports only when requested.

## Maintenance

Edit `test-settings.json` for lasting save/URL/budget changes and this file for workflow changes. Use task overrides for temporary choices. Validate edited skills with skill-creator's `quick_validate.py` and confirm referenced paths. Do not modify player saves while maintaining the skill.
