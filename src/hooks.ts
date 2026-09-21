import { getString, initLocale } from "./utils/locale";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { attachToReader, detachAll } from "./modules/popupObserver";
import { createZToolkit } from "./utils/ztoolkit";

let notifierID: string | undefined;

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  // Without this, the preferences.xhtml pane exists and loads fine on its
  // own (verified via chrome://.../preferences.xhtml directly), but Zotero
  // never surfaces a way to open it - no "Preferences" entry appears for
  // the plugin in Tools > Plugins at all.
  await Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: rootURI + "content/preferences.xhtml",
    label: addon.data.config.addonName,
  });

  registerReaderNotifier();
  attachToAlreadyOpenReaders();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  // Mark initialized as true to confirm plugin loading status
  // outside of the plugin (e.g. scaffold testing process)
  addon.data.initialized = true;
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
  if (type !== "tab" || (event !== "add" && event !== "select")) return;
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
    closeTime: 3000,
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
  detachAll();
  if (notifierID) {
    Zotero.Notifier.unregisterObserver(notifierID);
  }
  ztoolkit.unregisterAll();
  // Remove addon object
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
