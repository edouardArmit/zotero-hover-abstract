import { getString, initLocale } from "./utils/locale";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { clearAbstractCache } from "./modules/abstractCache";
import { attachToReader, detachAll, detachTabs } from "./modules/popupObserver";
import { observePref } from "./utils/prefs";
import { createZToolkit } from "./utils/ztoolkit";

// When this copy of the code was loaded - logged at startup, so a reload
// that failed to replace the running instance (see onShutdown) shows up
// as an old timestamp.
const CODE_LOADED_AT = new Date().toLocaleTimeString();

let notifierID: string | undefined;
let prefPaneID: string | undefined;
let prefObserverIDs: symbol[] = [];

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();
  ztoolkit.log(
    `[${addon.data.config.addonRef}] starting (code loaded at ${CODE_LOADED_AT})`,
  );

  // Without this, the preferences.xhtml pane exists and loads fine on its
  // own (verified via chrome://.../preferences.xhtml directly), but Zotero
  // never surfaces a way to open it - no "Preferences" entry appears for
  // the plugin in Tools > Plugins at all.
  await registerPrefPane();

  registerReaderNotifier();
  registerPrefObservers();
  attachToAlreadyOpenReaders();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  // Mark initialized as true to confirm plugin loading status
  // outside of the plugin (e.g. scaffold testing process)
  addon.data.initialized = true;
}

async function registerPrefPane(): Promise<void> {
  // Zotero is meant to drop a plugin's panes when it shuts down, but after
  // installing a new .xpi over an existing one the Settings sidebar was seen
  // showing this plugin's pane twice. Removing any pane still registered
  // under our ID first makes registration idempotent whatever the cause.
  for (const pane of Zotero.PreferencePanes.pluginPanes) {
    if (pane.pluginID === addon.data.config.addonID && pane.id) {
      Zotero.PreferencePanes.unregister(pane.id);
    }
  }
  prefPaneID = await Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: rootURI + "content/preferences.xhtml",
    label: addon.data.config.addonName,
  });
}

// Cached external results depend on these prefs - e.g. a "not found" cached
// while the API key was wrong must not outlive the user fixing the key.
function registerPrefObservers(): void {
  prefObserverIDs = (
    ["enableExternalLookups", "semanticScholarApiKey"] as const
  ).map((key) => observePref(key, clearAbstractCache));
}

function registerReaderNotifier(): void {
  notifierID = Zotero.Notifier.registerObserver(
    { notify: onNotify },
    ["tab"],
    addon.data.config.addonRef,
  );
}

function attachToAlreadyOpenReaders(): void {
  for (const reader of Zotero.Reader._readers) {
    attachOnceReady(reader);
  }
}

async function attachOnceReady(
  reader: _ZoteroTypes.ReaderInstance,
): Promise<void> {
  await reader._initPromise;
  attachToReader(reader);
}

async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  if (type !== "tab") return;
  if (event === "close") {
    // Zotero passes closed tab IDs nested: ids = [[id, ...]].
    detachTabs(ids.flat().map(String));
    return;
  }
  // "load" matters for tabs restored at startup: they're added as
  // "reader-unloaded" and only become "reader" when the PDF actually loads,
  // after this plugin's own startup - so neither "add" nor
  // attachToAlreadyOpenReaders() ever sees them as readers.
  if (event !== "add" && event !== "select" && event !== "load") return;
  const tabID = String(ids[0]);
  if (extraData?.[tabID]?.type !== "reader") return;

  const reader = Zotero.Reader.getByTabID(tabID);
  if (reader) {
    await attachOnceReady(reader);
  }
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();

  new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeOnClick: true,
    // Longer in development builds, where it confirms a (re)load happened.
    closeTime: addon.data.env === "development" ? 10000 : 3000,
  })
    .createLine({
      text: getString("startup-finish"),
      type: "success",
      progress: 100,
    })
    .show();
}

async function onMainWindowUnload(win: Window): Promise<void> {
  ztoolkit.unregisterAll();
}

function onShutdown(): void {
  // Every step is guarded so a failing one can't skip the rest - above all
  // the final `delete`. If the instance survived, the next startup (a plugin
  // update, disable/re-enable, or a dev hot reload) would find it still set,
  // skip creating a new one (see index.ts), and keep running this old code.
  const steps: Array<() => void> = [
    detachAll,
    () => notifierID && Zotero.Notifier.unregisterObserver(notifierID),
    () => prefObserverIDs.forEach((id) => Zotero.Prefs.unregisterObserver(id)),
    () => prefPaneID && Zotero.PreferencePanes.unregister(prefPaneID),
    () => ztoolkit.unregisterAll(),
  ];
  for (const step of steps) {
    try {
      step();
    } catch (e) {
      Zotero.logError(e as Error);
    }
  }
  notifierID = undefined;
  prefObserverIDs = [];
  prefPaneID = undefined;
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

/**
 * This function is just an example of dispatcher for Preference UI events.
 * Any operations should be placed in a function to keep this funcion clear.
 * @param type event type
 * @param data event data
 */
async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      registerPrefsScripts(data.window);
      break;
    default:
      return;
  }
}

// Add your hooks here. For element click, etc.
// Keep in mind hooks only do dispatch. Don't add code that does real jobs in hooks.
// Otherwise the code would be hard to read and maintain.

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onPrefsEvent,
};
