export { registerPrefsScripts };

/**
 * This function is called when the prefs window is opened
 * See addon/content/preferences.xhtml onpaneload
 */
async function registerPrefsScripts(_window: Window) {
  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
    };
  } else {
    addon.data.prefs.window = _window;
  }
}
