// Runs before the page draws, so saved display settings apply without a flash.
// Loaded with a normal <script> tag in <head> (not a module).
(function () {
  var s = {}
  try { s = JSON.parse(localStorage.getItem('chaiyo-display') || '{}') } catch (e) { s = {} }
  var html = document.documentElement
  html.dataset.text = s.text || 'standard'
  if (s.theme === 'dark' || s.theme === 'light') html.dataset.theme = s.theme
  if (s.contrast) html.dataset.contrast = 'high'
  if (s.motion === 'reduce' || s.motion === 'full') html.dataset.motion = s.motion
})()
