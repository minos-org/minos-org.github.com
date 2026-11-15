/* The themes this page can wear: the one manifest. The head's bootstrap reads it before the first paint (to write the
   chosen theme's stylesheets), core/fx.js reads it to load the theme's fragments and effects, and core/core.js builds
   the theme switcher from it. A theme is a folder themes/<slug>/ with:
     theme.css     its whole look, for the core page with and without JavaScript
     fragments.js  its decorative HTML, MinosFX.fragments('<slug>', { name: '<html>' })
     effects.js    its behaviour, MinosFX.register('<slug>', { mount: function (api) { … } })
   name is what the switcher shows; fonts is one Google Fonts stylesheet, or null. */
window.minosThemes = {
  default: 'mesas',
  list: [
    {
      slug: 'mesas',
      name: 'workspaces',
      css: 'themes/mesas/theme.css',
      fonts: 'https://fonts.googleapis.com/css2?family=Inconsolata:wght@400;700&display=swap',
      fragments: 'themes/mesas/fragments.js',
      effects: 'themes/mesas/effects.js'
    },
    {
      slug: 'respuesta',
      name: 'answers',
      css: 'themes/respuesta/theme.css',
      fonts: 'https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500;700&family=Ubuntu+Mono:wght@400;700&display=swap',
      fragments: 'themes/respuesta/fragments.js',
      effects: 'themes/respuesta/effects.js'
    }
  ]
};
