import Promise from 'promise';
import errors from '../errors';

const debug = require('debug')('recurly:apple-pay');

export function factory (options, done) {
  return new ApplePay(Object.assign({}, options, { recurly: this }), done);
};

class ApplePay {
  constructor (options, done) {
    debug('Creating new apple pay session')
    return new Promise((resolve, reject) => {
      if (!global.ApplePaySession) return reject(errors('apple-pay-not-supported'));

      try {
        this.configure(options);
      } catch (err) {
        return reject(err);
      }

      ApplePaySession.canMakePaymentsWithActiveCard(this.config.merchantIdentifier).then(canMakePayments => {
        if (canMakePayments) {
          let session = new ApplePaySession(1, {
            countryCode: this.config.country,
            currencyCode: this.config.currency,
            supportedNetworks: ['visa', 'masterCard'],
            merchantCapabilities: ['supports3DS'],
            total: { label: this.config.label, amount: this.config.amount },
          });
          resolve(session);
        } else {
          reject(errors('apple-pay-not-available'));
        }
      });
    }).nodeify(done);
  }

  configure (options) {
    this.config = this.config || {};

    if (!options.merchantIdentifier) throw errors('apple-pay-config-missing', { param: 'merchantIdentifier' });
    if (!options.country) throw errors('apple-pay-config-missing', { param: 'country' });
    if (!options.currency) throw errors('apple-pay-config-missing', { param: 'currency' });
    if (!options.label) throw errors('apple-pay-config-missing', { param: 'label' });
    if (!options.total) throw errors('apple-pay-config-missing', { param: 'total' });

    this.config.merchantIdentifier = options.merchantIdentifier;
  }
}
