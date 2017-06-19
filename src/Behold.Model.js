/**
 * @author Christopher Keefer [SaneMethod]
 * @version 0.1.3
 *
 * Model (data objects) and their attendant functionality, both on a per item and overall collection basis.
 * Relies on and extends Behold (View layer).
 * @param {object} Behold The Behold object to extend.
 * @param {object} $ jQuery lib, or api-compatible replacement (such as Zepto).
 * @param {object=} _ underscore lib. Currently a hard requirement, the downgrading to a soft requirement of
 * which is planned for a future version.
 */
(function(Behold, $, _){

    function Model(attributes, options){
        options = options || {};
        this.options = _.extend({}, options);
        /**
         * A unique id for this model, which is used to refer to it until we have a real
         * unique id from the server for it.
         * @type {string}
         */
        this.cid = _.uniqueId('model');
        /**
         * The name of the attribute to use as our unique id from the server for this model.
         * Default is 'id'.
         * @type {string}
         */
        this.idAttribute = options.idAttribute || 'id';
        /**
         * An object containing the attributes and values that have changed. These will be the most
         * recent changes, not necessarily containing the original values.
         * @type {{}}
         */
        this.changed = {};
        /**
         * The object containing the current attributes for the model.
         * @type {{}}
         */
        this.attributes = {};
        /**
         * A simple, jQuery-based event aggregator.
         * @type {*}
         */
        this.vent = $({});
        /**
         * The url which, when combined with the unique id (if available) for this model,
         * is the url which we use to communicate with the server in regards to this model.
         * Optional - if this model is attached to a collection, the model will use this url
         * in preference to the one on the collection.
         */
        this.url = options.url;
        /**
         * This page this model should be associated with, in terms of considering what page's worth
         * of results this model belongs to. 0 can mean this model does not belong to a collection, or that
         * it is not synced up with the server.
         */
        this.page = options.page || 0;
        /**
         * An optional reference to the collection to which this model belongs.
         */
        if (options.collection) this.collection = options.collection;

        this.set(attributes || {});
        this.initialize.apply(this, arguments);
    }

    Model.idAttribute = 'id';

    /**
     * Empty initialize function to be overriden by subclasses.
     */
    Model.prototype.initialize = function(){};

    /**
     * Return the model as an object of its attributes when calling to JSON.
     * @returns {*}
     */
    Model.prototype.toJSON = function(){
        return _.clone(this.attributes);
    };

    /**
     * Return the stringified object of this models attributes.
     */
    Model.prototype.toString = function(){
        return JSON.stringify(this.toJSON());
    };

    /**
     * Determine whether this model is new by determining whether the specified idAttribute
     * is set within this models attributes, at which point we assume that it has indeed
     * synced with the server at some point.
     * @returns {boolean}
     */
    Model.prototype.isNew = function(){
        return (this.attributes[this.idAttribute] === void 0);
    };

    /**
     * Return the url to use for communicating with the server about this model.
     * @returns {string}
     * @throws TypeError
     */
    Model.prototype.getURL = function(){
        var baseURL = this.url || this.collection.url,
            id = this.get(this.idAttribute);

        if (baseURL === void 0) throw new TypeError('URL is not set on model.');
        if (this.isNew()) return baseURL;
        return (baseURL.replace(/[^\/]$/, '$&/') + encodeURIComponent(id)).replace(/[^\/]$/, '$&/');
    };

    /**
     * Set the attribute(s) specified upon this model, firing a 'change' event for each change,
     * and a 'changed' event once we've processed all the changes.
     * @param {string|object} key
     * @param {*=} val
     * @returns {Model}
     */
    Model.prototype.set = function(key, val){
        var attrs = (typeof key === 'object') ? key : (function(){
                var obj = {};
                obj[key] = val;
                return obj;
            })(),
            current = this.attributes,
            changed = this.changed;

        for (var attr in attrs){
            if (attrs.hasOwnProperty(attr)){
                val = attrs[attr];
                if (current[attr] !== val)
                {
                    if (current[attr] !== void 0) changed[attr] = current[attr];
                    if (val === void 0){
                        delete current[attr]
                    } else{
                        current[attr] = val;
                    }

                    this.vent.trigger('change.model', [this, attr])
                }
            }
        }
        if (!_.isEmpty(changed)) this.vent.trigger('changed.model', [this, changed]);
        return this;
    };

    /**
     * Get a specified attribute(s) from the model. If key is a string,
     * fetch the attribute on this model for that key. If there are multiple string
     * arguments, or key is an array, return an object with all of the requested attributes
     * from this model therein.
     * @param {string|Array...} key
     * @returns {*|object}
     */
    Model.prototype.get = function(key){
        var keys = (arguments.length > 1) ? Array.prototype.slice.call(arguments) :
            (Array.isArray(key)) ? key : [key],
            obj = {};

        if (keys.length === 1) return this.attributes[keys[0]];
        keys.forEach(function(key){
            obj[key] = this.attributes[key];
        }.bind(this));
        return obj;
    };

    /**
     * Remove specified attribute(s) from the model.
     */
    Model.prototype.remove = function(attrs){
        var obj = {};
        if (!Array.isArray(attrs)) attrs = [attrs];
        attrs.forEach(function(attr){
            obj[attr] = void 0;
        });
        return this.set(obj);
    };
    /**
     * Determine whether any attributes have changed on this model.
     * @returns {boolean}
     */
    Model.prototype.hasChanged = function(){
        return !_.isEmpty(this.changed);
    };

    /**
     * Get the attributes that have changed on this model - returns an object
     * of the changed keys with their previous (not necessarily original) value.
     * @returns {{}|*}
     */
    Model.prototype.getPrevious = function(){
        return this.changed;
    };

    /**
     * Get the attributes that have changed on this model - returns an
     * object with the changed keys with their *current* value.
     */
    Model.prototype.getChanges = function(){
        var changes = {};
        for (var key in this.changed){
            if (this.changed.hasOwnProperty(key)){
                changes[key] = this.get(key);
            }
        }
        return changes;
    };

    /**
     * Fetch this models attributes from the server.
     * @param options
     * @returns {*}
     */
    Model.prototype.fetch = function(options){
        var opts = _.extend({}, this.options, options),
            params = _.extend({url:this.getURL(), type:'read',
                contentType:'application/json', dataType:'json'},
                (opts.params || {})),
            defer = $.Deferred();

        if (!params.url) {
            this.vent.trigger('invalid.fetch.model');
            defer.reject({status:404, responseText:"No url or invalid url specified for fetch"});
            return defer.promise();
        }

        if (Collection.HTTPVerbs.indexOf(params['type'].toUpperCase()) === -1){
            params['type'] = Collection.MethodMap[params['type'].toLowerCase()];
            if (!params['type']) throw SyntaxError('Expected a CRUD or HTTP verb for type parameter.');
        }

        return this.sync(params).done(function(response){
            this.parseResponse(response);
            this.vent.trigger('sync.model');
        }.bind(this));
    };

    /**
     * Parse the response from the server - by default, we expect the server to return
     * an object, which we use to set the attributes on the model.
     * @param {object} response
     */
    Model.prototype.parseResponse = function(response){
        this.set(response);
    };

    /**
     * Save this model to the server. If this model isNew (that is, doesn't currently have its
     * idAttribute set) then this request will be a 'create' (POST, by default) request. Otherwise,
     * if 'patch' is specified in options, this will be a PATCH request that sends only the changed
     * details; otherwise, this will be an 'update' (PUT, by default) request that will send the full
     * set of attributes up to the server.
     * Attributes on this model will be updated with the return from the server via parseResponse by default.
     * @param {object=} attrs Attributes to set on the model before saving it.
     * @param {object=} options
     * @returns {$.Deferred}
     */
    Model.prototype.save = function(attrs, options){
        var opts = _.extend({}, this.options, options),
            params = _.extend({url:this.getURL(), type:(this.isNew()) ? 'create' :
                (opts.patch) ? 'patch' : 'update', contentType:'application/json', dataType:'json'},
                (opts.params || {}));

        if (attrs) this.set(attrs);
        params.data = JSON.stringify((params.type === 'patch') ? this.getChanges() : this.attributes);

        return this.sync(params).done(function(response){
            this.parseResponse(response);
            this.vent.trigger('sync.model');
        }.bind(this));
    };

    /**
     * Destroy this model on the server, if it is not 'new' (that is, if its idAttribute is set).
     * Otherwise, we simply remove this model from its collection if it has one, which we also do optimistically
     * (before response) on the collection if the model is not new, unless {wait:true} in the options.
     */
    Model.prototype.destroy = function(options){
        var opts = _.extend({}, this.options, options),
            params = _.extend({url:this.getURL(), type:'delete', contentType:'application/json', dataType:'json'},
                (opts.params || {})),
            removeFromCollection = function(){
                if (this.collection) this.collection.remove(this);
                this.vent.trigger('destroy.model');
            }.bind(this),
            defer = $.Deferred();

        if (!opts.wait || this.isNew()) removeFromCollection();
        if (this.isNew()){
            defer.resolve();
            return defer.promise();
        }

        return this.sync(params).done(function(){
           if (opts.wait) removeFromCollection();
        });
    };

    /**
     * Sync mechanism - simple passthrough to jQuery ajax by default.
     * @param params
     * @returns {$.Deferred}
     */
    Model.prototype.sync = function(params){
        return $.ajax(params);
    };

    Model.extend = Behold.extend.bind(Model);


    function Collection(models, options){
        options = options || {};
        this.cid = _.uniqueId('collection');
        this.options = _.extend({}, Collection.Pagination, options);
        /**
         * The base url for the collection.
         * @type {string}
         */
        this.url = options.url || void 0;
        /**
         * The Model to use for each data object within this collection.
         */
        this.model = options.model || Model.extend({});
        /**
         * Array of objects that represent the data fetched from / to be synced with the server.
         * @type {Array<object>}
         */
        this.models = [];
        /**
         * Event aggregator for the collection, simple implementation based on jQuery.
         * @type {*}
         */
        this.vent = $({});
        /**
         * Internal state of the collection.
         * @type {{}}
         */
        this.state = _.extend({_clean: false, count:0, totalPages:0, currentPage:0}, options.state);
        /**
         * The filter key:values to apply to a request.
         * @type {object}
         */
        this.filters = {};
        /**
         * The ordering strings to apply to a request.
         * @type {Array<string>}
         */
        this.ordering = [];

        // Set initial models, if any.
        this.set((models || []), options);

        this.initialize.apply(this, arguments);

        return this;
    }

    /**
     * Empty initialize function, to be overriden by subclasses.
     */
    Collection.prototype.initialize = function(){};

    /**
     * Fetch the initial page if we haven't done so previously, or the next page if available, unless the options
     * object tells us what page (or offset, or cursor) to perform the next fetch on.
     * @param {object=} options
     */
    Collection.prototype.fetch = function(options){
        var opts = _.extend({}, this.options, (options || {})),
            params = _.extend({url:this.state.next, type:'read',
                contentType:'application/json', dataType:'json'},
                (opts.params || {})),
            defer = $.Deferred();

        if (!this.state._clean){
            this.reset();
            this.rebuildNext({});
            params.url = this.state.next;
        }

        if (!params.url) {
            this.vent.trigger('invalid.fetch.collection');
            defer.reject({status:404, responseText:"No url or invalid url specified for fetch"});
            return defer.promise();
        }

        if (Collection.HTTPVerbs.indexOf(params['type'].toUpperCase()) === -1){
            params['type'] = Collection.MethodMap[params['type'].toLowerCase()];
            if (!params['type']) throw SyntaxError('Expected a CRUD or HTTP verb for type parameter.');
        }

        return this.sync(params).done(function(response, status, jqXHR){
            var currentPage = this._getPageFromURLString(params.url) || this.options.pageStart,
                results = this.parseResponse(response, jqXHR);

            this.updateState({_clean:true, currentPage:currentPage});
            this.set(results, opts);
            this.vent.trigger('sync.collection');
        }.bind(this));
    };

    /**
     * Alias for fetch.
     * @type {Collection.fetch|*}
     */
    Collection.prototype.fetchNext = Collection.prototype.fetch;
    /**
     * Alias for fetch that fetches the previous page/set.
     * Assumes we have a valid prev url set on the state.
     * @param {object=} options
     * @returns {*}
     */
    Collection.prototype.fetchPrev = function(options){
        return this.fetch(_.extend({url:this.state.prev}, options));
    };
    /**
     * Alias for fetch that fetches a particular page. Only valid if we have data from the server that allows
     * us to calculate total pages available.
     * @returns {*}
     */
    Collection.prototype.fetchPage = function(page){
        var defer = $.Deferred();
        if (!this.state.totalPages){
            this.vent.trigger('unknownpage.fetch.collection');
            defer.reject({status:400, responseText:"Unable to calculate total pages."});
            return defer.promise();
        }
        if (page < this.options.pageStart || page > this.state.totalPages){
            this.vent.trigger('invalidpage.fetch.collection');
            defer.reject({status:404, responseText:"Page requested out of range for current set."});
            return defer.promise();
        }

        this.updateState({next:{page:page}, prev: (page-1 < this.options.pageStart) ? null :
            {page:Math.max(this.options.pageStart, page-1)}
        });

        this.vent.one('set.collection', function(){
            this.vent.trigger('pagesync.collection', [page, this]);
        }.bind(this));

        return this.fetch();
    };

    /**
     * Simply call out to jQuery ajax with our specified parameters for our default sync implementation,
     * and return the Deferred object from the ajax call. Simple so as to be easy to override.
     * @param params
     * @returns {*}
     */
    Collection.prototype.sync = function(params){
        return $.ajax(params);
    };

    /**
     * Set the array of models as part of this collection, optionally
     * resetting the collection in the process. If options.bootstrap is set,
     * then we treat the set of models created as a result of being passed data during
     * initialization.
     * @param {Array<object>} models
     * @param {object=} options
     */
    Collection.prototype.set = function(models, options){
        var that = this,
            /**
             * Compare new models/attribute hashes to be turned into a model by their idAttributes or,
             * if failing that, by their cid.
             * @param newModel
             * @param collectionModel
             */
            compareModels = function(newModel, collectionModel){
                var idAttribute = newModel.idAttribute || collectionModel.idAttribute,
                    compare = {},
                    id;

                if (newModel instanceof Model && !newModel.isNew()){
                    id = newModel.get(idAttribute);
                }else if (collectionModel.idAttribute in newModel){
                    id = newModel[idAttribute];
                }

                if (id){
                    compare[idAttribute] = id;
                    return that.whereOne(compare);
                } else if (newModel instanceof Model){
                    return that.models.filter(function(model){
                        return model.cid === newModel['cid'];
                    })[0];
                }
                return void 0;
            };

        options = options || {};

        if (options.reset) this.reset();
        if (options.bootstrap) {
            this.updateState({_clean:true, currentPage:this.options.pageStart});
        }

        models.forEach(function(model){
            var existingModel = compareModels(model, that.model);

            if (existingModel){
                if (model instanceof Model){
                    existingModel = _.extend(existingModel, model);
                    existingModel.set(model.attributes);
                }
                existingModel.set(model);
                existingModel.page = that.state.currentPage;
                return;
            }

            that.models.push(new that.model((model instanceof Model) ? model.attributes : model,
                _.extend({collection:that, page:that.state.currentPage}, options)));
        });

        this.vent.trigger('set.collection');

        return this;
    };

    /**
     * Add a single model to this collection. Can be a model instance or an object of attributes
     * to use in creating a new model.
     * @param model
     * @param options
     */
    Collection.prototype.add = function(model, options){
        this.setCollectionUnclean();
        return this.set([model], options);
    };

    /**
     * Convenience function to create a new instance of the model set for this collection,
     * and (unless {sync:false} is set in options) immediately send it to the server.
     * @param {object} attrs
     * @param {object=} options
     */
    Collection.prototype.create = function(attrs, options){
        options = options || {};
        var model = new this.model(attrs, _.extend({collection:this}, options));
        if (options.sync !== false) model.save();
        this.setCollectionUnclean();
        return this.set(model, options);
    };

    /**
     * For each model in the collection, call save to sync it up with the server, sending the new attributes
     * as necessary.
     */
    Collection.prototype.save = function(options){
        this.models.forEach(function(model){
            model.save({}, options);
        });
        return this;
    };

    /**
     * Destroy all models on the server associated with this collection.
     * @param options
     */
    Collection.prototype.destroy = function(options){
        this.models.forEach(function(model){
            model.destroy(options);
        });
        return this;
    };

    /**
     * Get the first model within the collection that matches the specified id (or cid).
     * @param id
     * @returns {Model|undefined}
     */
    Collection.prototype.get = function(id){
        var matches = this.models.filter(function(model){
            return model.get(model.idAttribute) == id || model.cid == id;
        });
        return (matches.length) ? matches[0] : void 0;
    };
    /**
     * Return a model at the given index.
     * @param index
     */
    Collection.prototype.at = function(index){
        index = (index < 0 || index > this.models.length) ? this.models.length : index;
        return this.models[index];
    };

    /**
     * Return all models that match the specified attributes.
     * @param {object} attrs
     * @returns {*}
     */
    Collection.prototype.where = function(attrs){
        var matches = this.models.filter(function(model){
            var keys = Object.keys(attrs);

            for (var i=0, len = keys.length; i < len; i++){
                if (attrs[keys[i]] !== model.get(keys[i])) return false;
            }
            return true;
        });

        return (matches.length) ? matches : [];
    };
    /**
     * Return the first model that matches the attributes specified.
     */
    Collection.prototype.whereOne = function(attrs){
        var matches = this.where(attrs);
        return matches[0];
    };

    /**
     * Get all models within the collection that identify themselves as belonging to
     * the specified page.
     */
    Collection.prototype.getPage = function(page){
        return this.models.filter(function(model){
            return model.page === page;
        });
    };

    Collection.prototype.getPageRange = function(){
        if (!this.state.totalPages) return {start:null, end:null};
        return {start:this.options.pageStart, end:this.state.totalPages};
    };

    /**
     * Reset the collection by removing all models, resetting state and triggering the 'reset' event.
     */
    Collection.prototype.reset = function(){
        this.models = [];
        this.updateState({next:null, prev:null, _clean:false, currentPage:0});
        this.vent.trigger('reset.collection');

        return this;
    };

    /**
     * Remove model(s) specified from the collection, without destroying them on the server.
     * Model(s) param can be either a single or array of model objects that we'll match to remove,
     * or a single or array of ids (using the specified idAttribute on the Model object) to remove.
     *
     * @param {Array<object>|object} models
     */
    Collection.prototype.remove = function(models){
        var keptModels = [],
            modelIDs;

        if (!Array.isArray(models)) models = [models];
        if (typeof models[0] === 'object') {
            modelIDs = models.map(function(model){
                return model[model.idAttribute] || model.cid;
            });
        }

        this.models.forEach(function(model){
            var modelID = model[model.idAttribute] || model.cid;
            if (modelIDs.indexOf(modelID) === -1){
                keptModels.push(model);
                return;
            }
            model.vent.trigger('remove.model');
        });

        this.models = keptModels;

        return this;
    };

    /**
     * Update the collections internal state.
     * @param updates
     */
    Collection.prototype.updateState = function(updates){
        var state = this.state;

        if ('next' in updates) this.rebuildNext(updates.next);
        if ('prev' in updates) this.rebuildPrev(updates.prev);
        if ('_clean' in updates) state._clean = updates._clean;
        if ('currentPage' in updates) state.currentPage = updates.currentPage;
        if ('count' in updates){
            state['count'] = updates.count;
            if (!!this.options.pageSizeParam && this.options.pageSize > 0){
                state['totalPages'] = Math.ceil(updates.count / this.options.pageSize);
            }
        }

        return this;
    };

    /**
     * Internal function to get the page number from the specified url using a simple regex.
     * @param url
     * @returns {Number}
     * @private
     */
    Collection.prototype._getPageFromURLString = function(url){
        var pageReg = new RegExp('.*'+this.options.pageQueryParam+'=(\\d+)'),
            page = pageReg.exec(url);

        return (page) ? parseInt(page[1], 10) : void 0;
    };

    /**
     * Rebuild the next or prev urls from the page, ordering and filtering details.
     * @param {string} oldURL
     * @param {object} update
     * @returns {string}
     */
    Collection.prototype.rebuildURL = function(oldURL, update){
        var url = this.url,
            page = this._getPageFromURLString(oldURL),
            pageSize = (function(){
                var pageSizeReg = new RegExp('.*'+this.options.pageSizeParam+'=(\\d+)'),
                    pageSize = pageSizeReg.exec(oldURL);

                return (pageSize) ? parseInt(page[1], 10) : void 0;
            }.bind(this))(),
            params = {},
            ordering = this.getOrdering();

        if (url === void 0) throw TypeError("Collection url is not set.");

        update = update || {};

        page = update.page || page || this.options.pageStart;
        pageSize = update.pageSize || pageSize || this.options.pageSize;
        params[this.options.pageQueryParam] = page;
        if (!!this.options.pageSizeParam) params[this.options.pageSizeParam] = pageSize;

        if (ordering.length) params[this.options.orderParam] = ordering;
        _.extend(params, this.getFilters());

        return url + '?' + $.param(params);
    };

    /**
     * Rebuild the next url, either using the provided url string, or from the base components.
     * @param {object} update
     */
    Collection.prototype.rebuildNext = function(update){
        if (typeof update === 'string' || update === null){
            this.state.next = update;
            return;
        }

        this.state.next = this.rebuildURL(this.state.next, update);
        return this;
    };

    /**
     * Rebuild the prev url, either using the provided url string, or from the base components.
     * @param {object} update
     */
    Collection.prototype.rebuildPrev = function(update){
        if (typeof update === 'string' || update === null){
            this.state.prev = update;
            return;
        }

        this.state.prev = this.rebuildURL(this.state.prev, update);
        return this;
    };


    /**
     * Parse the response upon fetching a page of the collection. By default, we expect a JSON response with
     * the following properties:
     * count {Number} Total number of records available with the current filtering applied.
     * next {string|null=} A url indicating the url to use to fetch the next page|offset|cursor-indicated set.
     *  This could optionally be in a response header instead, and can also be null to indicate no next page.
     * prev {string|null=} A url indicating the url to use to fetch the previous page|offset|curosr-indicated set.
     *  This could optionally be in a response header instead, and can also be null ot indicate no prev page.
     * results {Array<object>} An array of objects representing the data from the server to set as models.
     *
     * @param {object} response
     * @param {object=} jqXHR Our standard sync method proxies jQuery ajax, and returns the jqXHR object to
     * extract the headers from if available.
     */
    Collection.prototype.parseResponse = function(response, jqXHR){
        this.updateStateFromResponse(response, jqXHR);
        return response.results;
    };

    /**
     * Update the collection state using the parameters passed to us from parseResponse.
     * @param response
     * @param jqXHR
     */
    Collection.prototype.updateStateFromResponse = function(response, jqXHR){
        var opts = this.options,
            updates = {_clean:true};

        if (!!opts.responseLink){
            this.updateState(_.extend(updates, response, opts.parseResponseLink(response)));
        } else if (opts.headerLink){
            this.updateState(_.extend(updates, response, opts.parseHeaderLink(
                ((typeof opts.headerLink === 'string') ? opts.headerLink : void 0), jqXHR)));
        }
    };

    /**
     * Indiciate that the collection state has changed such that the order or filtering is
     * no longer valid, unless {reset:false} is passed in the options. Additionally, if
     * fetch:true is passed, immediately refetch the collection.
     * @param {object=} options
     */
    Collection.prototype.setCollectionUnclean = function(options){
        options = options || {};
        if (options.reset !== false) this.updateState({_clean:false, next:null, prev:null});
        if (options.fetch === true) this.fetch();
    };

    /**
     * Add filter(s) to the filter object, specified as key:value within an object.
     * Filters with the same key as an existing filter are overriden.
     * Adding a filter implicitly makes the collection unclean, and will set the state to be
     * reset on the next fetch. In the options hash, {reset:false} can be passed to avoid this behaviour,
     * and {fetch:true} can be passed to immediately re-fetch the collection.
     * @param {object} filters
     * @param {object=} options
     */
    Collection.prototype.addFilter = function(filters, options){
        this.filters = _.extend(this.filters, filters);
        this.setCollectionUnclean(options);
        return this;
    };
    /**
     * Remove specified filter(s) from the current filter set.
     * Removing a filter implicitly makes the collection unclean, and will set the state to be
     * reset on the next fetch. In the options hash, {reset:false} can be passed to avoid this behaviour,
     * and {fetch:true} can be passed to immediately re-fetch the collection.
     * @param {Array} filters
     * @param {object=} options
     */
    Collection.prototype.removeFilter = function(filters, options){
        filters.forEach(function(filter){
            delete this.filters[filter];
        }.bind(this));
        this.setCollectionUnclean(options);
        return this;
    };
    /**
     * Get the filters that apply to this collection. By default,
     * we simply return the filters object.
     */
    Collection.prototype.getFilters = function(){
        return this.filters;
    };

    /**
     * Add an ordering string at the specified 0-indexed position. If no position is specified,
     * appends to the end.
     * Altering ordering implicitly resets the page state (as the order of the collection is no
     * longer valid). In the options hash, {reset:false} can be passed to avoid this behaviour,
     * and {fetch:true} can be passed to immediately re-fetch the collection.
     * @param {string} order
     * @param {number=} pos
     * @param {object=} options
     */
    Collection.prototype.addOrder = function(order, pos, options){
        pos = pos || this.ordering.length;
        options = options || {};
        this.ordering.splice(pos, 0, order);
        this.setCollectionUnclean(options);
        return this;
    };
    /**
     * Remove ordering string from the ordering array. Can be specified with or without the descending '-'
     * prepended. Case-sensitive.
     * Alternatively, specify a 0-indexed position to remove the ordering string at that position.
     * Altering ordering implicitly resets the page state (as the order of the collection is no
     * longer valid). In the options hash, {reset:false} can be passed to avoid this behaviour,
     * and {fetch:true} can be passed to immediately re-fetch the collection.
     * @param {number|string} order
     * @param {object=} options
     */
    Collection.prototype.removeOrder = function(order, options){
        var pos = (typeof order === 'number') ? order : -1;

        if (pos !== -1){
            this.ordering.splice(pos, 1);
            return this;
        }
        if ((pos = this.ordering.indexOf(order)) !== -1 || (pos = this.ordering.indexOf('-'+order)) !== -1){
            this.ordering.splice(pos, 1);
        }
        this.setCollectionUnclean(options);
        return this;
    };
    /**
     * Get the ordering string for use as a parameter. By default,
     * we simply join the strings together separated by commas.
     * @returns {string}
     */
    Collection.prototype.getOrdering = function(){
        return this.ordering.join(',');
    };

    /**
     * Allow Behold Models to be extended in the same fashion as a Behold View, setting the Collection state
     * in the process.
     * @type {(function(this:Collection))|*}
     */
    Collection.extend = Behold.extend.bind(Collection);

    Collection.HTTPVerbs = ['POST', 'GET', 'PUT', 'DELETE', 'PATCH', 'HEAD'];
    /** Map 'crud' verbs to HTTP verbs. */
    Collection.MethodMap = {
        'create':'POST',
        'read':'GET',
        'update':'PUT',
        'delete':'DELETE',
        'patch':'PATCH'
    };

    Collection.Pagination = {
        /* Parameter controlling what page we're on - defaults to 'page' */
        pageQueryParam:'page',
        /* Parameter controlling the page size - defaults to 'page_size'. If falsey, the page size
         * parameter won't be set on any requests. */
        pageSizeParam: 'page_size',
        /* Value for the pageSizeParam - defaults to 20. If set to a number =< 0, the page size parameter won't
         * be set on any requests. */
        pageSize: 20,
        /* What value to use as the initial value for the pageQueryParam */
        pageStart: 1,
        /* What value to increment the pageStart by when considering what the next page value should be. */
        pageIncrement:1,
        /* What parameter to use to indicate ordering of the query result. */
        orderParam:'ordering',
        /* Whether we should look for the links to the next and/or previous result set in the header. If
        * set to a string, it's the name of the header link used in the default parse function. If true,
        * we use the default header key, 'Link'. If false, we don't look for links in the header. If both
        * headerLink and responseLink are set to a truthy value, responseLink takes precedence. */
        headerLink:false,
        /** How to parse the links in the header - by default, we expect a header named 'Link' whose value is a
         * <> surrounded string which indicates the next and/or previous urls for the result set. Each url is separated
         * from its indicator as to whether it is a next or previous link by a semi-colon, and each url is separated
         * from another url by a comma.
         */
        parseHeaderLink:function(linkKey, xhr){
            linkKey = linkKey || 'Link';
            var header = xhr.getResponseHeader(linkKey) || '',
                regHeader = function(rel){
                    var regex = new RegExp('<(.+)>; rel="'+rel+'"'),
                        result = regex.exec(header);

                    if (result && result[0]) return result[0];
                    return null;
                },
                prev = regHeader('prev'),
                next = regHeader('next');

            return {prev: prev || null, next: next || null};
        },
        /* Whether to look for the links to the next and/or previous result set in the response body. Only accepts
        * true or false (other values will be coerced into truthy or falsey, according to standard js rules).
        * If both headerLink and responseLink are truthy, responseLink takes precedence.
         */
        responseLink:true,
        /**
         * How to parse the links in the response body - be default, we expect a 'next' and 'prev' key in the
         * response, which we pass along unmolested.
         */
        parseResponseLink:function(response){
            return {prev: response.prev || null, next: response.next || null};
        }
    };

    Behold.Collection = Collection;
    Behold.Model = Model;

})(window.Behold, jQuery, _);