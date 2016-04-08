import OneWayInput from 'ember-one-way-input/components/one-way-input';

export default OneWayInput.extend({
  classNames: 'hypersearch-input',
  name: 'query',
  type: 'text',

  KEY_EVENTS: {
    '38': 'onuparrow',
    '40': 'ondownarrow'
  }
});