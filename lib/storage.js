const {
  LocalStorage
} = require('node-localstorage');

const numberFlag = '~#~';
const jsonFlag = '~{~';
const nullFlag = '~N~';

class Storage extends LocalStorage {
  constructor(path, quota) {
    if (null == quota) {
      quota = 50 * 1024 * 1024;
    }
    super(path, quota);
  }

  /**
   * Stores a primitive or object
   * @param {*} key 
   */
  put(key, value) {
    if (typeof key !== 'string') {
      throw new Error('key must be a string');
    }

    if (null === value) {
      return this.setItem(key, nullFlag);
    } else {
      if (value instanceof Object) {
        return this.setItem(key, jsonFlag + JSON.stringify(value));
      } else if (typeof value === 'string') {
        return this.setItem(key, value);
      } else {
        return this.setItem(key, numberFlag + value)
      }
    }
  }

  get(key) {
    if (typeof key !== 'string') {
      throw new Error('key must be a string');
    }

    const raw = this.getItem(key);
    if (nullFlag === raw) {
      return null;
    } else {
      if (typeof raw === 'string' && raw.startsWith(jsonFlag)) {
        try {
          return JSON.parse(raw.substring(jsonFlag.length));
        } catch (error) {
          return raw;
        }
      } else if (typeof raw === 'string' && raw.startsWith(numberFlag)) {
        return raw.substring(numberFlag.length) * 1;
      } else {
        return raw;
      }
    }
  }
}

function migrate(legacyStorage, storage) {

}

module.exports = {
  Storage: Storage
};
