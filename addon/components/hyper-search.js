import Ember from 'ember';
import layout from '../templates/components/hyper-search';
const {
  Component,
  A: emberArray,
  RSVP: { Promise, resolve, reject },
  $: { ajax },
  run: { debounce, bind },
  get,
  set,
  isBlank,
  isPresent,
  typeOf
} = Ember;

/**
 * Returns the key for the query in the cache. Only works in conjunction with
 * Ember.get.
 *
 * @public
 * @param {String} query
 * @return {String} nested key name
 */
function keyForQuery(query) {
  return `_cache.${safeKeyString(query)}`;
}

/**
 * Ensure string does not contain characters that will cause Ember.get to break
 *
 * IE: Replaces periods (.) with dashes (-)
 *
 * @public
 * @param {String} query
 * @return {String} safe key name
 */
function safeKeyString(query) {
  return query.replace('.', '-');
}

export default Component.extend({
  layout,
  minQueryLength: 3,
  debounceRate: 0,
  debounceAfter: true,
  endpoint: null,
  resultKey: null,
  placeholder: null,
  scrollOffset: 0,

  init() {
    this._super(...arguments);
    this._cache = {};
    this.results = emberArray();
  },

  willDestroyElement() {
    this._super(...arguments);
    this.removeAllFromCache();
  },

  cache(query, results) {
    set(this, keyForQuery(query), results);
    this._handleAction('loadingHandler', false);
    return resolve(results);
  },

  getCacheForQuery(query) {
    return get(this, keyForQuery(query));
  },

  removeFromCache(query) {
    delete this._cache[safeKeyString(query)];
    this.notifyPropertyChange('_cache');
  },

  removeAllFromCache() {
    delete this._cache;
    set(this, '_cache', {});
  },

  clearResults() {
    get(this, 'results').clear();
    this.notifyPropertyChange('results');
  },

  fetch(query) {
    if (isBlank(query) || (query.length < get(this, 'minQueryLength'))) {
      return reject();
    }

    this._handleAction('loadingHandler', true);

    let cachedValue = this.getCacheForQuery(query);

    if (isPresent(cachedValue)) {
      this._handleAction('loadingHandler', false);
      return resolve(cachedValue);
    } else {
      return this.requestAndCache(...arguments);
    }
  },

  /**
   * Override to handle the fetching of data. Must return a `Promise`.
   *
   * @public
   * @method request
   * @param {String} query
   * @return {Promise}
   */
  request(query) {
    return new Promise((resolve, reject) => {
      ajax({
        dataType: 'json',
        method: 'GET',
        url: get(this, 'endpoint'),
        data: { q: query }
      })
      .then(resolve, reject);
    });
  },

  requestAndCache(query) {
    return this.request(query)
      .then((results) => this.cache(query, results))
      .catch((error) => reject(error));
  },

  _search(value = this.$('input').val()) {
    return this.fetch(value)
      .then(bind(this, this._setResults));
  },

  _setResults(results) {
    this._handleAction('handleResults', results);

    return set(this, 'results', results);
  },

  _handleAction(actionName, ...args) {
    if (this.attrs && typeOf(this.attrs[actionName]) === 'function') {
      this.attrs[actionName](...args);
    } else {
      this.sendAction(actionName, ...args);
    }
  },

  _getNext(increment) {
    let results  = get(this, 'results');
    let maxIndex = get(results, 'length') - 1;
    if (maxIndex === -1) {
      return null;
    }
    let nextIndex = increment === 1 ? 0 : maxIndex;
    let limit     = increment === 1 ? maxIndex : 0;
    if (Object.prototype.toString.call(results.any) === '[object Function]') {
      results.any((result, i) => {
        if (get(result, 'isHighlighted')) {
          nextIndex = i === limit ? null : i + increment;
          return true;
        }
      });
      if (Object.prototype.toString.call(results.objectAt) === '[object Function]') {
        return results.objectAt(nextIndex);
      }
    }
    return {};
  },
  highlightResult(resultToHighlight) {
    if (!resultToHighlight) {
      return;
    }
    let results = get(this, 'results');
    if (Object.prototype.toString.call(results.any) === '[object Function]') {
      results.any((result) => {
        if (get(result, 'isHighlighted')) {
          set(result, 'isHighlighted', false);
          return true;
        }
      });
    }

    set(resultToHighlight, 'isHighlighted', true);

    // have jquery find and move the top position when arrowing down...
    /*
    * var jQuery -- if defined.;
    * */
    if(jQuery !== undefined){
      var offset = get(this, 'scrollOffset');
      var highlightOffset = jQuery('.hypersearch-result.highlight').offset();
      if(highlightOffset){
        var top = highlightOffset.top + offset;
        if(top>0){
          jQuery('body,html').animate({
            scrollTop: top
          }, 50);
        }
      }
    }
  },
  actions: {
    selectHighlightedResult() {
      let results = get(this, 'results');
      if (Object.prototype.toString.call(results.any) === '[object Function]') {
        results.any((result) => {
          if (get(result, 'isHighlighted')) {
            this._handleAction('selectResult', result);
            return false;// stop the "commit"
          }
        });
      }
    },

    commit() {
      this._handleAction('commit');
    },

    search(_event, query) {
      debounce(this, '_search', query, get(this, 'debounceRate'), get(this, 'debounceAfter'));
    },

    selectResult(result) {
      this._handleAction('selectResult', result);
    },

    highlightResult(result) {
      this.highlightResult(result);
    },

    moveHighlightedResult(increment) {
      this.highlightResult(this._getNext(increment));
    }
  }
});
