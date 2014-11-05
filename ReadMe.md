Behold
======
######JS Views for when you want Views, but don't need Backbone's weight, Angular's opinions, or excessive dependencies.

Behold is for those who like the tidy encapsulation that frameworks like [Chaplin](https://github.com/chaplinjs/chaplin)
and [Marionette](http://marionettejs.com/) provide for js views, but you don't need everything that Backbone offers,
and can't justify the extra weight of it.

Contents
--------

[Why Views](#why-views)

[Why Behold](#why-behold)

[Dependencies](#dependencies)

[Usage](#usage)

[Modules](#modules)

[Views](#views)

###Why Views
What are js views? In a nutshell, the intent of a js view is to provide a neat encapsulation for all the ui binding,
event handling and functionality associated with a given page, or set of pages. Novice javascript often involves
terrible spaghetti code, spread throuhgout ```onevent``` handlers in the html, bunches of ```script``` tags littered
randomly through the markup, and an ugly mess of global variables and functions sitting in a single master file.

With Views enabled by a library like Behold, you instead have nicely encapsulated modules that don't leak private
variables or declare any new global variables (unless you really want to, or forget to prepend ```var``` to your
variable declaration, since no framework can save you from sloppy coding).

With Views, all of your ui binding is scoped to a root element, keeping selectors performant; all of your ui binding can
be declared in a single object, keeping the bindings easy to find and use throughout the code, reducing wasteful
rebinding across functions; all of your event binding can take advantage of existing ui binding, is also declared
in a single, easy to find object, and keeps its functions enclosed within the view, eliminating the chance of
overriding like named functions by declaring them globally, or conflicting with other libraries you've added.

In other words, Views are the answer to keeping your sites javascript tidy and maintainable, whether you have a
few pages that just need some animation added, a js-based browser plugin, or a complex webapp.

###Why Behold
If you need:
* routing,
* Collections,
* client-side models of db tables,
you should check out [Backbone](http://backbonejs.org/) and one of the many frameworks building on it,
like the two mentioned above.

If, on the other hand, you just need:
* Modular encapsulation that keeps global objects to a minimum, and keeps private variables really private;
* Easy, organized declaration of UI elements to bind to, with automatic binding and all the niceties that jQuery
has to offer immediately available;
* Similarly easy and organzied event binding, which are automatically bound upon view initialization, can be bound and
unbound as a unit, and are compatible with the jQuery style bindings your used to (including supporting event
namespacing);
* Clear organization and encapsulation of functions being bound to, or that operate on a given view;
* and similar helpful functionality (see below for more details)
then Behold is for you.

###Dependencies
[jQuery](https://jquery.com), or API-compatible replacement library, such as [Zepto](http://zeptojs.com/).
[Underscore](http://underscorejs.org/) - Optional - if not supplied, Behold includes a stripped down, native-reliant
re-implementation of some of underscore's functionality. See below for more details.

Usage
------

###Modules

###Views