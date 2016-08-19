import Emitter from 'component-emitter';
import events from 'component-event';
import dom from '../util/dom';
import errors from '../errors';

const debug = require('debug')('recurly:hostedField');

/**
 * HostedField
 *
 * @constructor
 * @param {Object} options
 * @param {String} options.selector target selector
 * @private
 */

export class HostedField extends Emitter {
  constructor (options) {
    super();

    this.focus = this.focus.bind(this);
    this.onBlur = this.onBlur.bind(this);
    this.onChange = this.onChange.bind(this);
    this.onFocus = this.onFocus.bind(this);

    this.isFocused = false;
    this.configure(options);
    this.inject();
    this.bindLabel();
    this.bindTabTrap();

    this.on('bus:added', bus => {
      this.bus = bus;
      this.bus.add(this.window);
    });

    // TODO: need these to be specific to this instance
    this.on('hostedField:focus', this.onFocus.bind(this));
    this.on('hostedField:blur', this.onBlur.bind(this));
    this.on('hostedField:change', this.onChange.bind(this));
  }

  get type () {
    return this.config.type;
  }

  configure (options) {
    this.target = dom.element(global.document.querySelector(options.selector));
    if (!this.target) {
      const {type, selector} = options;
      throw errors('missing-hosted-field-target', { type, selector });
    }
    this.config = options;
  }

  inject () {
    this.target.innerHTML = `
      <div class="${this.classList()}" style="position:relative;">
        <input type="text" style="position: absolute; z-index: -1; width: 0; height: 0;" />
        <iframe
          src="${this.url()}"
          border="0"
          frameborder="0"
          allowtransparency="true"
          scrolling="no">
        </iframe>
      </div>
    `;

    this.container = this.target.children[0];
    this.tabTrapInput = this.container.children[0];
    this.iframe = this.container.children[1];
    this.window = this.iframe.contentWindow;

    this.iframe.style.height = '100%';
    this.iframe.style.width = '100%';
    this.iframe.style.background = 'transparent';
    this.iframe.style.position = 'relative';
    this.iframe.style.zIndex = 1;
  }

  bindLabel () {
    if (!this.target.id) return;
    const labels = global.document.querySelectorAll(`label[for=${this.target.id}]`);
    [].slice.apply(labels).forEach(label => {
      events.bind(label, 'click', this.focus);
    });
  }

  bindTabTrap () {
    this.tabTrapInput.addEventListener('focus',(e) => {
      e.preventDefault()
      e.stopPropagation()
      // Firefox demands a blur or else the focus doesn' work...
      if(typeof InstallTrigger !== 'undefined') e.currentTarget.blur()
      this.focus()
    })
  }

  update () {
    this.container.className = this.classList();
  }

  onFocus (body) {
    if (body.type !== this.type) return;
    this.isFocused = true;
    this.update();
  }

  onBlur (body) {
    if (body.type !== this.type) return;
    this.isFocused = false;
    this.update();
  }

  onChange (body) {
    if (body.type !== this.type) return;
    this.update();
  }

  focus () {
    if (!this.bus) return;
    this.bus.send(`hostedField:${this.type}:focus!`);
  }

  classList () {
    const prefix = 'recurly-hosted-field';
    let classes = [prefix];

    classes.push(`${prefix}-${this.config.type}`);
    if (this.isFocused) {
      classes.push(`${prefix}-focus`);
      classes.push(`${prefix}-${this.config.type}-focus`);
    }

    return classes.join(' ');
  }

  url () {
    let config = encodeURIComponent(JSON.stringify(this.config));
    return `${this.config.recurly.api}/field?config=${config}`;
  }
}
