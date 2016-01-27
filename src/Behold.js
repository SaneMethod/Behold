/**
 * Copyright Christopher Keefer, 2014.
 * @author Christopher Keefer [SaneMethod]
 * @version 0.1.1
 *
 * Recreate js Views in a manner portable to projects that aren't using libraries with the concept built-in.
 * @param {object} root Where to attach the Behold object.
 * @param {object} $ jQuery lib, or api-compatible replacement (such as Zepto).
 * @param {object=} _ underscore lib.
 */
(function(root, $, _){
    /**
     * If the underscore library isn't passed to us, we'll patch in our own native-reliant functions for the
     * underscore functionality we want/need.
     */
    _ = _ || (function(){
        var idCounter = 0,
            noMatch = /(.)^/,
            escapes = {
                "'":"&#39;",
                '&':'&amp;',
                '<':'&lt;',
                '>':'&gt;',
                '"':'&quot;',
                '\\':'\\',
                '/':'&#x2F',
                '\r':'r',
                '\n':'<br />',
                '\u2028':'u2028',
                '\u2029':'u2029'
            },
            escaper = new RegExp(Object.keys(escapes).join('|')+'/g'),
            escapeChar = function(match) {
                return '\\' + escapes[match];
            },
            _fill = {
                /**
                 * Test to see whether the passed object should indeed be considered an object,
                 * particularly for the purposes of extend.
                 * @param {*} obj The parameter to test for 'objectness'.
                 * @return {boolean}
                 */
                isObject: function (obj) {
                    var types = ['function', 'object'];

                    return (types.indexOf(typeof obj) !== -1 && !!obj);
                },
                /**
                 * Copy all properties on an unspecified number of source objects into the destination object,
                 * with properties appearing on later source objects overriding identically named properties in
                 * the destination or earlier source objects.
                 * @param {object} obj Destination object.
                 * @return {object}
                 */
                extend: function (obj) {
                    var src,
                        keys;

                    if (!this.isObject(obj)) return obj;
                    for (var i = 1, len = arguments.length; i < len; i++) {
                        src = arguments[i];
                        if (!this.isObject(src)) continue;
                        keys = Object.keys(src);
                        keys.forEach(function (prop) {
                            obj[prop] = src[prop];
                        });
                    }
                    return obj;
                },
                /**
                 * Return a uniqueId using an internal counter and, if passed, a prefix string.
                 * @param {string|number=} prefix
                 * @return {string}
                 */
                uniqueId: function (prefix) {
                    return (prefix) ? prefix + (++idCounter+'') : (++idCounter+'');
                },
                /**
                 * Escape html special characters in a string.
                 * @param str String to replace characters in.
                 */
                escape:function(str){
                    return str.replace(escaper, function(match){
                        return escapes[match];
                    });
                },
                /**
                 * Based on the same defaults as standard underscore.
                 */
                templateSettings:{
                    interpolate : /<%=([\s\S]+?)%>/g,
                    escape      : /<%-([\s\S]+?)%>/g
                },
                /**
                 * Not a full-featured replacement for underscore templates - this only allows us to escape
                 * or interpolate named values into the template string - no evaluation.
                 *
                 * @param {string} text The text to use as the template.
                 * @param {object=} settings Options to override the standard templateSettings.
                 */
                template:function(text, settings){
                    settings = this.extend({}, this.templateSettings, settings);
                    var matcher = RegExp([
                        (settings.escape || noMatch).source,
                        (settings.interpolate || noMatch).source
                    ].join('|'), 'g'),
                        replacer = function(data, match, escape, interpolate, offset){
                            if (escape) return _fill.escape(escape.trim());
                            if (interpolate) return data[interpolate.trim()];
                        },
                        template;

                    template = function(data){
                        text = text.replace(matcher, replacer.bind(this, data));
                        return text;
                    };

                    return template;
                }
            };

        return _fill;
    })();

    /**
     * Our view function.
     * @param {object=} options Options to be passed to the view. Those with certain names will be set directly
     * on the object for easy access - the others will live in this.options in the view.
     * @constructor
     */
    function Behold(options){
        this.cid = _.uniqueId('view');
        this.options = options || {};
        this.$ = $;
        this._ = _;

        this._setOptions();
        this._setEl();
        this.bindUI();
        this.attachEvents();
        this.initialize.apply(this, arguments);
    }

    /**
     * Set options on this object from the options object passed to the constructor based on the key names
     * in viewProps.
     * @private
     */
    Behold.prototype._setOptions = function(){
        var options = this.options,
            viewProps = ['el', 'id', 'tagName', 'className', 'ui', 'events'],
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
     * Otherwise, create a new element based on the id, attributes, tagName and className properties.
     * @private
     */
    Behold.prototype._setEl = function(){
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
    };

    /**
     * Get the full selector for a given key in the ui.
     * @param {object} ui The ui object to look in.
     * @param {string} key The key to search for in the object.
     * @return {string} Returns the full selector string to be used to select the element in question.
     */
    Behold.prototype.getUISelector = function(ui, key){
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
     * @returns {Behold}
     */
    Behold.prototype.bindUI = function(){
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
     * @return {Behold}
     */
    Behold.prototype.unBindUI = function(){
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
     * @returns {Behold}
     */
    Behold.prototype.attachEvents = function(){
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
     * @returns {Behold}
     */
    Behold.prototype.detachEvents = function(){
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
     * @return {Behold}
     */
    Behold.prototype.remove = function(){
        this.detachEvents();
        this.$el.remove();
        return this;
    };

    /**
     * Set a new element as the referenced element for this view.
     * @param {string|HTMLElement|jQuery} element The element to set as the root of this view.
     * @param {boolean=} skipEvents Whether to skip binding events.
     * @param {boolean=} skipUnbinding Whether to skip unbinding events before binding new events.
     * @return {Behold}
     */
    Behold.prototype.setElement = function(element, skipEvents, skipUnbinding){
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
    Behold.prototype.initialize = function(){};

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
        var modules = this.modules;
        for (var name in modules)
        {
            if (modules.hasOwnProperty(name) && modules[name].initialize &&
                typeof modules[name].initialize === 'function')
            {
                modules[name].initialize();
            }
        }
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