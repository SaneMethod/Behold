/**
 * Copyright Christopher Keefer, 2014.
 * @author Christopher Keefer [SaneMethod]
 * @version 0.1.4
 *
 * Recreate js Views in a minimal manner portable to projects that aren't using
 * libraries with the concept built-in.
 * @param {object} root Where to attach the Behold object.
 * @param {object} $ jQuery lib, or api-compatible replacement (such as Zepto).
 * @param {object} _ underscore/lodash lib.
 */
(function(root, $, _){

    /**
     * Our container function for the various elements of Behold, and static functions such as extend.
     * @constructor
     */
    function Behold(){}

    /**
     * Recreate javascript inheritance (working similarly to backbone extend) to allow our views to be
     * extendable/inheritable.
     */
    Behold.extend = function(onProto, onStatic){
        onProto = onProto || {};
        onStatic = onStatic || {};
        var parent = this,
            child,
            proxy;

        /* For legacy support reasons, if the context (this) is Behold, then we instead recall extend
         * with the context set to Behold.View, allowing applications to continue using Behold.extend when
         * they want to extend Behold Views. */
        if (this === Behold) return Behold.extend.apply(Behold.View, arguments);

        child = (onProto && onProto.hasOwnProperty('constructor')) ?
            onProto.constructor : function(){ return parent.apply(this, arguments); };

        _.extend(child, parent, onStatic);

        proxy = function(){ this.constructor = child; };
        proxy.prototype = parent.prototype;
        child.prototype = new proxy;

        _.extend(child.prototype, onProto);
        child.__super__ = parent.prototype;
        return child;
    };

    /**
     * Our view function.
     * @param {object=} options Options to be passed to the view. Those with certain names will be set directly
     * on the object for easy access - the others will live in this.options in the view.
     * @constructor
     */
    Behold.View = function(options){
        this.cid = _.uniqueId('view');
        this.options = options || {};
        this.$ = $;
        this._ = _;

        this._setOptions();
        this._setEl();
        this.bindUI();
        this.attachEvents();
        this.initialize.apply(this, arguments);
    };

    /**
     * Set options on this object from the options object passed to the constructor based on the key names
     * in viewProps.
     * @private
     */
    Behold.View.prototype._setOptions = function(){
        var options = this.options,
            viewProps = ['el', 'id', 'tagName', 'className', 'ui', 'events', 'template', 'region'],
            keys;

        if (options)
        {
            keys = Object.keys(options);
            keys.forEach(function(key){
                if (viewProps.indexOf(key) !== -1) this[key] = options[key];
            }, this);
        }
    };

    /**
     * If this.el is defined, run it through jQuery and set it as a reference to the element for this view.
     * Otherwise, create a new element based on the id, attributes, tagName and className properties, and
     * attach it to the specified container.
     * @private
     */
    Behold.View.prototype._setEl = function(){
        var attrs = {},
            tagName = this.tagName,
            $el;

        if (this.el)
        {
            this.$el = $(this.el);
            return;
        }
        attrs = _.extend(attrs, this.options.attributes);
        attrs['class'] = this.className || void 0;
        attrs.id = this.id || void 0;
        $el = $('<'+tagName+'></'+tagName+'>').attr(attrs);
        this.$el = $el;
        this.el = $el[0];
        this.region = $(this.region);
        this.attachElContent();
    };

    /**
     * Called if we're generating a new DOM structure rather than attaching to an existing structure.
     * Override this to change the way we attach our generated DOM - by default, we render the template
     * (if any) and make that the content of this element, and then attach this.el to the specified region.
     */
    Behold.View.prototype.attachElContent = function(){
        var content = this.render();
        this.$el.append(content);
        this.region.empty().append(this.$el);
    };

    /**
     * Renders the content for this view when we're not attaching to an existing DOM.
     * By default, we rely on a template being defined for the view, and use
     * underscores template function to render it, passing this.options in. If
     * no template is defined, we return an empty string.
     */
    Behold.View.prototype.render = function(){
        var template = (this.template) ?
            (typeof this.template === 'function') ? this.template :
                _.template($(this.template).html()) : void 0;

        if (template){
            return template(this.options);
        }

        return '';
    };

    /**
     * Get the full selector for a given key in the ui.
     * @param {object} ui The ui object to look in.
     * @param {string} key The key to search for in the object.
     * @return {string} Returns the full selector string to be used to select the element in question.
     */
    Behold.View.prototype.getUISelector = function(ui, key){
        var el;

        el = ui[key];
        // If we're using our @ui sugar, keep looping through until we've got the full element string
        while (el.indexOf('@ui.') === 0)
        {
            el = el.split(' ');
            el = ui[el[0].substr(4)]+' '+el.slice(1).join(' ');
        }

        return el;
    };

    /**
     * Bind this.ui (if set) as a lazy-mapping to the jQuery element references, to replace the css locator string that
     * previously occupied it. Cache retrieved jQuery element references to return after the first time the ui key has
     * been referenced. Save the original css strings in case we need to unbind or rebind in _uiBindings.
     * @returns {Behold.View}
     */
    Behold.View.prototype.bindUI = function(){
        var ui = _.extend({}, this._uiBindings || this.ui),
            uiCache = (this._uiCache = {}),
            $el = this.$el,
            keys;

        if (!ui || Object.getOwnPropertyNames(ui).length === 0) return this;
        if (!this._uiBindings) this._uiBindings = _.extend({}, ui);

        this.ui = {};

        keys = Object.keys(ui);
        keys.forEach(function(key){
            var el = this.getUISelector(ui, key);

            Object.defineProperty(this.ui, key, {
                get:function(){
                    if (uiCache[key]){
                        return uiCache[key];
                    }
                    return (uiCache[key] = $el.find(el));
                }
            });
        }, this);
        return this;
    };

    /**
     * Unbind all ui element references by deleting the entries and restoring this.ui to the contents of _uiBindings.
     * @return {Behold.View}
     */
    Behold.View.prototype.unBindUI = function(){
        var ui = this.ui,
            keys;

        if (!ui || !this._uiBindings) return this;

        keys = Object.keys(ui);
        keys.forEach(function(key){
            delete this.ui[key];
        }, this);

        this.ui = _.extend({}, this._uiBindings);
        delete this._uiBindings;
        return this;
    };

    /**
     * Assign events based on this.events(if set) to map either this.ui element references (prefaced by
     * "@ui."), or else a bare css locator string. Namespace all events with '.dgbehold' plus the cid of this view.
     * Delegate events to the root element for efficiency. If the event key is prefaced with the 'capture'
     * indicator, the > symbol, bind to the specified element using event capturing, allowing us to 'delegate' to
     * the root element for events that don't bubble.
     * @returns {Behold.View}
     */
    Behold.View.prototype.attachEvents = function(){
        var that = this,
            ui = this._uiBindings || this.ui,
            events = this.events,
            cid = this.cid,
            $el = this.$el,
            captures = this._capturingListeners = this._capturingListeners || {},
            keys;

        if (events)
        {
            keys = Object.keys(events);
            keys.forEach(function(key){
                var func = events[key],
                    sKey = key.split(' '),
                    el,
                    event;

                func = (typeof func === 'function') ? func : that[func];

                el = (sKey[1].indexOf('@ui.') === 0) ? that.getUISelector(ui, sKey[1].substr(4)) : sKey[1];
                event = sKey[0]+'.dgbehold'+cid;

                if (event[0] === '>'){
                    event = sKey[0].substr(1);
                    captures[key] = func.bind(that);
                    $el[0].addEventListener(event, captures[key], true);
                    return;
                }

                $el.on(event, el, func.bind(that));
            });
        }
        return this;
    };

    /**
     * Detach events attached by calling attachEvents.
     * @returns {Behold.View}
     */
    Behold.View.prototype.detachEvents = function(){
        var that = this,
            $el = this.$el,
            events = this.events,
            cid = this.cid,
            keys = Object.keys(events);

        if (keys.length)
        {
            // Remove all delegated events
            $el.off('.dgbehold'+cid);

            // Remove all capturing events
            keys.filter(function(key){
                return key[0] === '>';
            }).forEach(function(key){
                var func = that._capturingListeners[key],
                    event;

                event = key.split(' ')[0].substr(1);
                $el[0].removeEventListener(event, func, true);
            });
            this._capturingListeners = {};
        }
        return this;
    };

    /**
     * Remove the referenced element from the DOM.
     * @return {Behold.View}
     */
    Behold.View.prototype.remove = function(){
        this.detachEvents();
        this.$el.remove();
        return this;
    };

    /**
     * Set a new element as the referenced element for this view.
     * @param {string|HTMLElement|jQuery} element The element to set as the root of this view.
     * @param {boolean=} skipEvents Whether to skip binding events.
     * @param {boolean=} skipUnbinding Whether to skip unbinding events before binding new events.
     * @return {Behold.View}
     */
    Behold.View.prototype.setElement = function(element, skipEvents, skipUnbinding){
        if (this.$el && !skipUnbinding)
        {
            this.detachEvents();
            this.unBindUI();
        }

        this.$el = (element instanceof $) ? element : $(element);
        this.el = this.$el[0];

        if (!skipEvents)
        {
            this.bindUI();
            this.attachEvents();
        }

        return this;
    };

    /**
     * An empty function by default, to be overridden by extending classes.
     * @abstract
     */
    Behold.View.prototype.initialize = function(){};

    /**
     * Make Behold.View extensible.
     * @type {function(this:(Behold.View|*))}
     */
    Behold.View.extend = Behold.extend.bind(Behold.View);


    /**
     * Create a router to attach to a module that has a `routes` object defined on it.
     * By default we use the module itself as the controller, but the module can also
     * define a `controller` object that can contain the handler functions.
     * @returns {Behold.Router}
     * @constructor
     */
    Behold.Router = function(routes, module){
        this.controller = module.controller || module;
        this.routes = routes;
        this.handlers = this._parseRoutes();

        window.addEventListener('popstate', function(event){
            this._onChange(window.location.pathname, event.state || {});
        }.bind(this));
    };

    // Cached Regexes for Routing
    Behold.Router.optionalParam = /\((.*?)\)/g;
    Behold.Router.namedParam    = /(\(\?)?:\w+/g;
    Behold.Router.splatParam    = /\*\w+/g;
    Behold.Router.escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

    /**
     * Convert a route string to regular expression.
     * @param {string} route
     * @returns {RegExp}
     * @private
     */
    Behold.Router._routeToRegExp = function(route) {
        var self = Behold.Router;

        route = route.replace(self.escapeRegExp, '\\$&')
            .replace(self.optionalParam, '(?:$1)?')
            .replace(self.namedParam, function (match, optional) {
                return optional ? match : '([^/?]+)';
            })
            .replace(self.splatParam, '([^?]*?)');

        return new RegExp('^' + route + '(?:\\?([\\s\\S]*))?$');
    };

    /**
     * Navigate to the specified url, optionally passing the data object to the popstate event
     * both on navigation, and if we were to press the 'back' button to navigate away.
     * @param {string} url
     * @param {object=} data
     * @returns {Behold.Router}
     */
    Behold.Router.navigate = function(url, data){
        var event = new Event('popstate');

        data = data || {};

        window.history.pushState(data, document.title, url);

        event.state = data;
        window.dispatchEvent(event);

        return this;
    };

    /**
     * Get the parameters by using the route regex on the url fragement.
     * @param {RegExp}route
     * @param {string} fragment
     * @returns {*|Array}
     * @private
     */
    Behold.Router._extractParameters = function(route, fragment) {
        var params = route.exec(fragment).slice(1);

        return _.map(params, function (param, i) {
            // Don't decode the search parameters.
            if (i === params.length - 1) return param || null;
            // Otherwise, decode each component.
            return param ? decodeURIComponent(param) : null;
        });
    };

    /**
     * Parse the routes object to create a hash of route regexes and
     * their appropriate callbacks.
     * @private
     */
    Behold.Router.prototype._parseRoutes = function(){
        var route_keys = Object.keys(this.routes),
            handlers = [],
            callback;

        for (var i=0, len = route_keys.length; i < len; i++){
            callback = this.routes[route_keys[i]];
            callback = (typeof callback === 'string') ? this.controller[callback] : callback;

            handlers.push({
                route: Behold.Router._routeToRegExp(route_keys[i]),
                callback: callback.bind(this.controller)
            });
        }

        return handlers;
    };

    /**
     * When the location has changed, determine if the location matches any
     * of the route regexes, extract any parameters specified from the location,
     * and call the location handler.
     * @param {string} url
     * @param {object=} state
     * @private
     */
    Behold.Router.prototype._onChange = function(url, state){
        var args;

        return _.some(this.handlers, function(handler){
            if (handler.route.test(url)){
                args = Behold.Router._extractParameters(handler.route, url);
                handler.callback.apply(null, args.concat([url, state]));

                return true;
            }
        });
    };

    Behold.Router.extend = Behold.extend.bind(Behold.Router);


    /**
     * Application container for behold views.
     * @constructor
     */
    Behold.Application = function(){
        this.modules = {};
    };

    /**
     * Call the initialize function on all registered modules when start is called.
     */
    Behold.Application.prototype.start = function(){
        var modules = this.modules,
            setupRoutes = [],
            callInit = [],
            module;

        // Iterate through all routes and router setup, before iterating through again to
        // call init, so that routers are ready to handle possible navigation called from
        // initialize functions.
        for (var name in modules)
        {
            if (modules.hasOwnProperty(name)){
                module = modules[name];

                if (module.routes)
                {
                    setupRoutes.push(module);
                }

                if (module.initialize && typeof module.initialize === 'function')
                {
                    callInit.push(module);
                }
            }
        }

        setupRoutes.forEach(function(module){
            module._router = new Behold.Router(module.routes, module);
        });

        callInit.forEach(function(module){
            module.initialize();
        });
    };

    /**
     * Register a module, instantiating it and passing it the arguments specified.
     * Alternatively, if the initializer isn't provided, expect that we want a reference to the module
     * passed back to us. Will always return an object. Module declaration can be split amongst
     * multiple files.
     * @param {string} name
     * @param {function=} initializer
     * @param {...} arguments to be passed to the initializer
     * @returns {object}
     */
    Behold.Application.prototype.module = function(name, initializer){
        var module = this.modules[name] = this.modules[name] || {},
            args = [module, this, $, _].concat(Array.prototype.slice.call(arguments, 2));

        if (!initializer) return this.modules[name];

        initializer.apply(module, args);
        return this.modules[name];
    };

    root.Behold = Behold;
})(window, jQuery, _);
