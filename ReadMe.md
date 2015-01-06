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

[Usage Example](#usage-example)

[More Details](#more-details)

Why Views
-----------
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

In other words, Views can be the answer to keeping your site's javascript tidy and maintainable, whether you have a
few pages that just need some animation added, a js-based browser plugin, or a complex webapp.

Why Behold
----------
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

Dependencies
------------
[jQuery](https://jquery.com), or API-compatible replacement library, such as [Zepto](http://zeptojs.com/).

[Underscore](http://underscorejs.org/) - Optional - if not supplied, Behold includes a stripped down, native-reliant
re-implementation of some of underscore's functionality. See below for more details.

Usage Example
-------------

In your javascript entry point of execution:
```javascript
var gApp = new Behold.Application();

$(document).ready(function(){
    gApp.start(); // Initializes all registered modules
});
```

Then, in any other javascript file included in the page (you can include it before or after your entry point, so long
as it will be loaded before whatever criteria you've selected for executing ```start()``` on your application object):
```javascript
/**
 * Module constructor functions are passed four arguments by default.
 * self = A reference to the module.
 * app = A reference to the application object that the module has been registered on.
 * $ = A reference to the jQuery library.
 * _ = A reference to the underscore library, or our fill in if underscore is not present and passed in.
 * Additional parameters can be fed into the constructor function by adding them, comma seperated, after the
 * constructor function (see below).
 */
gApp.module('moduleName', function(self, app, $, _){
    // Variables declared with var are private to this closure.
    // Convention is to preface the variable name with an underscore to visually indicate this.
    var _Header = Behold.extend({ // _Header is now a constructor for a new Behold View.
            el:'#header', // Root element
            ui:{ // ui bindings
                // the key 'fbLogin' will automatically be bound to the element with the id #fbHeaderLogin, found
                // somewhere beneath the root element #header
                // Any valid jQuery selector can be used
                fbLogin:'#fbHeaderLogin',
                gpLogin:'#gpHeaderLogin'
            },
            events:{ // event bindings
                // A click event will automatically be bound to the element with the key 'fbLogin' within the ui
                // object, as seen above. When this event fires, the 'onClick' handler within this view will be triggered.
                'click @ui.fbLogin':'onClick'
            },
            /**
             * The initialize function will be called when this view is instantatied, and is the perfect place to put
             * code that should be run at that time, like bindings that can't live in the events object for whatever
             * reason, or function calls to make first-run changes.
             */
            initialize:function(){},
            /**
             * This is the event handler that we bound to in the events object, above. Notice it takes one parameter,
             * event, which is the jQuery Event, as per usual handler behaviour.
             */
            onClick:function(event){}
        }),
        _header; // We declare another local variable for the instantiated view.

    /**
     * Initialize this module. This function will be called automatically by Behold.Application.start().
     * In this example, if we detect that the header element is present, we instantiate the Header view.
     */
    self.initialize = function(){
        if ($('#header').length){
            _header = new _Header({} /* We can pass in options in this object, that will be available via this.options in the view */);
        }
    };
    // Here we could add a comma separated series of variables to pass into the module constructor function, after the
    // functions closing curly bracket, should we wish to.
});
```

More Details
------------
View, download and/or Fork the code [on GitHub](https://github.com/SaneMethod/Behold).

For a detailed view into the internals of Behold,
[head to the doxx pages](http://sanemethod.github.io/Behold/Behold.js.html).