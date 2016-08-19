import omit from 'lodash.omit';
import merge from 'lodash.merge';
import Emitter from 'component-emitter';
import { indexOf } from 'lodash'
import {HostedField} from './hosted-field';
import errors from '../errors';

const debug = require('debug')('recurly:hostedFields');

const requiredFields = ['number', 'month', 'year'];
const fieldTypes = ['cvv'].concat(requiredFields);

/**
 * HostedFields
 *
 * @constructor
 * @param {Object} options
 * @param {Object} options.recurly options to init a recurly instance
 * @param {Object} options.fields
 * @param {Object} options.style
 * @public
 */

export class HostedFields extends Emitter {
  constructor (options) {
    super();
    this.ready = false;
    this.state = {};
    this.fields = [];
    this.errors = [];
    this.initQueue = [];
    this.readyState = 0;
    this.onTabNext = this.onTabNext.bind(this)
    this.onTabPrevious = this.onTabPrevious.bind(this)
    this.configure(options);
    this.inject();
    this.on('hostedField:state:change', this.update.bind(this));
    this.on('bus:added', bus => {
      this.bus = bus;
      this.fields.forEach(hf => bus.add(hf));
    });

    this.on('hostedField:tab:previous',this.onTabPrevious)
    this.on('hostedField:tab:next',this.onTabNext)
  }

  onTabNext(body) {
    let type = body.type
    let field = this.fields.find(function(f){ return f.type === type })
    let allFields = document.querySelectorAll("[data-recurly]")
    let curIdx = indexOf(allFields,field.target)

    if(curIdx+1 < allFields.length){
      let nextIdx = curIdx + 1
      let nextEl = allFields[nextIdx]
      this.tabToElement(field,nextIdx,nextEl)
    }
  }

  onTabPrevious(body) {
    let type = body.type
    let field = this.fields.find(function(f){ return f.type === type })
    let allFields = document.querySelectorAll("[data-recurly]")
    let curIdx = indexOf(allFields,field.target)

    if(curIdx-1 > 0){
      let prevIdx = curIdx - 1
      let prevEl = allFields[prevIdx]
      this.tabToElement(field,prevIdx,prevEl)
    }
  }

  tabToElement(focusedField,index,element) {
    let fieldType = element.attributes["data-recurly"].value
    if(indexOf(fieldTypes,fieldType) > -1) {
      let tabToField = this.fields.find(function(f){ return f.type === fieldType })
      tabToField.focus()
    } else {
      focusedField.iframe.blur()
      element.focus()
    }
  }

  configure (options) {
    this.config = options || {};
    this.config.style = this.config.style || {};
  }

  inject () {
    this.on('hostedField:ready', this.readyHandler.bind(this));
    fieldTypes.forEach(type => {
      try {
        this.fields.push(new HostedField(this.fieldConfig(type)));
        this.initQueue.push(type);
      } catch (e) {
        if (e.name === 'missing-hosted-field-target') {
          if (~requiredFields.indexOf(type)) {
            this.errors.push(e);
          }
        } else throw e;
      }
    });
    this.on('hostedFields:configure', () => {
      this.fields.forEach(field => {
        if (this.bus) this.bus.send('hostedField:configure', this.fieldConfig(field.type));
      });
    });
  }

  readyHandler (body) {
    const pos = this.initQueue.indexOf(body.type);
    if (~pos) this.initQueue.splice(pos, 1);
    if (this.initQueue.length === 0) {
      this.off('hostedField:ready', this.readyHandler);
      this.bus.send('hostedFields:ready');
      this.ready = true;
    }
    this.update(body);
  }

  update (body) {
    this.state[body.type] = omit(body, 'type');
    if (!this.ready) return;
    this.bus.send('hostedFields:state:change', this.state);
  }

  fieldConfig (type) {
    return {
      type,
      selector: this.config.fields[type],
      style: merge({}, this.config.style.all, this.config.style[type]),
      recurly: this.config
    };
  }
}
